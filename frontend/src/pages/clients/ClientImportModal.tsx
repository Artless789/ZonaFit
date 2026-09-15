import React, { useState, useRef } from 'react';
import axios from 'axios';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  AlertTriangle, 
  FileCheck, 
  RefreshCw, 
  ArrowRight,
  ShieldCheck,
  Check
} from 'lucide-react';
import { Modal } from '@shared/ui/Modal';
import { Button } from '@shared/ui/Button';
import { useToast } from '@shared/ui/Toast';
import { clientService } from '../../services/clientService';
import type { 
  ClientImportPreviewResponse, 
  ImportCategory,
  ClientImportApplyRequest
} from '@shared/types/clientExcel';
import { cn } from '@shared/utils/cn';

interface ClientImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ClientImportModal({ isOpen, onClose, onSuccess }: ClientImportModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [step, setStep] = useState<'upload' | 'preview' | 'confirm'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Preview data
  const [previewData, setPreviewData] = useState<ClientImportPreviewResponse | null>(null);
  const [activeTab, setActiveTab] = useState<ImportCategory | 'ALL'>('ALL');

  // Selected items to apply (keys: row_number or client_id)
  const [selectedNewRows, setSelectedNewRows] = useState<Set<number>>(new Set());
  const [selectedModifiedClients, setSelectedModifiedClients] = useState<Set<number>>(new Set());

  const resetState = () => {
    setStep('upload');
    setSelectedFile(null);
    setIsAnalyzing(false);
    setIsApplying(false);
    setErrorMessage(null);
    setPreviewData(null);
    setActiveTab('ALL');
    setSelectedNewRows(new Set());
    setSelectedModifiedClients(new Set());
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDownloadTemplate = async () => {
    try {
      await clientService.downloadTemplate();
      toast({
        type: 'success',
        title: 'Plantilla Descargada',
        message: 'Se descargó la plantilla oficial plantilla_clientes_zonafit.xlsx',
      });
    } catch {
      toast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo descargar la plantilla oficial.',
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        setErrorMessage('Formato no válido. Por favor selecciona un archivo con extensión .xlsx');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setErrorMessage(null);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    try {
      setIsAnalyzing(true);
      setErrorMessage(null);

      const response: ClientImportPreviewResponse = await clientService.previewImport(selectedFile);
      setPreviewData(response);

      // Default: select all NEW and MODIFIED items
      const newRows = new Set<number>();
      response.items
        .filter(item => item.category === 'NEW')
        .forEach(item => newRows.add(item.row_number));
      setSelectedNewRows(newRows);

      const modClients = new Set<number>();
      response.items
        .filter(item => item.category === 'MODIFIED' && item.client_id)
        .forEach(item => modClients.add(item.client_id!));
      setSelectedModifiedClients(modClients);

      setStep('preview');
      toast({
        type: 'info',
        title: 'Análisis Completo',
        message: `Se analizaron ${response.summary.total_rows} filas en el archivo.`,
      });
    } catch (err: unknown) {
      let detail = 'Error al analizar el archivo de clientes.';
      if (axios.isAxiosError(err)) {
        detail = err.response?.data?.detail || err.message || detail;
      } else if (err instanceof Error) {
        detail = err.message;
      }
      setErrorMessage(detail);
      toast({
        type: 'error',
        title: 'Archivo Rechazado',
        message: detail,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Toggle selection
  const toggleSelectNewRow = (rowNum: number) => {
    setSelectedNewRows(prev => {
      const next = new Set(prev);
      if (next.has(rowNum)) next.delete(rowNum);
      else next.add(rowNum);
      return next;
    });
  };

  const toggleSelectModifiedClient = (clientId: number) => {
    setSelectedModifiedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const toggleSelectAllCategory = (category: 'NEW' | 'MODIFIED', select: boolean) => {
    if (!previewData) return;
    if (category === 'NEW') {
      const next = new Set<number>();
      if (select) {
        previewData.items
          .filter(i => i.category === 'NEW')
          .forEach(i => next.add(i.row_number));
      }
      setSelectedNewRows(next);
    } else {
      const next = new Set<number>();
      if (select) {
        previewData.items
          .filter(i => i.category === 'MODIFIED' && i.client_id)
          .forEach(i => next.add(i.client_id!));
      }
      setSelectedModifiedClients(next);
    }
  };

  // Filtered items
  const filteredItems = previewData
    ? activeTab === 'ALL'
      ? previewData.items
      : activeTab === 'MISSING'
      ? previewData.missing_clients
      : previewData.items.filter(i => i.category === activeTab)
    : [];

  const handleApply = async () => {
    if (!previewData) return;

    try {
      setIsApplying(true);

      // Build payload
      const new_clients = previewData.items
        .filter(i => i.category === 'NEW' && selectedNewRows.has(i.row_number))
        .map(i => ({
          document_type: i.document_type,
          document: i.document,
          full_name: i.full_name,
          phone: i.phone || '',
          email: i.email || null,
          notes: i.notes || null,
        }));

      const updated_clients = previewData.items
        .filter(i => i.category === 'MODIFIED' && i.client_id && selectedModifiedClients.has(i.client_id))
        .map(i => ({
          client_id: i.client_id!,
          full_name: i.full_name,
          phone: i.phone || null,
          email: i.email || null,
          notes: i.notes || null,
        }));

      const payload: ClientImportApplyRequest = {
        new_clients,
        updated_clients,
      };

      const result = await clientService.applyImport(payload);

      toast({
        type: 'success',
        title: 'Actualización Exitosa',
        message: result.message,
      });

      onSuccess();
      handleClose();
    } catch (err: unknown) {
      let detail = 'Error al aplicar los cambios.';
      if (axios.isAxiosError(err)) {
        detail = err.response?.data?.detail || err.message || detail;
      } else if (err instanceof Error) {
        detail = err.message;
      }
      toast({
        type: 'error',
        title: 'Error de Aplicación',
        message: detail,
      });
      setStep('preview');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      containerClassName={step === 'preview' ? 'max-w-5xl' : 'max-w-xl'}
      title={
        step === 'upload'
          ? 'Importar y Comparar Clientes desde Excel'
          : step === 'preview'
          ? 'Previsualización y Comparación de Clientes'
          : 'Confirmar Actualización Masiva'
      }
      description={
        step === 'upload'
          ? 'Carga un archivo Excel (.xlsx) con la plantilla oficial para comparar y actualizar clientes de tu gimnasio.'
          : step === 'preview'
          ? 'Revisa las diferencias encontradas antes de aplicar cualquier modificación a la base de datos.'
          : 'Revisa el resumen final antes de ejecutar los cambios en tu base de datos.'
      }
    >
      {/* ------------------------------------------------------------- */}
      {/* PASO 1: UPLOAD                                                */}
      {/* ------------------------------------------------------------- */}
      {step === 'upload' && (
        <div className="flex flex-col gap-6 py-2">
          {/* Official template download banner */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-brand-primary/20 bg-brand-primary/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0">
                <FileSpreadsheet size={22} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-text-primary">Plantilla Oficial de Importación</h4>
                <p className="text-xs text-text-muted mt-0.5">
                  Descarga la plantilla .xlsx con los encabezados e instrucciones exactas requeridas.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="shrink-0 flex items-center gap-2 border-brand-primary/30 text-brand-primary hover:bg-brand-primary/10"
            >
              <Download size={15} />
              <span>Descargar plantilla</span>
            </Button>
          </div>

          {/* Drag and drop upload zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200",
              selectedFile 
                ? "border-brand-primary bg-brand-primary/5" 
                : "border-border-medium hover:border-border-strong hover:bg-bg-surface-hover"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-14 h-14 rounded-2xl bg-bg-elevated/70 flex items-center justify-center text-text-muted mb-3">
              <Upload size={28} className={selectedFile ? "text-brand-primary" : ""} />
            </div>

            {selectedFile ? (
              <div>
                <p className="text-sm font-semibold text-text-primary">{selectedFile.name}</p>
                <p className="text-xs text-text-muted mt-1">
                  {(selectedFile.size / 1024).toFixed(1)} KB • Clic para cambiar de archivo
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Haz clic aquí para seleccionar el archivo Excel (.xlsx)
                </p>
                <p className="text-xs text-text-muted mt-1">
                  Solo se aceptan archivos en formato oficial .xlsx (máximo 10MB)
                </p>
              </div>
            )}
          </div>

          {/* Error display */}
          {errorMessage && (
            <div className="p-4 rounded-xl border border-danger/30 bg-danger/10 text-danger text-sm flex items-start gap-3">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Archivo no válido</p>
                <p className="text-xs mt-1 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Missing clients safety note */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border-light bg-bg-surface/50 text-text-secondary text-xs">
            <ShieldCheck size={18} className="text-brand-primary shrink-0 mt-0.5" />
            <p>
              <strong className="text-text-primary font-semibold">Seguridad garantizada:</strong> Los clientes que no aparezcan en el archivo <span className="underline font-semibold">NO serán eliminados ni desactivados</span> de tu gimnasio.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={!selectedFile || isAnalyzing}
              onClick={handleAnalyze}
              className="flex items-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Analizando archivo...</span>
                </>
              ) : (
                <>
                  <FileCheck size={16} />
                  <span>Analizar y Comparar</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* PASO 2: PREVIEW Y COMPARACIÓN                                 */}
      {/* ------------------------------------------------------------- */}
      {step === 'preview' && previewData && (
        <div className="flex flex-col gap-5 py-1">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            <div 
              onClick={() => setActiveTab('ALL')}
              className={cn(
                "p-3 rounded-xl border text-center cursor-pointer transition-colors",
                activeTab === 'ALL' ? "border-brand-primary bg-brand-primary/10" : "border-border-light bg-bg-surface/40 hover:bg-bg-surface"
              )}
            >
              <p className="text-[11px] font-medium text-text-muted">Total Filas</p>
              <p className="text-lg font-bold text-text-primary">{previewData.summary.total_rows}</p>
            </div>

            <div 
              onClick={() => setActiveTab('NO_CHANGE')}
              className={cn(
                "p-3 rounded-xl border text-center cursor-pointer transition-colors",
                activeTab === 'NO_CHANGE' ? "border-text-muted bg-text-muted/10" : "border-border-light bg-bg-surface/40 hover:bg-bg-surface"
              )}
            >
              <p className="text-[11px] font-medium text-text-muted">Sin Cambios</p>
              <p className="text-lg font-bold text-text-secondary">{previewData.summary.no_change_count}</p>
            </div>

            <div 
              onClick={() => setActiveTab('NEW')}
              className={cn(
                "p-3 rounded-xl border text-center cursor-pointer transition-colors",
                activeTab === 'NEW' ? "border-success bg-success/15" : "border-border-light bg-bg-surface/40 hover:bg-bg-surface"
              )}
            >
              <p className="text-[11px] font-medium text-success">Nuevos</p>
              <p className="text-lg font-bold text-success">{previewData.summary.new_count}</p>
            </div>

            <div 
              onClick={() => setActiveTab('MODIFIED')}
              className={cn(
                "p-3 rounded-xl border text-center cursor-pointer transition-colors",
                activeTab === 'MODIFIED' ? "border-warning bg-warning/15" : "border-border-light bg-bg-surface/40 hover:bg-bg-surface"
              )}
            >
              <p className="text-[11px] font-medium text-warning">Modificados</p>
              <p className="text-lg font-bold text-warning">{previewData.summary.modified_count}</p>
            </div>

            <div 
              onClick={() => setActiveTab('MISSING')}
              className={cn(
                "p-3 rounded-xl border text-center cursor-pointer transition-colors",
                activeTab === 'MISSING' ? "border-indigo-400 bg-indigo-500/15" : "border-border-light bg-bg-surface/40 hover:bg-bg-surface"
              )}
            >
              <p className="text-[11px] font-medium text-indigo-400">Faltantes</p>
              <p className="text-lg font-bold text-indigo-400">{previewData.summary.missing_count}</p>
            </div>

            <div 
              onClick={() => setActiveTab('CONFLICT')}
              className={cn(
                "p-3 rounded-xl border text-center cursor-pointer transition-colors",
                activeTab === 'CONFLICT' ? "border-danger bg-danger/15" : "border-border-light bg-bg-surface/40 hover:bg-bg-surface"
              )}
            >
              <p className="text-[11px] font-medium text-danger">Conflictos</p>
              <p className="text-lg font-bold text-danger">{previewData.summary.conflict_count}</p>
            </div>

            <div 
              onClick={() => setActiveTab('DUPLICATE')}
              className={cn(
                "p-3 rounded-xl border text-center cursor-pointer transition-colors",
                activeTab === 'DUPLICATE' ? "border-danger bg-danger/15" : "border-border-light bg-bg-surface/40 hover:bg-bg-surface"
              )}
            >
              <p className="text-[11px] font-medium text-danger">Duplicados</p>
              <p className="text-lg font-bold text-danger">{previewData.summary.duplicate_count}</p>
            </div>

            <div 
              onClick={() => setActiveTab('NO_DOCUMENT')}
              className={cn(
                "p-3 rounded-xl border text-center cursor-pointer transition-colors",
                activeTab === 'NO_DOCUMENT' ? "border-amber-500 bg-amber-500/15" : "border-border-light bg-bg-surface/40 hover:bg-bg-surface"
              )}
            >
              <p className="text-[11px] font-medium text-amber-500">Sin Doc.</p>
              <p className="text-lg font-bold text-amber-500">{previewData.summary.no_document_count}</p>
            </div>
          </div>

          {/* Missing clients notice banner */}
          {activeTab === 'MISSING' && (
            <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-xs text-indigo-300 flex items-center gap-3">
              <ShieldCheck size={18} className="shrink-0 text-indigo-400" />
              <span>
                <strong>Nota informativa:</strong> Estos {previewData.missing_clients.length} clientes ya están registrados en ZonaFit pero no se encontraron en el Excel. <strong>No serán eliminados ni desactivados.</strong>
              </span>
            </div>
          )}

          {/* Category selection bar */}
          <div className="flex items-center justify-between gap-3 text-xs text-text-muted">
            <span className="font-medium">
              Mostrando {filteredItems.length} registros ({activeTab === 'ALL' ? 'Todas las categorías' : activeTab})
            </span>

            {activeTab === 'NEW' && previewData.summary.new_count > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleSelectAllCategory('NEW', true)}
                  className="text-brand-primary hover:underline font-medium"
                >
                  Seleccionar todos los nuevos
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => toggleSelectAllCategory('NEW', false)}
                  className="text-text-muted hover:underline"
                >
                  Deseleccionar todos
                </button>
              </div>
            )}

            {activeTab === 'MODIFIED' && previewData.summary.modified_count > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleSelectAllCategory('MODIFIED', true)}
                  className="text-brand-primary hover:underline font-medium"
                >
                  Seleccionar todos los modificados
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => toggleSelectAllCategory('MODIFIED', false)}
                  className="text-text-muted hover:underline"
                >
                  Deseleccionar todos
                </button>
              </div>
            )}
          </div>

          {/* Data Table */}
          <div className="border border-border-light rounded-xl overflow-hidden max-h-95 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-bg-elevated/70 text-text-muted border-b border-border-light sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">Sel.</th>
                  <th className="py-2.5 px-3 w-14">Fila</th>
                  <th className="py-2.5 px-3 w-28">Estado</th>
                  <th className="py-2.5 px-3">Documento</th>
                  <th className="py-2.5 px-3">Nombre Completo</th>
                  <th className="py-2.5 px-3">Teléfono</th>
                  <th className="py-2.5 px-3">Detalle / Diferencias</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light/50 bg-bg-surface/30">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-text-muted">
                      No hay registros en esta categoría.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => {
                    const isNew = item.category === 'NEW';
                    const isMod = item.category === 'MODIFIED';
                    const isSelectable = isNew || isMod;
                    const isChecked = isNew
                      ? selectedNewRows.has(item.row_number)
                      : isMod && item.client_id
                      ? selectedModifiedClients.has(item.client_id)
                      : false;

                    return (
                      <tr 
                        key={`${item.category}-${item.row_number}-${item.document}-${idx}`}
                        className={cn(
                          "hover:bg-bg-surface-hover/50 transition-colors",
                          isChecked && "bg-brand-primary/5"
                        )}
                      >
                        {/* Checkbox */}
                        <td className="py-2.5 px-3 text-center">
                          {isSelectable ? (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isNew) toggleSelectNewRow(item.row_number);
                                else if (isMod && item.client_id) toggleSelectModifiedClient(item.client_id);
                              }}
                              className="rounded border-border-medium text-brand-primary focus:ring-brand-primary/30"
                            />
                          ) : (
                            <span className="text-text-muted/40">•</span>
                          )}
                        </td>

                        {/* Fila */}
                        <td className="py-2.5 px-3 font-mono text-text-muted">
                          {item.row_number > 0 ? `#${item.row_number}` : '-'}
                        </td>

                        {/* Categoría Badge */}
                        <td className="py-2.5 px-3">
                          {item.category === 'NO_CHANGE' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-bg-elevated text-text-secondary">
                              Sin Cambios
                            </span>
                          )}
                          {item.category === 'NEW' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success/15 text-success">
                              Nuevo
                            </span>
                          )}
                          {item.category === 'MODIFIED' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warning/15 text-warning">
                              Modificado
                            </span>
                          )}
                          {item.category === 'MISSING' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-400">
                              Faltante
                            </span>
                          )}
                          {item.category === 'CONFLICT' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-danger/15 text-danger">
                              Conflicto
                            </span>
                          )}
                          {item.category === 'DUPLICATE' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-danger/15 text-danger">
                              Duplicado
                            </span>
                          )}
                          {item.category === 'NO_DOCUMENT' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-500">
                              Sin Doc.
                            </span>
                          )}
                        </td>

                        {/* Documento */}
                        <td className="py-2.5 px-3 font-medium text-text-primary">
                          <span className="text-text-muted text-[11px] mr-1">{item.document_type}</span>
                          {item.document || <span className="text-danger italic">Sin documento</span>}
                        </td>

                        {/* Nombre */}
                        <td className="py-2.5 px-3 text-text-primary">
                          {item.full_name}
                        </td>

                        {/* Teléfono */}
                        <td className="py-2.5 px-3 text-text-secondary font-mono">
                          {item.phone || '-'}
                        </td>

                        {/* Diferencias / Conflicto Detalle */}
                        <td className="py-2.5 px-3">
                          {item.conflict_reason ? (
                            <span className="text-danger flex items-center gap-1">
                              <AlertTriangle size={13} className="shrink-0" />
                              <span className="truncate max-w-xs" title={item.conflict_reason}>
                                {item.conflict_reason}
                              </span>
                            </span>
                          ) : item.diffs && Object.keys(item.diffs).length > 0 ? (
                            <div className="space-y-1">
                              {Object.entries(item.diffs).map(([field, d]) => (
                                <div key={field} className="text-[11px] flex items-center gap-1.5">
                                  <span className="font-semibold text-text-muted capitalize w-16">{field}:</span>
                                  <span className="line-through text-danger/80 truncate max-w-25" title={d.old_value || '(vacío)'}>
                                    {d.old_value || '(vacío)'}
                                  </span>
                                  <ArrowRight size={11} className="text-text-muted shrink-0" />
                                  <span className="text-success font-medium truncate max-w-30" title={d.new_value || '(vacío)'}>
                                    {d.new_value || '(vacío)'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : item.category === 'NEW' ? (
                            <span className="text-success text-[11px]">Listo para creación</span>
                          ) : (
                            <span className="text-text-muted text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Selection summary and action footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-border-light">
            <div className="text-xs text-text-secondary">
              Seleccionados para aplicar:{' '}
              <strong className="text-success font-semibold">{selectedNewRows.size} nuevos</strong> y{' '}
              <strong className="text-warning font-semibold">{selectedModifiedClients.size} modificados</strong>.
            </div>

            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => setStep('upload')}>
                Subir otro archivo
              </Button>
              <Button
                variant="primary"
                disabled={selectedNewRows.size === 0 && selectedModifiedClients.size === 0}
                onClick={() => setStep('confirm')}
                className="flex items-center gap-2"
              >
                <span>Revisar y Confirmar ({selectedNewRows.size + selectedModifiedClients.size})</span>
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* PASO 3: CONFIRMACIÓN EXPLÍCITA                                */}
      {/* ------------------------------------------------------------- */}
      {step === 'confirm' && (
        <div className="flex flex-col gap-6 py-4">
          <div className="p-5 rounded-2xl border border-brand-primary/30 bg-brand-primary/5 space-y-3">
            <div className="flex items-center gap-3 text-brand-primary">
              <ShieldCheck size={26} />
              <h3 className="text-base font-bold text-text-primary">Confirmación de Actualización Masiva</h3>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              Vas a crear <strong className="text-success font-semibold">{selectedNewRows.size} clientes nuevos</strong> y actualizar los datos de <strong className="text-warning font-semibold">{selectedModifiedClients.size} clientes existentes</strong>.
            </p>
            <p className="text-xs text-text-muted border-t border-border-light pt-2">
              • Los campos de identidad (<code className="text-brand-primary">document_type</code> y <code className="text-brand-primary">document</code>) no serán alterados.<br />
              • Los clientes que no aparezcan en el archivo <strong className="text-text-primary">NO serán eliminados ni desactivados</strong>.<br />
              • La operación se ejecutará dentro de una transacción atómica segura.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" disabled={isApplying} onClick={() => setStep('preview')}>
              Volver a la previsualización
            </Button>
            <Button
              variant="primary"
              disabled={isApplying}
              onClick={handleApply}
              className="flex items-center gap-2 bg-brand-primary hover:bg-brand-primary/90"
            >
              {isApplying ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Aplicando cambios...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Sí, ejecutar actualización</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

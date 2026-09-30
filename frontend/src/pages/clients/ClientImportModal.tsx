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
        <div className="flex flex-col gap-5 py-2">
          {/* Official template download banner */}
          <div className="flex items-center justify-between p-4 rounded-2xl border border-brand-primary/20 bg-brand-primary/5 shadow-subtle">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary shrink-0">
                <FileSpreadsheet size={20} />
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
              className="shrink-0 flex items-center gap-2 border-brand-primary/30 text-brand-primary hover:bg-brand-primary/10 rounded-xl text-xs"
            >
              <Download size={14} />
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
                : "border-border-medium hover:border-border-strong hover:bg-surface-raised/50"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-14 h-14 rounded-2xl bg-surface-raised flex items-center justify-center text-text-muted mb-3 border border-border-subtle shadow-inner">
              <Upload size={26} className={selectedFile ? "text-brand-primary" : ""} />
            </div>

            {selectedFile ? (
              <div>
                <p className="text-sm font-bold text-text-primary">{selectedFile.name}</p>
                <p className="text-xs text-text-muted mt-1 font-mono">
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
            <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-sm flex items-start gap-3">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Archivo no válido</p>
                <p className="text-xs mt-1 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Missing clients safety note */}
          <div className="flex items-start gap-3 p-3.5 rounded-2xl border border-border-subtle bg-surface-base text-text-secondary text-xs">
            <ShieldCheck size={18} className="text-brand-primary shrink-0 mt-0.5" />
            <p>
              <strong className="text-text-primary font-semibold">Seguridad garantizada:</strong> Los clientes que no aparezcan en el archivo <span className="underline font-semibold text-text-primary">NO serán eliminados ni desactivados</span> de tu gimnasio.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={handleClose} className="rounded-xl text-xs">
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={!selectedFile || isAnalyzing}
              onClick={handleAnalyze}
              className="flex items-center gap-2 rounded-xl text-xs bg-brand-primary hover:bg-brand-primary/90"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Analizando archivo...</span>
                </>
              ) : (
                <>
                  <FileCheck size={15} />
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
        <div className="flex flex-col gap-4 py-1">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            <div
              onClick={() => setActiveTab('ALL')}
              className={cn(
                "p-3 rounded-xl border text-center cursor-pointer transition-colors font-mono",
                activeTab === 'ALL' ? "border-brand-primary bg-brand-primary/10" : "border-border-subtle bg-surface-base hover:bg-surface-raised"
              )}
            >
              <p className="text-[10px] uppercase tracking-wider text-text-muted font-sans font-medium">Total Filas</p>
              <p className="text-lg font-bold text-text-primary mt-0.5">{previewData.summary.total_rows}</p>
            </div>

            <div
              onClick={() => setActiveTab('NO_CHANGE')}
              className={cn(
                "p-3 rounded-xl border text-center cursor-pointer transition-colors font-mono",
                activeTab === 'NO_CHANGE' ? "border-border-strong bg-surface-raised" : "border-border-subtle bg-surface-base hover:bg-surface-raised"
              )}
            >
              <p className="text-[10px] uppercase tracking-wider text-text-muted font-sans font-medium">Sin Cambios</p>
              <p className="text-lg font-bold text-text-secondary mt-0.5">{previewData.summary.no_change_count}</p>
            </div>

            <div
              onClick={() => setActiveTab('NEW')}
              className={cn(
                "p-3 rounded-xl border text-center cursor-pointer transition-colors font-mono",
                activeTab === 'NEW' ? "border-emerald-500/40 bg-emerald-500/15" : "border-border-subtle bg-surface-base hover:bg-surface-raised"
              )}
            >
              <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-sans font-medium">Nuevos</p>
              <p className="text-lg font-bold text-emerald-400 mt-0.5">{previewData.summary.new_count}</p>
            </div>

            <div
              onClick={() => setActiveTab('MODIFIED')}
              className={cn(
                "p-3 rounded-xl border text-center cursor-pointer transition-colors font-mono",
                activeTab === 'MODIFIED' ? "border-amber-500/40 bg-amber-500/15" : "border-border-subtle bg-surface-base hover:bg-surface-raised"
              )}
            >
              <p className="text-[10px] uppercase tracking-wider text-amber-400 font-sans font-medium">Modificados</p>
              <p className="text-lg font-bold text-amber-400 mt-0.5">{previewData.summary.modified_count}</p>
            </div>

            <div
              onClick={() => setActiveTab('MISSING')}
              className={cn(
                "p-3 rounded-xl border text-center cursor-pointer transition-colors font-mono",
                activeTab === 'MISSING' ? "border-indigo-500/40 bg-indigo-500/15" : "border-border-subtle bg-surface-base hover:bg-surface-raised"
              )}
            >
              <p className="text-[10px] uppercase tracking-wider text-indigo-400 font-sans font-medium">Faltantes</p>
              <p className="text-lg font-bold text-indigo-400 mt-0.5">{previewData.summary.missing_count}</p>
            </div>

            <div
              onClick={() => setActiveTab('CONFLICT')}
              className={cn(
                "p-3 rounded-xl border text-center cursor-pointer transition-colors font-mono",
                activeTab === 'CONFLICT' ? "border-rose-500/40 bg-rose-500/15" : "border-border-subtle bg-surface-base hover:bg-surface-raised"
              )}
            >
              <p className="text-[10px] uppercase tracking-wider text-rose-400 font-sans font-medium">Conflictos</p>
              <p className="text-lg font-bold text-rose-400 mt-0.5">{previewData.summary.conflict_count}</p>
            </div>

            <div
              onClick={() => setActiveTab('DUPLICATE')}
              className={cn(
                "p-3 rounded-xl border text-center cursor-pointer transition-colors font-mono",
                activeTab === 'DUPLICATE' ? "border-rose-500/40 bg-rose-500/15" : "border-border-subtle bg-surface-base hover:bg-surface-raised"
              )}
            >
              <p className="text-[10px] uppercase tracking-wider text-rose-400 font-sans font-medium">Duplicados</p>
              <p className="text-lg font-bold text-rose-400 mt-0.5">{previewData.summary.duplicate_count}</p>
            </div>

            <div
              onClick={() => setActiveTab('NO_DOCUMENT')}
              className={cn(
                "p-3 rounded-xl border text-center cursor-pointer transition-colors font-mono",
                activeTab === 'NO_DOCUMENT' ? "border-amber-500/40 bg-amber-500/15" : "border-border-subtle bg-surface-base hover:bg-surface-raised"
              )}
            >
              <p className="text-[10px] uppercase tracking-wider text-amber-400 font-sans font-medium">Sin Doc.</p>
              <p className="text-lg font-bold text-amber-400 mt-0.5">{previewData.summary.no_document_count}</p>
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
          <div className="border border-border-subtle rounded-2xl overflow-hidden max-h-95 overflow-y-auto bg-surface-base shadow-subtle">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-raised text-text-muted border-b border-border-subtle sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th className="py-3 px-3.5 w-10 text-center font-mono">Sel.</th>
                  <th className="py-3 px-3.5 w-14 font-mono">Fila</th>
                  <th className="py-3 px-3.5 w-28 uppercase font-mono tracking-wider text-[11px]">Estado</th>
                  <th className="py-3 px-3.5 uppercase font-mono tracking-wider text-[11px]">Documento</th>
                  <th className="py-3 px-3.5 uppercase font-mono tracking-wider text-[11px]">Nombre Completo</th>
                  <th className="py-3 px-3.5 uppercase font-mono tracking-wider text-[11px]">Teléfono</th>
                  <th className="py-3 px-3.5 uppercase font-mono tracking-wider text-[11px]">Detalle / Diferencias</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle bg-surface-base">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-text-muted">
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
                          "hover:bg-surface-raised/40 transition-colors",
                          isChecked && "bg-brand-primary/5"
                        )}
                      >
                        {/* Checkbox */}
                        <td className="py-2.5 px-3.5 text-center">
                          {isSelectable ? (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isNew) toggleSelectNewRow(item.row_number);
                                else if (isMod && item.client_id) toggleSelectModifiedClient(item.client_id);
                              }}
                              className="rounded border-border-medium text-brand-primary focus:ring-brand-primary/30 cursor-pointer"
                            />
                          ) : (
                            <span className="text-text-muted/40">•</span>
                          )}
                        </td>

                        {/* Fila */}
                        <td className="py-2.5 px-3.5 font-mono text-text-muted text-[11px]">
                          {item.row_number > 0 ? `#${item.row_number}` : '-'}
                        </td>

                        {/* Categoría Badge */}
                        <td className="py-2.5 px-3.5">
                          {item.category === 'NO_CHANGE' && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider font-semibold bg-surface-raised border border-border-subtle text-text-secondary">
                              Sin Cambios
                            </span>
                          )}
                          {item.category === 'NEW' && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                              Nuevo
                            </span>
                          )}
                          {item.category === 'MODIFIED' && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400">
                              Modificado
                            </span>
                          )}
                          {item.category === 'MISSING' && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                              Faltante
                            </span>
                          )}
                          {item.category === 'CONFLICT' && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-400">
                              Conflicto
                            </span>
                          )}
                          {item.category === 'DUPLICATE' && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-400">
                              Duplicado
                            </span>
                          )}
                          {item.category === 'NO_DOCUMENT' && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400">
                              Sin Doc.
                            </span>
                          )}
                        </td>

                        {/* Documento */}
                        <td className="py-2.5 px-3.5 font-medium text-text-primary">
                          <span className="text-text-muted font-mono text-[11px] mr-1">{item.document_type}</span>
                          <span className="font-mono">{item.document || <span className="text-rose-400 italic">Sin documento</span>}</span>
                        </td>

                        {/* Nombre */}
                        <td className="py-2.5 px-3.5 text-text-primary font-medium">
                          {item.full_name}
                        </td>

                        {/* Teléfono */}
                        <td className="py-2.5 px-3.5 text-text-secondary font-mono">
                          {item.phone || '-'}
                        </td>

                        {/* Diferencias / Conflicto Detalle */}
                        <td className="py-2.5 px-3.5">
                          {item.conflict_reason ? (
                            <span className="text-rose-400 flex items-center gap-1 font-mono text-[11px]">
                              <AlertTriangle size={13} className="shrink-0" />
                              <span className="truncate max-w-xs" title={item.conflict_reason}>
                                {item.conflict_reason}
                              </span>
                            </span>
                          ) : item.diffs && Object.keys(item.diffs).length > 0 ? (
                            <div className="space-y-1">
                              {Object.entries(item.diffs).map(([field, d]) => (
                                <div key={field} className="text-[11px] flex items-center gap-1.5 font-mono">
                                  <span className="font-semibold text-text-muted capitalize w-16">{field}:</span>
                                  <span className="line-through text-rose-400/80 truncate max-w-25" title={d.old_value || '(vacío)'}>
                                    {d.old_value || '(vacío)'}
                                  </span>
                                  <ArrowRight size={11} className="text-text-muted shrink-0" />
                                  <span className="text-emerald-400 font-medium truncate max-w-30" title={d.new_value || '(vacío)'}>
                                    {d.new_value || '(vacío)'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : item.category === 'NEW' ? (
                            <span className="text-emerald-400 text-[11px] font-medium">Listo para registrar</span>
                          ) : (
                            <span className="text-text-muted text-[11px] font-mono">—</span>
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-border-subtle">
            <div className="text-xs text-text-secondary font-mono">
              Seleccionados para aplicar:{' '}
              <strong className="text-emerald-400 font-semibold">{selectedNewRows.size} nuevos</strong> y{' '}
              <strong className="text-amber-400 font-semibold">{selectedModifiedClients.size} modificados</strong>.
            </div>

            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => setStep('upload')} className="rounded-xl text-xs">
                Subir otro archivo
              </Button>
              <Button
                variant="primary"
                disabled={selectedNewRows.size === 0 && selectedModifiedClients.size === 0}
                onClick={() => setStep('confirm')}
                className="flex items-center gap-2 rounded-xl text-xs bg-brand-primary hover:bg-brand-primary/90"
              >
                <span>Revisar y Confirmar ({selectedNewRows.size + selectedModifiedClients.size})</span>
                <ArrowRight size={15} />
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
          <div className="p-5 rounded-2xl border border-brand-primary/30 bg-brand-primary/5 space-y-3 shadow-subtle">
            <div className="flex items-center gap-3 text-brand-primary">
              <ShieldCheck size={26} />
              <h3 className="text-base font-bold text-text-primary tracking-tight">Confirmación de Actualización Masiva</h3>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              Vas a crear <strong className="text-emerald-400 font-semibold">{selectedNewRows.size} socios nuevos</strong> y actualizar los datos de <strong className="text-amber-400 font-semibold">{selectedModifiedClients.size} socios existentes</strong>.
            </p>
            <p className="text-xs text-text-muted border-t border-border-subtle pt-3 leading-relaxed">
              • Los campos de identidad (<code className="text-brand-primary font-mono">document_type</code> y <code className="text-brand-primary font-mono">document</code>) no serán alterados.<br />
              • Los clientes que no aparezcan en el archivo <strong className="text-text-primary">NO serán eliminados ni desactivados</strong>.<br />
              • La operación se ejecutará dentro de una transacción atómica protegida.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" disabled={isApplying} onClick={() => setStep('preview')} className="rounded-xl text-xs">
              Volver a la previsualización
            </Button>
            <Button
              variant="primary"
              disabled={isApplying}
              onClick={handleApply}
              className="flex items-center gap-2 rounded-xl text-xs bg-brand-primary hover:bg-brand-primary/90"
            >
              {isApplying ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Aplicando cambios...</span>
                </>
              ) : (
                <>
                  <Check size={15} />
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

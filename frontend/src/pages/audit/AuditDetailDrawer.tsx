import { useState } from 'react';
import {
  ShieldCheck,
  Calendar,
  User,
  Globe,
  Hash,
  Copy,
  Check,
  FileJson,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import type { AuditLog } from '@shared/types/audit';
import { Drawer } from '@shared/ui/Drawer';
import { Avatar } from '@shared/ui/Avatar';
import { Badge } from '@shared/ui/Badge';
import { Button } from '@shared/ui/Button';
import {
  formatAuditDate,
  renderActionBadge,
  renderModuleBadge,
  formatValueForDisplay,
} from './auditHelpers';

interface AuditDetailDrawerProps {
  log: AuditLog | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AuditDetailDrawer({ log, isOpen, onClose }: AuditDetailDrawerProps) {
  const [showRawJson, setShowRawJson] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!log) return null;

  const handleCopyJson = () => {
    const raw = JSON.stringify(
      {
        id: log.id,
        user_name: log.user_name,
        user_id: log.user_id,
        action: log.action,
        module: log.module,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        entity_name: log.entity_name,
        description: log.description,
        status: log.status,
        old_values: log.old_values,
        new_values: log.new_values,
        ip_address: log.ip_address,
        created_at: log.created_at,
      },
      null,
      2
    );
    navigator.clipboard.writeText(raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const oldVals = log.old_values && typeof log.old_values === 'object' ? log.old_values : null;
  const newVals = log.new_values && typeof log.new_values === 'object' ? log.new_values : null;

  // Compute union of keys for diffing
  const allKeys = Array.from(
    new Set([...(oldVals ? Object.keys(oldVals) : []), ...(newVals ? Object.keys(newVals) : [])])
  );

  const hasDiffData = allKeys.length > 0;
  const isComparison = oldVals !== null && newVals !== null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Detalle de Operación Forense"
      size="lg"
      className="bg-bg-surface text-text-primary"
    >
      <div className="flex flex-col gap-6 p-6">
        {/* Top Badges Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border-light">
          <div className="flex flex-wrap items-center gap-2">
            {renderActionBadge(log.action)}
            {renderModuleBadge(log.module)}
            <Badge
              variant={log.status === 'FAILED' ? 'danger' : 'success'}
              className="flex items-center gap-1"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${log.status === 'FAILED' ? 'bg-rose-400' : 'bg-emerald-400'}`} />
              {log.status === 'FAILED' ? 'Fallido' : 'Completado'}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-text-secondary font-mono">
            <Hash size={12} className="text-text-muted" />
            <span>ID: {log.id}</span>
          </div>
        </div>

        {/* Executive Human Description Banner */}
        <div className="p-4 rounded-xl bg-brand-primary/10 border border-brand-primary/25 relative overflow-hidden">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-brand-primary/20 text-brand-primary shrink-0 mt-0.5">
              <ShieldCheck size={20} />
            </div>
            <div>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-brand-primary block mb-1">
                Descripción de la Operación
              </span>
              <p className="text-text-primary text-base font-semibold leading-relaxed">
                {log.description || `${log.action} sobre ${log.entity_type} #${log.entity_id}`}
              </p>
            </div>
          </div>
        </div>

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Operador / Empleado */}
          <div className="p-4 rounded-xl bg-bg-elevated/40 border border-border-light">
            <span className="text-xs text-text-muted font-medium flex items-center gap-1.5 mb-2">
              <User size={13} className="text-brand-primary" />
              Operador Responsable
            </span>
            <div className="flex items-center gap-3">
              <Avatar
                fallback={log.user_name || 'US'}
                className="w-9 h-9 text-xs bg-brand-primary/15 text-brand-primary font-bold border border-brand-primary/30"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">
                  {log.user_name || (log.user_id ? `Usuario #${log.user_id}` : 'Sistema / Tarea Automática')}
                </p>
                <p className="text-xs text-text-muted font-mono">
                  {log.user_id ? `ID Empleado: #${log.user_id}` : 'Operación del Sistema'}
                </p>
              </div>
            </div>
          </div>

          {/* Fecha y Hora */}
          <div className="p-4 rounded-xl bg-bg-elevated/40 border border-border-light">
            <span className="text-xs text-text-muted font-medium flex items-center gap-1.5 mb-2">
              <Calendar size={13} className="text-brand-primary" />
              Fecha y Hora Exacta
            </span>
            <p className="text-sm font-semibold text-text-primary font-mono">
              {formatAuditDate(log.created_at)}
            </p>
            <p className="text-xs text-text-muted mt-1">Hora local de operación</p>
          </div>

          {/* Entidad Afectada */}
          <div className="p-4 rounded-xl bg-bg-elevated/40 border border-border-light">
            <span className="text-xs text-text-muted font-medium flex items-center gap-1.5 mb-2">
              <Layers size={13} className="text-brand-primary" />
              Elemento Afectado
            </span>
            <p className="text-sm font-semibold text-text-primary truncate">
              {log.entity_name || log.entity_type}
            </p>
            <p className="text-xs text-text-muted font-mono mt-0.5">
              Tipo: <span className="text-text-secondary">{log.entity_type}</span>
              {log.entity_id ? ` · ID: #${log.entity_id}` : ''}
            </p>
          </div>

          {/* Dirección IP */}
          <div className="p-4 rounded-xl bg-bg-elevated/40 border border-border-light">
            <span className="text-xs text-text-muted font-medium flex items-center gap-1.5 mb-2">
              <Globe size={13} className="text-brand-primary" />
              Red y Dirección IP
            </span>
            <p className="text-sm font-semibold text-text-primary font-mono">
              {log.ip_address || 'No registrada'}
            </p>
            <p className="text-xs text-text-muted mt-0.5">Origen de la petición HTTP</p>
          </div>
        </div>

        {/* Forensic Data Diff Section */}
        <div className="rounded-xl border border-border-light bg-bg-elevated/30 overflow-hidden">
          <div className="px-4 py-3 bg-bg-elevated/60 border-b border-border-light flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-primary flex items-center gap-2">
              <ShieldCheck size={14} className="text-brand-primary" />
              {isComparison ? 'Comparativa de Modificaciones' : 'Registro de Atributos'}
            </h4>
            <span className="text-[11px] text-text-muted">
              {isComparison ? 'Valor Anterior vs Valor Nuevo' : 'Datos del Evento'}
            </span>
          </div>

          {hasDiffData ? (
            <div className="overflow-x-auto">
              {isComparison ? (
                <table className="w-full text-xs text-left">
                  <thead className="bg-bg-elevated/40 text-text-muted uppercase text-[10px] border-b border-border-light">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Campo</th>
                      <th className="px-4 py-2.5 font-semibold">Valor Anterior</th>
                      <th className="px-4 py-2.5 font-semibold text-center w-8"></th>
                      <th className="px-4 py-2.5 font-semibold">Valor Nuevo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light/60">
                    {allKeys.map((key) => {
                      const oldV = oldVals ? oldVals[key] : undefined;
                      const newV = newVals ? newVals[key] : undefined;
                      const isChanged = JSON.stringify(oldV) !== JSON.stringify(newV);

                      return (
                        <tr
                          key={key}
                          className={`hover:bg-bg-elevated/40 transition-colors ${
                            isChanged ? 'bg-brand-primary/[0.03]' : ''
                          }`}
                        >
                          <td className="px-4 py-2.5 font-mono font-medium text-text-primary">
                            <div className="flex items-center gap-1.5">
                              {key}
                              {isChanged && (
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-primary" title="Modificado" />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-rose-300/80 bg-rose-500/5 max-w-[200px] truncate">
                            {formatValueForDisplay(oldV)}
                          </td>
                          <td className="px-2 py-2.5 text-center text-text-muted">
                            <ArrowRight size={12} className="inline text-text-muted" />
                          </td>
                          <td className="px-4 py-2.5 font-mono text-emerald-300/90 bg-emerald-500/5 max-w-[200px] truncate">
                            {formatValueForDisplay(newV)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead className="bg-bg-elevated/40 text-text-muted uppercase text-[10px] border-b border-border-light">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Campo</th>
                      <th className="px-4 py-2.5 font-semibold">Valor Registrado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light/60">
                    {allKeys.map((key) => {
                      const val = (newVals || oldVals)?.[key];
                      return (
                        <tr key={key} className="hover:bg-bg-elevated/40 transition-colors">
                          <td className="px-4 py-2.5 font-mono font-medium text-text-primary w-1/3">
                            {key}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-emerald-300/90 max-w-[300px] break-words">
                            {formatValueForDisplay(val)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-text-muted text-xs flex items-center justify-center gap-2">
              <Info size={14} />
              No se capturó un diferencial estructurado de valores para esta acción.
            </div>
          )}
        </div>

        {/* Collapsible Raw JSON Inspector */}
        <div className="rounded-xl border border-border-light bg-bg-elevated/20 p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              className="text-xs text-text-secondary hover:text-text-primary font-medium flex items-center gap-1.5 transition-colors"
            >
              <FileJson size={14} className="text-brand-primary" />
              {showRawJson ? 'Ocultar JSON Crudo' : 'Ver Registro JSON Completo'}
            </button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyJson}
              className="text-xs h-7 px-2.5 flex items-center gap-1.5"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copied ? 'Copiado' : 'Copiar JSON'}
            </Button>
          </div>

          {showRawJson && (
            <pre className="mt-3 p-3 bg-bg-surface rounded-lg border border-border-light text-[11px] font-mono text-text-secondary overflow-x-auto max-h-64 leading-tight">
              {JSON.stringify(
                {
                  id: log.id,
                  user_name: log.user_name,
                  user_id: log.user_id,
                  action: log.action,
                  module: log.module,
                  entity_type: log.entity_type,
                  entity_id: log.entity_id,
                  entity_name: log.entity_name,
                  description: log.description,
                  status: log.status,
                  old_values: log.old_values,
                  new_values: log.new_values,
                  ip_address: log.ip_address,
                  created_at: log.created_at,
                },
                null,
                2
              )}
            </pre>
          )}
        </div>
      </div>
    </Drawer>
  );
}

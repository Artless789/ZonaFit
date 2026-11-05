import { ShieldAlert, Eye, User, Globe } from 'lucide-react';
import type { AuditLog } from '@shared/types/audit';
import { Avatar } from '@shared/ui/Avatar';
import { Button } from '@shared/ui/Button';
import { Pagination } from '@shared/ui/Pagination';
import {
  formatAuditDate,
  renderActionBadge,
  renderModuleBadge,
} from './auditHelpers';

interface AuditTableProps {
  logs: AuditLog[];
  totalLogs?: number;
  currentPage?: number;
  totalPages?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onSelectLog: (log: AuditLog) => void;
}

export function AuditTable({
  logs,
  totalLogs = 0,
  currentPage = 1,
  totalPages = 1,
  pageSize = 20,
  onPageChange,
  onSelectLog,
}: AuditTableProps) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-bg-surface rounded-2xl border border-border-medium border-dashed">
        <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center mb-4 text-brand-primary">
          <ShieldAlert size={32} />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">
          Sin registros de auditoría
        </h3>
        <p className="text-text-secondary text-sm max-w-md">
          No se encontraron eventos con los filtros seleccionados o aún no se han registrado operaciones en este período.
        </p>
      </div>
    );
  }

  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalLogs);

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border-light bg-bg-surface shadow-glass">
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left text-sm text-text-secondary">
          <thead className="text-[11px] uppercase tracking-wider bg-bg-elevated/60 text-text-muted border-b border-border-light select-none">
            <tr>
              <th scope="col" className="px-5 py-3.5 font-semibold">
                Fecha y Hora
              </th>
              <th scope="col" className="px-5 py-3.5 font-semibold">
                Operador / Empleado
              </th>
              <th scope="col" className="px-5 py-3.5 font-semibold">
                Módulo
              </th>
              <th scope="col" className="px-5 py-3.5 font-semibold">
                Acción
              </th>
              <th scope="col" className="px-5 py-3.5 font-semibold">
                Descripción de la Acción
              </th>
              <th scope="col" className="px-5 py-3.5 font-semibold text-right">
                Detalle
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light/60">
            {logs.map((log) => {
              const operatorName = log.user_name || (log.user_id ? `Usuario #${log.user_id}` : 'Sistema');
              const initials = operatorName.substring(0, 2).toUpperCase();

              return (
                <tr
                  key={log.id}
                  onClick={() => onSelectLog(log)}
                  className="hover:bg-bg-elevated/40 transition-colors cursor-pointer group"
                >
                  {/* Fecha y Hora */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="font-mono text-xs text-text-primary block">
                      {formatAuditDate(log.created_at)}
                    </span>
                    <span className="text-[11px] text-text-muted font-mono flex items-center gap-1 mt-0.5">
                      <Globe size={10} /> {log.ip_address || 'Local'}
                    </span>
                  </td>

                  {/* Operador / Empleado */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        fallback={initials}
                        className="w-8 h-8 text-[11px] bg-brand-primary/10 text-brand-primary border border-brand-primary/25 font-bold"
                      />
                      <div className="min-w-0">
                        <span className="font-semibold text-text-primary text-xs block truncate max-w-[140px]">
                          {operatorName}
                        </span>
                        <span className="text-[10px] text-text-muted font-mono flex items-center gap-1">
                          <User size={10} />
                          {log.user_id ? `ID #${log.user_id}` : 'Auto'}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Módulo */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    {renderModuleBadge(log.module)}
                  </td>

                  {/* Tipo de Acción */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    {renderActionBadge(log.action)}
                  </td>

                  {/* Descripción Clara */}
                  <td className="px-5 py-4 max-w-md">
                    <p className="text-xs text-text-primary font-medium line-clamp-2 leading-relaxed">
                      {log.description || `${log.action} sobre ${log.entity_type}`}
                    </p>
                    {log.entity_name && (
                      <span className="text-[11px] text-text-muted font-mono mt-0.5 block truncate">
                        Elemento: <span className="text-brand-primary/90 font-medium">{log.entity_name}</span>
                        {log.entity_id ? ` (#${log.entity_id})` : ''}
                      </span>
                    )}
                  </td>

                  {/* Botón Detalle */}
                  <td className="px-5 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSelectLog(log)}
                      className="h-8 px-2.5 text-xs text-text-secondary hover:text-brand-primary hover:bg-brand-primary/10 gap-1.5 transition-colors"
                      title="Ver inspección forense"
                    >
                      <Eye size={14} />
                      <span className="hidden sm:inline">Ver Detalle</span>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {logs.length > 0 && totalLogs > 0 && onPageChange && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-3.5 bg-bg-elevated/40 border-t border-border-light">
          <p className="text-xs text-text-muted text-center sm:text-left font-medium">
            Mostrando <span className="font-semibold text-text-primary">{startRecord}</span> a{' '}
            <span className="font-semibold text-text-primary">{endRecord}</span> de{' '}
            <span className="font-semibold text-text-primary">{totalLogs}</span> eventos registrados
          </p>

          <div className="shrink-0 [&>div]:mt-0">
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}

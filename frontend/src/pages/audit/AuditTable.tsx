import { ShieldAlert, Database, Edit3, Trash2, PlusCircle } from 'lucide-react';
import type { AuditLog } from '@shared/types/audit';
import { Badge } from '@shared/ui/Badge';
import { Pagination } from '@shared/ui/Pagination';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale/es';

interface AuditTableProps {
  logs: AuditLog[];
  totalLogs?: number;
  currentPage?: number;
  totalPages?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
}

export function AuditTable({ 
  logs, 
  totalLogs, 
  currentPage = 1, 
  totalPages = 1, 
  pageSize = 15, 
  onPageChange 
}: AuditTableProps) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-bg-surface rounded-xl border border-border-medium border-dashed">
        <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-brand-primary" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">Sin registros de auditoría</h3>
        <p className="text-text-secondary max-w-sm">
          No hay eventos registrados en el sistema todavía.
        </p>
      </div>
    );
  }

  const formatDate = (isoString: string) => {
    try {
      return format(parseISO(isoString), "d MMM, yyyy - HH:mm:ss", { locale: es });
    } catch {
      return isoString;
    }
  };

  const renderAction = (action: string) => {
    switch (action.toUpperCase()) {
      case 'CREATE':
        return <Badge variant="success" className="flex items-center gap-1 w-fit"><PlusCircle size={12} /> Creación</Badge>;
      case 'UPDATE':
        return <Badge variant="warning" className="flex items-center gap-1 w-fit"><Edit3 size={12} /> Modificación</Badge>;
      case 'DELETE':
        return <Badge variant="danger" className="flex items-center gap-1 w-fit"><Trash2 size={12} /> Eliminación</Badge>;
      default:
        return <Badge variant="default">{action}</Badge>;
    }
  };

  const renderEntity = (entityType: string, entityId?: number | null) => {
    return (
      <div className="flex items-center gap-1.5 text-text-primary font-medium">
        <Database size={14} className="text-text-muted" />
        {entityType}
        {entityId && <span className="text-xs font-mono text-text-muted ml-1">#{entityId}</span>}
      </div>
    );
  };

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border-light bg-bg-surface shadow-glass">
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left text-sm text-text-secondary whitespace-nowrap">
          <thead className="text-xs uppercase bg-bg-elevated/50 text-text-muted border-b border-border-light">
            <tr>
              <th scope="col" className="px-6 py-4 font-semibold">Fecha y Hora</th>
              <th scope="col" className="px-6 py-4 font-semibold">Usuario</th>
              <th scope="col" className="px-6 py-4 font-semibold">Acción</th>
              <th scope="col" className="px-6 py-4 font-semibold">Entidad Afectada</th>
              <th scope="col" className="px-6 py-4 font-semibold">Dirección IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-bg-elevated/30 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-text-primary">
                  {formatDate(log.created_at)}
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-text-primary">
                    {log.user_id ? `Usuario ID: ${log.user_id}` : 'Sistema / API'}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {renderAction(log.action)}
                </td>
                <td className="px-6 py-4">
                  {renderEntity(log.entity_type, log.entity_id)}
                </td>
                <td className="px-6 py-4 font-mono text-xs">
                  {log.ip_address || 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer con Paginación e Información */}
      {logs.length > 0 && totalLogs !== undefined && onPageChange && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-3 bg-bg-elevated/30 border-t border-border-light">
          <p className="text-xs text-text-muted text-center sm:text-left">
            Mostrando <span className="font-semibold text-text-primary">{(currentPage - 1) * pageSize + 1}</span> a{' '}
            <span className="font-semibold text-text-primary">
              {Math.min(currentPage * pageSize, totalLogs)}
            </span>{' '}
            de <span className="font-semibold text-text-primary">{totalLogs}</span> registros
          </p>

          <div className="[&>div]:mt-0 shrink-0">
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

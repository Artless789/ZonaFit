import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, History } from 'lucide-react';
import { Skeleton } from '@shared/ui/Skeleton';
import { Pagination } from '@shared/ui/Pagination';
import { superadminService } from '../../services/superadminService';
import { formatDate } from '@shared/utils/formatters';

export function SuperadminAudit() {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['superadmin-audit', { page, pageSize }],
    queryFn: () => superadminService.getAudit(page, pageSize),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-6">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-8 text-center max-w-lg mx-auto flex flex-col items-center gap-4 mt-8">
        <ShieldAlert className="w-12 h-12 text-danger" />
        <h2 className="text-xl font-bold text-text-primary">Error de Conexión</h2>
        <p className="text-sm text-text-secondary">No se pudo cargar la auditoría.</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-brand-primary text-text-white rounded-md text-sm hover:bg-brand-primary-hover transition-fast"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Auditoría Global</h1>
        <p className="text-text-secondary text-sm mt-1">Registro de actividades de todos los tenants de la plataforma.</p>
      </div>

      <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 overflow-hidden">
        {data?.items.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <History className="w-12 h-12 text-text-muted mb-4" />
            <h3 className="text-lg font-semibold text-text-primary">No hay registros</h3>
            <p className="text-sm text-text-secondary">El historial de auditoría está vacío.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Fecha</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Gimnasio</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Acción</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Entidad</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.items.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 text-sm text-text-secondary whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-text-primary">
                      #{log.gym_id}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-text-primary">
                      {log.action}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {log.entity_type} {log.entity_id ? `(#${log.entity_id})` : ''}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {log.user_id ? `Usuario #${log.user_id}` : 'Sistema'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total_pages > 1 && (
          <div className="border-t border-white/5 p-4 flex justify-center bg-white/[0.01]">
            <Pagination
              page={page}
              totalPages={data.total_pages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}

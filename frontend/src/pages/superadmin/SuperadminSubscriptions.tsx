import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, Receipt } from 'lucide-react';
import { Skeleton } from '@shared/ui/Skeleton';
import { Pagination } from '@shared/ui/Pagination';
import { superadminService } from '../../services/superadminService';
import { Badge } from '@shared/ui/Badge';

export function SuperadminSubscriptions() {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['superadmin-subscriptions', { page, pageSize }],
    queryFn: () => superadminService.getSubscriptions(page, pageSize),
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
        <p className="text-sm text-text-secondary">No se pudieron cargar las suscripciones.</p>
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
        <h1 className="text-3xl font-bold text-text-primary">Suscripciones Globales</h1>
        <p className="text-text-secondary text-sm mt-1">Estado comercial de todos los gimnasios.</p>
      </div>

      <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 overflow-hidden">
        {data?.items.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <Receipt className="w-12 h-12 text-text-muted mb-4" />
            <h3 className="text-lg font-semibold text-text-primary">No hay suscripciones</h3>
            <p className="text-sm text-text-secondary">Aún no se ha registrado ninguna suscripción.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Gimnasio</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Plan</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Estado</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Inicio</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Vencimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.items.map((sub) => (
                  <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-text-primary">#{sub.gym_id}</td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {sub.plan ? sub.plan.name : `#${sub.plan_id}`}
                    </td>
                    <td className="px-6 py-4">
                      {sub.status === 'ACTIVE' && <Badge variant="success">ACTIVO</Badge>}
                      {sub.status === 'TRIAL' && <Badge variant="info">PRUEBA</Badge>}
                      {sub.status === 'PAST_DUE' && <Badge variant="warning">ATRASADO</Badge>}
                      {sub.status === 'CANCELLED' && <Badge variant="danger">CANCELADO</Badge>}
                      {sub.status === 'EXPIRED' && <Badge variant="danger">EXPIRADO</Badge>}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {new Date(sub.starts_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-text-primary">
                      {sub.is_lifetime ? 'Sin vencimiento' : sub.ends_at ? new Date(sub.ends_at).toLocaleDateString() : '-'}
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

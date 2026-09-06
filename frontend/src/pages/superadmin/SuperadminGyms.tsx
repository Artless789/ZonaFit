import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, Building2, Gift } from 'lucide-react';
import { Skeleton } from '@shared/ui/Skeleton';
import { Pagination } from '@shared/ui/Pagination';
import { superadminService } from '../../services/superadminService';
import { Badge } from '@shared/ui/Badge';
import { Modal } from '@shared/ui/Modal';
import { Button } from '@shared/ui/Button';
import { SuperadminGym } from '@shared/types/superadmin';

export function SuperadminGyms() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 10;
  
  const [selectedGym, setSelectedGym] = useState<SuperadminGym | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['superadmin-gyms', { page, pageSize }],
    queryFn: () => superadminService.getGyms(page, pageSize),
  });

  const assignCourtesyMutation = useMutation({
    mutationFn: (gymId: number) => superadminService.assignSubscription(gymId, {
      status: 'ACTIVE',
      starts_at: new Date().toISOString(),
      is_lifetime: true,
      // plan_id is implicitly null or we could fetch the first available active plan, but since it's a courtesy, null plan is fine if backend allows. 
      // Wait, let's verify if plan_id is nullable in the backend for a subscription. 
      // In models/subscription.py: plan_id = Column(Integer, ForeignKey("plans.id"), nullable=True)
      // Yes, nullable=True.
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-gyms'] });
      setSelectedGym(null);
    }
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
        <p className="text-sm text-text-secondary">No se pudieron cargar los gimnasios.</p>
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
        <h1 className="text-3xl font-bold text-text-primary">Gimnasios Registrados</h1>
        <p className="text-text-secondary text-sm mt-1">Directorio global de tenants de la plataforma.</p>
      </div>

      <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 overflow-hidden">
        {data?.items.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <Building2 className="w-12 h-12 text-text-muted mb-4" />
            <h3 className="text-lg font-semibold text-text-primary">No hay gimnasios</h3>
            <p className="text-sm text-text-secondary">Aún no se ha registrado ningún gimnasio en la plataforma.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Gimnasio</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Propietario</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Suscripción</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Onboarding</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Estado</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.items.map((gym) => (
                  <tr key={gym.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-text-primary">{gym.name}</p>
                      <p className="text-xs text-text-muted">ID: #{gym.id}</p>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {gym.owner_name ? (
                        <>
                          <div className="font-medium text-text-primary">{gym.owner_name}</div>
                          <div className="text-xs text-text-muted">{gym.owner_email}</div>
                        </>
                      ) : (
                        <span className="text-xs text-text-muted italic">Sin propietario</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {gym.current_plan_name ? (
                        <>
                          <div className="font-medium text-brand-primary">{gym.current_plan_name}</div>
                          <div className="text-xs mt-1">
                            {gym.subscription_status === 'ACTIVE' && <Badge variant="success">Activa</Badge>}
                            {gym.subscription_status === 'TRIAL' && <Badge variant="info">Trial</Badge>}
                            {gym.subscription_status === 'EXPIRED' && <Badge variant="warning">Vencida</Badge>}
                            {gym.subscription_status === 'CANCELLED' && <Badge variant="danger">Cancelada</Badge>}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-text-muted italic">Sin suscripción</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {gym.onboarding_completed ? (
                        <Badge variant="success">Completado</Badge>
                      ) : (
                        <Badge variant="warning">Pendiente</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {gym.is_active ? (
                        <Badge variant="success">Activo</Badge>
                      ) : (
                        <Badge variant="danger">Inactivo</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedGym(gym as any)}
                        className="p-2 rounded-md hover:bg-white/5 text-text-muted hover:text-brand-primary transition-colors inline-flex items-center"
                        title="Otorgar Cortesía Lifetime"
                      >
                        <Gift size={16} />
                      </button>
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

      {/* Modal Otorgar Cortesía */}
      <Modal
        isOpen={!!selectedGym}
        onClose={() => setSelectedGym(null)}
        title="Otorgar Cortesía Lifetime"
        description={`Estás a punto de otorgar acceso lifetime y gratuito al gimnasio ${selectedGym?.name}. Esta acción no generará cobros recurrentes.`}
      >
        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-white/5">
          <Button variant="ghost" onClick={() => setSelectedGym(null)}>Cancelar</Button>
          <Button 
            variant="primary" 
            onClick={() => selectedGym && assignCourtesyMutation.mutate(selectedGym.id)}
            disabled={assignCourtesyMutation.isPending}
          >
            {assignCourtesyMutation.isPending ? 'Otorgando...' : 'Confirmar Cortesía'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

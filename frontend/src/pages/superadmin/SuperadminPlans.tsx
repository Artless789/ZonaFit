import { Select } from '../../components/shared/Select';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, Package, Plus, Edit2, XCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { GlassCard } from '../../components/shared/GlassCard';
import { Skeleton } from '../../components/shared/Skeleton';
import { Pagination } from '../../components/shared/Pagination';
import { superadminService } from '../../services/superadminService';
import { Badge } from '../../components/shared/Badge';
import { Modal } from '../../components/shared/Modal';
import { Input } from '../../components/shared/Input';
import { Button } from '../../components/shared/Button';
import { SuperadminPlan } from '../../types/superadmin';
import { ActionGlowButton } from '../../components/shared/ActionGlowButton';

type PlanFormData = {
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  billing_interval: 'MONTHLY' | 'YEARLY';
  is_active: boolean;
};

export function SuperadminPlans() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 10;
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SuperadminPlan | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['superadmin-plans', { page, pageSize }],
    queryFn: () => superadminService.getPlans(page, pageSize),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<SuperadminPlan>) => superadminService.createPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-plans'] });
      setIsCreateModalOpen(false);
      resetCreateForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: Partial<SuperadminPlan> }) => superadminService.updatePlan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-plans'] });
      setEditingPlan(null);
    }
  });

  const { register: registerCreate, handleSubmit: handleCreateSubmit, reset: resetCreateForm, formState: { errors: createErrors } } = useForm<PlanFormData>({
    defaultValues: {
      currency: 'COP',
      billing_interval: 'MONTHLY',
      is_active: true
    }
  });

  const { register: registerEdit, handleSubmit: handleEditSubmit, reset: resetEditForm, formState: { errors: editErrors } } = useForm<PlanFormData>();

  const openEditModal = (plan: SuperadminPlan) => {
    setEditingPlan(plan);
    resetEditForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || '',
      price: plan.price,
      currency: plan.currency,
      billing_interval: plan.billing_interval,
      is_active: plan.is_active
    });
  };

  const onSubmitCreate = (data: PlanFormData) => {
    createMutation.mutate(data);
  };

  const onSubmitEdit = (data: PlanFormData) => {
    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, data });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <GlassCard className="p-6">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </GlassCard>
      </div>
    );
  }

  if (isError) {
    return (
      <GlassCard className="p-8 text-center max-w-lg mx-auto flex flex-col items-center gap-4 mt-8">
        <ShieldAlert className="w-12 h-12 text-danger" />
        <h2 className="text-xl font-bold text-text-primary">Error de Conexión</h2>
        <p className="text-sm text-text-secondary">No se pudieron cargar los planes.</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-brand-primary text-text-white rounded-md text-sm hover:bg-brand-primary-hover transition-fast"
        >
          Reintentar
        </button>
      </GlassCard>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Planes Comerciales</h1>
          <p className="text-text-secondary text-sm mt-1">Ofertas comerciales de ZonaFit.</p>
        </div>
        <ActionGlowButton onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2">
          <Plus size={18} />
          Crear Plan
        </ActionGlowButton>
      </div>

      <GlassCard className="overflow-hidden">
        {data?.items.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <Package className="w-12 h-12 text-text-muted mb-4" />
            <h3 className="text-lg font-semibold text-text-primary">No hay planes</h3>
            <p className="text-sm text-text-secondary">Aún no se ha creado ningún plan comercial.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Plan</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Slug</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Precio</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Intervalo</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Estado</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.items.map((plan) => (
                  <tr key={plan.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-text-primary">{plan.name}</p>
                      {plan.description && <p className="text-xs text-text-muted line-clamp-1">{plan.description}</p>}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{plan.slug}</td>
                    <td className="px-6 py-4 text-sm font-medium text-text-primary">
                      {plan.price > 0 ? `${plan.currency} $${plan.price}` : 'Por definir'}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {plan.billing_interval}
                    </td>
                    <td className="px-6 py-4">
                      {plan.is_active ? (
                        <Badge variant="success">Activo</Badge>
                      ) : (
                        <Badge variant="danger">Inactivo</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEditModal(plan)}
                        className="p-2 rounded-md hover:bg-white/5 text-text-muted hover:text-brand-primary transition-colors inline-flex items-center"
                        title="Editar plan"
                      >
                        <Edit2 size={16} />
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
      </GlassCard>

      {/* Modal Crear Plan */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
            setIsCreateModalOpen(false);
            resetCreateForm();
        }}
        title="Crear Nuevo Plan"
        description="Agrega un nuevo plan comercial a la plataforma."
      >
        <form id="create-plan-form" onSubmit={handleCreateSubmit(onSubmitCreate)} className="space-y-4">
          <Input
            label="Nombre del Plan"
            placeholder="Ej: Plan Oro"
            {...registerCreate('name', { required: 'El nombre es requerido' })}
            error={createErrors.name?.message}
          />
          <Input
            label="Slug (identificador único)"
            placeholder="ej: plan-oro"
            {...registerCreate('slug', { required: 'El slug es requerido' })}
            error={createErrors.slug?.message}
          />
          <Input
            label="Descripción"
            placeholder="Beneficios del plan..."
            {...registerCreate('description')}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Precio"
              type="number"
              placeholder="0.00"
              {...registerCreate('price', { required: 'El precio es requerido', valueAsNumber: true })}
              error={createErrors.price?.message}
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-text-primary">Intervalo</label>
              <Select
                {...registerCreate('billing_interval')}
                
              >
                <option value="MONTHLY">Mensual</option>
                <option value="YEARLY">Anual</option>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <input type="checkbox" id="create-active" {...registerCreate('is_active')} className="rounded border-border-medium text-brand-primary focus:ring-brand-primary/50 bg-bg-surface" />
            <label htmlFor="create-active" className="text-sm text-text-primary">Plan Activo (disponible para compra)</label>
          </div>
          
          {createMutation.isError && (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-md text-danger text-sm flex items-center gap-2">
              <XCircle size={16} /> Error al crear el plan. Verifica que el slug no exista.
            </div>
          )}
        </form>
        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-white/5">
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Cancelar</Button>
            <Button form="create-plan-form" type="submit" variant="primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creando...' : 'Crear Plan'}
            </Button>
        </div>
      </Modal>

      {/* Modal Editar Plan */}
      <Modal
        isOpen={!!editingPlan}
        onClose={() => setEditingPlan(null)}
        title="Editar Plan"
        description="Modifica las propiedades del plan."
      >
        <form id="edit-plan-form" onSubmit={handleEditSubmit(onSubmitEdit)} className="space-y-4">
          <Input
            label="Nombre del Plan"
            {...registerEdit('name', { required: 'El nombre es requerido' })}
            error={editErrors.name?.message}
          />
          <Input
            label="Slug (identificador único)"
            {...registerEdit('slug', { required: 'El slug es requerido' })}
            error={editErrors.slug?.message}
          />
          <Input
            label="Descripción"
            {...registerEdit('description')}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Precio"
              type="number"
              {...registerEdit('price', { required: 'El precio es requerido', valueAsNumber: true })}
              error={editErrors.price?.message}
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-text-primary">Intervalo</label>
              <Select
                {...registerEdit('billing_interval')}
                
              >
                <option value="MONTHLY">Mensual</option>
                <option value="YEARLY">Anual</option>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <input type="checkbox" id="edit-active" {...registerEdit('is_active')} className="rounded border-border-medium text-brand-primary focus:ring-brand-primary/50 bg-bg-surface" />
            <label htmlFor="edit-active" className="text-sm text-text-primary">Plan Activo (disponible para compra)</label>
          </div>
          
          {updateMutation.isError && (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-md text-danger text-sm flex items-center gap-2">
              <XCircle size={16} /> Error al actualizar el plan.
            </div>
          )}
        </form>
        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-white/5">
            <Button variant="ghost" onClick={() => setEditingPlan(null)}>Cancelar</Button>
            <Button form="edit-plan-form" type="submit" variant="primary" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
        </div>
      </Modal>

    </div>
  );
}

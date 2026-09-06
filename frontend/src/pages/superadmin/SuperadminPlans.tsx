import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ShieldAlert, 
  Package, 
  Plus, 
  Edit2, 
  XCircle, 
  DollarSign, 
  Sparkles, 
  Star, 
  CheckCircle2, 
  Wand2,
  ListPlus
} from 'lucide-react';
import { useForm } from 'react-hook-form';

import { Skeleton } from '@shared/ui/Skeleton';
import { Pagination } from '@shared/ui/Pagination';
import { superadminService } from '../../services/superadminService';
import { Badge } from '@shared/ui/Badge';
import { Modal } from '@shared/ui/Modal';
import { Input } from '@shared/ui/Input';
import { NumericInput } from '@shared/ui/NumericInput';
import { Button } from '@shared/ui/Button';
import { formatCurrency } from '@shared/utils/formatters';
import { SuperadminPlan, BillingIntervalType } from '@shared/types/superadmin';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';

type PlanFormData = {
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  billing_interval: BillingIntervalType;
  is_active: boolean;
  is_popular: boolean;
  featuresText: string;
};

const SUGGESTED_FEATURES = [
  'Control de acceso con código QR',
  'Gestión de socios y alumnos ilimitada',
  'Módulo de punto de venta (POS) y caja',
  'Facturación e informes financieros en tiempo real',
  'Recordatorios y mensajes automáticos por WhatsApp',
  'Gestión de membresías y vencimientos',
  'Soporte técnico preferencial 24/7'
].join('\n');

const getIntervalShort = (interval: string) => {
  switch (interval) {
    case 'MONTHLY': return 'Mensual';
    case 'BIMONTHLY': return 'Bimestral';
    case 'QUARTERLY': return 'Trimestral';
    case 'SEMIANNUAL': return 'Semestral';
    case 'YEARLY': return 'Anual';
    default: return interval;
  }
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
    mutationFn: (planData: Partial<SuperadminPlan>) => superadminService.createPlan(planData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-plans'] });
      setIsCreateModalOpen(false);
      resetCreateForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: planData }: { id: number, data: Partial<SuperadminPlan> }) => 
      superadminService.updatePlan(id, planData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-plans'] });
      setEditingPlan(null);
    }
  });

  const { 
    register: registerCreate, 
    handleSubmit: handleCreateSubmit, 
    reset: resetCreateForm, 
    setValue: setCreateValue,
    watch: watchCreate,
    formState: { errors: createErrors } 
  } = useForm<PlanFormData>({
    defaultValues: {
      currency: 'COP',
      billing_interval: 'MONTHLY',
      is_active: true,
      is_popular: false,
      featuresText: ''
    }
  });

  const { 
    register: registerEdit, 
    handleSubmit: handleEditSubmit, 
    reset: resetEditForm, 
    setValue: setEditValue,
    watch: watchEdit,
    formState: { errors: editErrors } 
  } = useForm<PlanFormData>();

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  const handleNameChangeCreate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    const currentSlug = watchCreate('slug');
    if (!currentSlug || currentSlug === generateSlug(name.slice(0, -1))) {
      setCreateValue('slug', generateSlug(name));
    }
  };

  const openEditModal = (plan: SuperadminPlan) => {
    setEditingPlan(plan);
    resetEditForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || '',
      price: plan.price,
      currency: plan.currency || 'COP',
      billing_interval: plan.billing_interval,
      is_active: plan.is_active,
      is_popular: !!plan.is_popular,
      featuresText: (plan.features || []).join('\n')
    });
  };

  const onSubmitCreate = (formData: PlanFormData) => {
    const features = formData.featuresText
      ? formData.featuresText.split('\n').map(f => f.trim()).filter(Boolean)
      : [];

    createMutation.mutate({
      name: formData.name,
      slug: formData.slug,
      description: formData.description,
      price: Number(formData.price),
      currency: formData.currency,
      billing_interval: formData.billing_interval,
      is_active: formData.is_active,
      is_popular: formData.is_popular,
      features
    });
  };

  const onSubmitEdit = (formData: PlanFormData) => {
    if (!editingPlan) return;

    const features = formData.featuresText
      ? formData.featuresText.split('\n').map(f => f.trim()).filter(Boolean)
      : [];

    updateMutation.mutate({ 
      id: editingPlan.id, 
      data: {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        price: Number(formData.price),
        currency: formData.currency,
        billing_interval: formData.billing_interval,
        is_active: formData.is_active,
        is_popular: formData.is_popular,
        features
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <div className="rounded-xl border border-border-light bg-bg-surface/40 p-6">
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
      <div className="rounded-xl border border-border-light bg-bg-surface/40 p-8 text-center max-w-lg mx-auto flex flex-col items-center gap-4 mt-8">
        <ShieldAlert className="w-12 h-12 text-danger" />
        <h2 className="text-xl font-bold text-text-primary">Error de Conexión</h2>
        <p className="text-sm text-text-secondary">No se pudieron cargar los planes.</p>
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
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Planes Comerciales</h1>
          <p className="text-text-secondary text-sm mt-1">Ofertas comerciales SaaS y paquetes de suscripción de Merwil ZonaFit.</p>
        </div>
        <ActionGlowButton onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2">
          <Plus size={18} />
          Crear Plan
        </ActionGlowButton>
      </div>

      <div className="rounded-xl border border-border-light bg-bg-surface/40 overflow-hidden">
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
                <tr className="border-b border-white/5 bg-white/2">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Plan</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Slug</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Precio</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Intervalo</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Beneficios</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Estado</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.items.map((plan) => (
                  <tr key={plan.id} className="hover:bg-white/2 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-text-primary">{plan.name}</p>
                        {plan.is_popular && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-brand-primary/20 text-brand-primary border border-brand-primary/30">
                            <Star size={11} className="fill-brand-primary" /> Popular
                          </span>
                        )}
                      </div>
                      {plan.description && <p className="text-xs text-text-muted line-clamp-1 mt-0.5">{plan.description}</p>}
                    </td>
                    <td className="px-6 py-4 text-text-secondary font-mono text-xs">{plan.slug}</td>
                    <td className="px-6 py-4 text-sm font-medium text-text-primary">
                      {plan.price > 0 ? `${plan.currency} ${formatCurrency(plan.price)}` : 'Gratuito'}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      <span className="px-2.5 py-1 rounded-md bg-white/3 border border-border-light text-xs font-medium">
                        {getIntervalShort(plan.billing_interval)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-muted">
                      {plan.features && plan.features.length > 0 ? (
                        <span className="text-xs text-text-secondary flex items-center gap-1">
                          <CheckCircle2 size={13} className="text-success" />
                          {plan.features.length} beneficios
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted italic">Sin lista</span>
                      )}
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
          <div className="border-t border-white/5 p-4 flex justify-center bg-white/1">
            <Pagination
              page={page}
              totalPages={data.total_pages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CREAR PLAN                                                         */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          resetCreateForm();
        }}
        title="Crear Nuevo Plan Comercial"
        containerClassName="max-w-2xl"
        description="Configura una nueva oferta comercial para gimnasios con precios e intervalo personalizados."
      >
        <form id="create-plan-form" onSubmit={handleCreateSubmit(onSubmitCreate)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nombre del Plan"
              placeholder="Ej: Plan Pro Trimestral"
              {...registerCreate('name', { 
                required: 'El nombre es requerido',
                onChange: handleNameChangeCreate
              })}
              error={createErrors.name?.message}
            />
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-text-primary">Slug único</label>
                <button
                  type="button"
                  onClick={() => setCreateValue('slug', generateSlug(watchCreate('name') || ''))}
                  className="text-xs text-brand-primary hover:underline inline-flex items-center gap-1"
                >
                  <Wand2 size={11} /> Auto
                </button>
              </div>
              <Input
                placeholder="ej: plan-pro-trimestral"
                {...registerCreate('slug', { required: 'El slug es requerido' })}
                error={createErrors.slug?.message}
              />
            </div>
          </div>

          <Input
            label="Descripción o Subtítulo"
            placeholder="Ej: Ideal para gimnasios en expansión con múltiples sedes..."
            {...registerCreate('description')}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <NumericInput
              label="Precio"
              placeholder="0.00"
              leftIcon={<DollarSign size={16} />}
              {...registerCreate('price', { required: 'El precio es requerido', valueAsNumber: true })}
              error={createErrors.price?.message}
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-text-primary">Moneda</label>
              <select
                {...registerCreate('currency')}
                className="w-full h-11 px-3 py-2 bg-bg-surface border border-border-medium rounded-md text-sm text-text-primary focus:outline-none focus:border-brand-primary"
              >
                <option value="COP">COP ($ Pesos)</option>
                <option value="USD">USD ($ Dólares)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-text-primary">Intervalo de Pago</label>
              <select
                {...registerCreate('billing_interval')}
                className="w-full h-11 px-3 py-2 bg-bg-surface border border-border-medium rounded-md text-sm text-text-primary focus:outline-none focus:border-brand-primary"
              >
                <option value="MONTHLY">Mensual (1 mes)</option>
                <option value="BIMONTHLY">Bimestral (2 meses)</option>
                <option value="QUARTERLY">Trimestral (3 meses)</option>
                <option value="SEMIANNUAL">Semestral (6 meses)</option>
                <option value="YEARLY">Anual (12 meses)</option>
              </select>
            </div>
          </div>

          {/* Features / Benefits Textarea */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-text-primary">
                Beneficios Incluidos (Uno por línea)
              </label>
              <button
                type="button"
                onClick={() => setCreateValue('featuresText', SUGGESTED_FEATURES)}
                className="text-xs text-brand-primary hover:underline inline-flex items-center gap-1"
              >
                <ListPlus size={12} /> Cargar plantilla sugerida
              </button>
            </div>
            <textarea
              rows={4}
              placeholder={'Control de acceso con código QR\nGestión de socios y alumnos ilimitada\nPunto de venta (POS) y caja\nFacturación e informes financieros...'}
              {...registerCreate('featuresText')}
              className="w-full px-3 py-2 bg-bg-surface border border-border-medium rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary font-mono text-xs leading-relaxed"
            />
            <p className="text-xs text-text-muted">
              Cada línea se convertirá en un beneficio con icono de verificación en la página de precios para tus clientes.
            </p>
          </div>

          {/* Popular and Active Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-white/2 border border-border-light flex items-center justify-between">
              <label htmlFor="create-popular" className="text-sm font-medium text-text-primary cursor-pointer flex items-center gap-2">
                <Star size={16} className="text-brand-primary" />
                Plan Destacado (Popular)
              </label>
              <input 
                type="checkbox" 
                id="create-popular" 
                {...registerCreate('is_popular')} 
                className="w-4 h-4 rounded border-border-medium text-brand-primary focus:ring-brand-primary/50 bg-bg-surface cursor-pointer" 
              />
            </div>

            <div className="p-3 rounded-lg bg-white/2 border border-border-light flex items-center justify-between">
              <label htmlFor="create-active" className="text-sm font-medium text-text-primary cursor-pointer flex items-center gap-2">
                <Sparkles size={16} className="text-success" />
                Plan Activo para Compra
              </label>
              <input 
                type="checkbox" 
                id="create-active" 
                {...registerCreate('is_active')} 
                className="w-4 h-4 rounded border-border-medium text-brand-primary focus:ring-brand-primary/50 bg-bg-surface cursor-pointer" 
              />
            </div>
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

      {/* ========================================================================= */}
      {/* MODAL: EDITAR PLAN                                                         */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!editingPlan}
        onClose={() => setEditingPlan(null)}
        title="Editar Plan Comercial"
        containerClassName="max-w-2xl"
        description="Modifica las propiedades comerciales, precio y beneficios de este plan."
      >
        <form id="edit-plan-form" onSubmit={handleEditSubmit(onSubmitEdit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nombre del Plan"
              {...registerEdit('name', { required: 'El nombre es requerido' })}
              error={editErrors.name?.message}
            />
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-text-primary">Slug único</label>
                <button
                  type="button"
                  onClick={() => setEditValue('slug', generateSlug(watchEdit('name') || ''))}
                  className="text-xs text-brand-primary hover:underline inline-flex items-center gap-1"
                >
                  <Wand2 size={11} /> Auto
                </button>
              </div>
              <Input
                {...registerEdit('slug', { required: 'El slug es requerido' })}
                error={editErrors.slug?.message}
              />
            </div>
          </div>

          <Input
            label="Descripción o Subtítulo"
            {...registerEdit('description')}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <NumericInput
              label="Precio"
              leftIcon={<DollarSign size={16} />}
              {...registerEdit('price', { required: 'El precio es requerido', valueAsNumber: true })}
              error={editErrors.price?.message}
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-text-primary">Moneda</label>
              <select
                {...registerEdit('currency')}
                className="w-full h-11 px-3 py-2 bg-bg-surface border border-border-medium rounded-md text-sm text-text-primary focus:outline-none focus:border-brand-primary"
              >
                <option value="COP">COP ($ Pesos)</option>
                <option value="USD">USD ($ Dólares)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-text-primary">Intervalo de Pago</label>
              <select
                {...registerEdit('billing_interval')}
                className="w-full h-11 px-3 py-2 bg-bg-surface border border-border-medium rounded-md text-sm text-text-primary focus:outline-none focus:border-brand-primary"
              >
                <option value="MONTHLY">Mensual (1 mes)</option>
                <option value="BIMONTHLY">Bimestral (2 meses)</option>
                <option value="QUARTERLY">Trimestral (3 meses)</option>
                <option value="SEMIANNUAL">Semestral (6 meses)</option>
                <option value="YEARLY">Anual (12 meses)</option>
              </select>
            </div>
          </div>

          {/* Features / Benefits Textarea */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-text-primary">
                Beneficios Incluidos (Uno por línea)
              </label>
              <button
                type="button"
                onClick={() => setEditValue('featuresText', SUGGESTED_FEATURES)}
                className="text-xs text-brand-primary hover:underline inline-flex items-center gap-1"
              >
                <ListPlus size={12} /> Cargar plantilla sugerida
              </button>
            </div>
            <textarea
              rows={4}
              {...registerEdit('featuresText')}
              className="w-full px-3 py-2 bg-bg-surface border border-border-medium rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary font-mono text-xs leading-relaxed"
            />
            <p className="text-xs text-text-muted">
              Cada línea se mostrará con un icono de verificación en la página de precios para clientes.
            </p>
          </div>

          {/* Popular and Active Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-white/2 border border-border-light flex items-center justify-between">
              <label htmlFor="edit-popular" className="text-sm font-medium text-text-primary cursor-pointer flex items-center gap-2">
                <Star size={16} className="text-brand-primary" />
                Plan Destacado (Popular)
              </label>
              <input 
                type="checkbox" 
                id="edit-popular" 
                {...registerEdit('is_popular')} 
                className="w-4 h-4 rounded border-border-medium text-brand-primary focus:ring-brand-primary/50 bg-bg-surface cursor-pointer" 
              />
            </div>

            <div className="p-3 rounded-lg bg-white/2 border border-border-light flex items-center justify-between">
              <label htmlFor="edit-active" className="text-sm font-medium text-text-primary cursor-pointer flex items-center gap-2">
                <Sparkles size={16} className="text-success" />
                Plan Activo para Compra
              </label>
              <input 
                type="checkbox" 
                id="edit-active" 
                {...registerEdit('is_active')} 
                className="w-4 h-4 rounded border-border-medium text-brand-primary focus:ring-brand-primary/50 bg-bg-surface cursor-pointer" 
              />
            </div>
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

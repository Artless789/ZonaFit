import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Drawer } from '../../components/shared/Drawer';
import { Select } from '../../components/shared/Select';
import { ClientSearchCombobox } from '../../components/shared/ClientSearchCombobox';
import { ActionGlowButton } from '../../components/shared/ActionGlowButton';
import { useToast } from '../../components/shared/Toast';
import { membershipSchema } from '../../schemas/membershipSchema';
import { useMemberships } from '../../hooks/useMemberships';
import type { Client } from '../../types/client';
import type { MembershipPlan } from '../../types/membershipPlan';

interface MembershipDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  plans: MembershipPlan[];
}

export function MembershipDrawer({ isOpen, onClose, clients, plans }: MembershipDrawerProps) {
  const { toast } = useToast();
  const { createMutation } = useMemberships();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<any>({
    resolver: zodResolver(membershipSchema),
  });

  const selectedClientId = watch('client_id');

  // Reset form when drawer opens
  React.useEffect(() => {
    if (isOpen) {
      reset({ client_id: 0, membership_plan_id: 0, trainer_name: '' });
    }
  }, [isOpen, reset]);

  const onSubmit = async (data: any) => {
    try {
      await createMutation.mutateAsync(data);
      toast({ type: 'success', title: 'Suscripción Creada', message: 'El plan ha sido asignado al cliente exitosamente.' });
      onClose();
    } catch (error: any) {
      toast({
        type: 'error',
        title: 'Error de Asignación',
        message: error.response?.data?.detail || 'No se pudo asignar el plan. Verifica que el cliente no tenga un plan activo.',
      });
    }
  };

  const isSaving = createMutation.isPending;

  // Filter only active plans and active clients for the dropdowns
  const activeClients = clients.filter(c => c.is_active);
  const activePlans = plans.filter(p => p.is_active);

  const planOptions = activePlans.map(p => ({
    value: p.id,
    label: `${p.name} - $${p.price.toLocaleString('es-CO')} (${p.duration_days} días)`
  }));

  return (
    <Drawer 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Asignar Membresía"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
        <div className="flex flex-col gap-6 flex-1">
          <div className="relative z-[var(--z-dropdown)]">
            <label className="block text-sm font-medium text-text-secondary mb-1">Seleccionar Cliente</label>
            <ClientSearchCombobox
              clients={activeClients}
              selectedClientId={selectedClientId}
              onSelect={(id) => setValue('client_id', id || 0, { shouldValidate: true })}
              placeholder="Buscar cliente..."
            />
            {errors.client_id && <p className="mt-1 text-xs text-danger">{errors.client_id.message as string}</p>}
          </div>
          
          <Select
            label="Seleccionar Plan"
            options={planOptions}
            error={!!errors.membership_plan_id}
            helperText={(errors.membership_plan_id?.message as string)}
            disabled={isSaving}
            {...register('membership_plan_id')}
          />
          
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-secondary">Entrenador a Cargo (Opcional)</label>
            <input
              type="text"
              placeholder="Ej. Carlos G."
              className="flex h-10 w-full rounded-xl border border-border-medium bg-bg-surface/60 px-4 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 focus-visible:border-brand-primary transition-all duration-200"
              disabled={isSaving}
              {...register('trainer_name')}
            />
            {errors.trainer_name && <span className="text-xs text-danger">{errors.trainer_name.message as string}</span>}
          </div>

          <div className="mt-4 bg-brand-primary/5 p-4 rounded-lg border border-brand-primary/10">
            <h4 className="text-sm font-semibold text-text-primary mb-2">Información Importante</h4>
            <ul className="text-xs text-text-secondary space-y-2 list-disc pl-4">
              <li>El sistema asignará como fecha de inicio el día de hoy automáticamente.</li>
              <li>La fecha de corte se calculará sumando los días de duración del plan seleccionado.</li>
              <li>Si el cliente ya tiene una membresía activa, ocurrirá un error al intentar asignar otra (debes cancelarla primero).</li>
            </ul>
          </div>
        </div>

        <div className="pt-6 mt-6 border-t border-border-light flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
            disabled={isSaving}
          >
            Cancelar
          </button>
          <ActionGlowButton type="submit" isLoading={isSaving}>
            Asignar Plan
          </ActionGlowButton>
        </div>
      </form>
    </Drawer>
  );
}

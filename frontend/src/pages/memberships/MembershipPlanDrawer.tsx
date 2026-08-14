import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Drawer } from '../../components/shared/Drawer';
import { Input } from '../../components/shared/Input';
import { ActionGlowButton } from '../../components/shared/ActionGlowButton';
import { useToast } from '../../components/shared/Toast';
import { membershipPlanSchema } from '../../schemas/membershipPlanSchema';
import type { MembershipPlan } from '../../types/membershipPlan';
import { useMembershipPlans } from '../../hooks/useMembershipPlans';

interface MembershipPlanDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  plan?: MembershipPlan | null;
}

export function MembershipPlanDrawer({ isOpen, onClose, plan }: MembershipPlanDrawerProps) {
  const { toast } = useToast();
  const { createMutation, updateMutation } = useMembershipPlans();
  const isEditing = !!plan;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<any>({
    resolver: zodResolver(membershipPlanSchema),
    defaultValues: {
      name: '',
      description: '',
      duration_days: 30,
      price: 0,
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (plan) {
        reset({
          name: plan.name,
          description: plan.description || '',
          duration_days: plan.duration_days,
          price: plan.price,
        });
      } else {
        reset({
          name: '',
          description: '',
          duration_days: 30,
          price: 0,
        });
      }
    }
  }, [isOpen, plan, reset]);

  const onSubmit = async (data: any) => {
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: plan.id, data });
        toast({ type: 'success', title: 'Plan Actualizado', message: 'Los datos del plan fueron guardados.' });
      } else {
        await createMutation.mutateAsync(data);
        toast({ type: 'success', title: 'Plan Creado', message: 'El plan de membresía fue registrado exitosamente.' });
      }
      onClose();
    } catch (error: any) {
      toast({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.detail || 'No se pudo guardar la información del plan.',
      });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Drawer 
      isOpen={isOpen} 
      onClose={onClose} 
      title={isEditing ? 'Editar Plan de Membresía' : 'Nuevo Plan de Membresía'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
        <div className="flex flex-col gap-6 flex-1">
          <Input
            label="Nombre del Plan"
            placeholder="Ej. Plan Mensual VIP"
            error={!!errors.name}
            helperText={(errors.name?.message as string)}
            disabled={isSaving}
            {...register('name')}
          />
          
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-muted mb-1">Descripción (Opcional)</label>
            <textarea
              rows={3}
              placeholder="Beneficios, restricciones..."
              className={`w-full rounded-md border ${errors.description ? 'border-danger' : 'border-border-medium'} bg-bg-surface px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary transition-fast disabled:opacity-50`}
              disabled={isSaving}
              {...register('description')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Duración (Días)"
              type="number"
              placeholder="Ej. 30"
              error={!!errors.duration_days}
              helperText={(errors.duration_days?.message as string)}
              disabled={isSaving}
              {...register('duration_days')}
            />
            <Input
              label="Precio Final"
              type="number"
              placeholder="Ej. 100000"
              error={!!errors.price}
              helperText={(errors.price?.message as string)}
              disabled={isSaving}
              {...register('price')}
            />
          </div>
          
          <div className="mt-2 bg-brand-primary/5 p-4 rounded-lg border border-brand-primary/10">
            <p className="text-xs text-text-secondary leading-relaxed">
              <strong>Nota sobre impuestos:</strong> El precio ingresado aquí es el valor total que se le cobrará al cliente. Si configuraste un porcentaje de IVA en los ajustes del gimnasio, el sistema calculará internamente el desglose de subtotal e impuesto en el recibo.
            </p>
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
          <ActionGlowButton type="submit" isLoading={isSaving} disabled={!isDirty && isEditing}>
            {isEditing ? 'Guardar Cambios' : 'Crear Plan'}
          </ActionGlowButton>
        </div>
      </form>
    </Drawer>
  );
}

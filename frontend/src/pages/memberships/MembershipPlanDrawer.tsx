import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Drawer } from '@shared/ui/Drawer';
import { Input } from '@shared/ui/Input';
import { NumericInput } from '@shared/ui/NumericInput';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { DollarSign, Tag, Info } from 'lucide-react';
import { useToast } from '@shared/ui/Toast';
import {
  membershipPlanSchema,
  type MembershipPlanFormValues,
} from '@shared/schemas/membershipPlanSchema';
import type { MembershipPlan } from '@shared/types/membershipPlan';
import { useMembershipPlans } from '../../hooks/useMembershipPlans';

interface MembershipPlanDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  plan?: MembershipPlan | null;
}

export function MembershipPlanDrawer({
  isOpen,
  onClose,
  plan,
}: MembershipPlanDrawerProps) {
  const { toast } = useToast();
  const { createMutation, updateMutation } = useMembershipPlans();
  const isEditing = !!plan;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<MembershipPlanFormValues>({
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

  const onSubmit = async (data: MembershipPlanFormValues) => {
    try {
      if (isEditing && plan) {
        await updateMutation.mutateAsync({ id: plan.id, data });
        toast({
          type: 'success',
          title: 'Plan Actualizado',
          message: 'Los datos del plan fueron guardados exitosamente.',
        });
      } else {
        await createMutation.mutateAsync(data);
        toast({
          type: 'success',
          title: 'Plan Creado',
          message: 'El plan de membresía fue registrado exitosamente.',
        });
      }
      onClose();
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { detail?: string } };
        message?: string;
      };
      toast({
        type: 'error',
        title: 'Error al Guardar',
        message:
          err.response?.data?.detail ||
          err.message ||
          'No se pudo guardar la información del plan.',
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
        <div className="flex flex-col gap-5 flex-1">
          {/* Header pill */}
          <div className="p-3.5 rounded-[var(--radius-lg)] bg-surface-raised border border-border-subtle flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center text-brand-primary">
              <Tag size={16} />
            </div>
            <div className="text-xs text-text-secondary leading-snug">
              {isEditing
                ? 'Actualiza el precio, nombre o duración del plan. Las suscripciones activas conservarán su valor original.'
                : 'Configura un nuevo plan de cobertura para tus clientes.'}
            </div>
          </div>

          <Input
            label="Nombre del Plan"
            placeholder="Ej. Plan Mensual Premium"
            error={!!errors.name}
            helperText={errors.name?.message as string}
            disabled={isSaving}
            {...register('name')}
          />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-0.5">
              Descripción o Beneficios (Opcional)
            </label>
            <textarea
              rows={3}
              placeholder="Detalla acceso a máquinas, clases grupales, restricciones de horario..."
              className={`w-full rounded-[var(--radius-md)] border ${
                errors.description ? 'border-rose-500' : 'border-border-medium'
              } bg-surface-base px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:border-brand-primary transition-all disabled:opacity-50`}
              disabled={isSaving}
              {...register('description')}
            />
            {errors.description && (
              <span className="text-xs text-rose-400">
                {errors.description.message as string}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <Input
              label="Duración (Días)"
              type="number"
              placeholder="Ej. 30"
              error={!!errors.duration_days}
              helperText={errors.duration_days?.message as string}
              disabled={isSaving}
              {...register('duration_days', { valueAsNumber: true })}
            />
            <Controller
              name="price"
              control={control}
              render={({ field }) => (
                <NumericInput
                  label="Precio Catálogo"
                  placeholder="Ej. 100000"
                  leftIcon={<DollarSign size={15} />}
                  error={!!errors.price}
                  helperText={errors.price?.message as string}
                  disabled={isSaving}
                  value={field.value}
                  onChange={(e) => {
                    const rawVal = e.target.value;
                    field.onChange(rawVal === '' ? 0 : parseFloat(rawVal) || 0);
                  }}
                  onBlur={field.onBlur}
                />
              )}
            />
          </div>

          <div className="p-3.5 rounded-[var(--radius-lg)] bg-surface-raised border border-border-subtle flex items-start gap-2.5">
            <Info size={16} className="text-brand-primary shrink-0 mt-0.5" />
            <p className="text-xs text-text-muted leading-relaxed">
              <strong className="text-text-primary">Transparencia comercial:</strong> El precio
              ingresado es el valor base del catálogo. Al afiliar o renovar a un cliente podrás
              aplicar descuentos específicos u opciones de crédito en cuentas por cobrar.
            </p>
          </div>
        </div>

        <div className="pt-4 mt-6 border-t border-border-subtle flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50 cursor-pointer"
            disabled={isSaving}
          >
            Cancelar
          </button>
          <ActionGlowButton
            type="submit"
            isLoading={isSaving}
            disabled={!isDirty && isEditing}
            className="text-xs font-bold"
          >
            {isEditing ? 'Guardar Cambios' : 'Crear Plan'}
          </ActionGlowButton>
        </div>
      </form>
    </Drawer>
  );
}

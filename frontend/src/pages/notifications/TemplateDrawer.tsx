import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Drawer } from '@shared/ui/Drawer';
import { Select } from '@shared/ui/Select';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { useToast } from '@shared/ui/Toast';
import { useNotifications } from '../../hooks/useNotifications';
import { EVENT_TYPE_OPTIONS, CHANNEL_OPTIONS, TEMPLATE_VARIABLES } from '../../services/notificationService';
import type { NotificationTemplate } from '@shared/types/notification';
import { Tag, Sparkles, AlertCircle } from 'lucide-react';

const templateSchema = z.object({
  event_type: z.string().min(1, 'Selecciona un tipo de evento'),
  custom_event_name: z.string().optional(),
  description: z.string().optional(),
  channel: z.string().min(1, 'Selecciona un canal'),
  template_body: z
    .string()
    .min(5, 'El contenido debe tener al menos 5 caracteres')
    .max(4096, 'Máximo 4096 caracteres'),
  is_active: z.boolean().optional(),
}).refine((data) => {
  if (data.event_type === 'CUSTOM' && (!data.custom_event_name || !data.custom_event_name.trim())) {
    return false;
  }
  return true;
}, {
  message: 'Debes ingresar el nombre del evento personalizado',
  path: ['custom_event_name'],
});

type TemplateFormValues = z.infer<typeof templateSchema>;

interface TemplateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editingTemplate?: NotificationTemplate | null;
}

export function TemplateDrawer({ isOpen, onClose, editingTemplate }: TemplateDrawerProps) {
  const { toast } = useToast();
  const { createTemplateMutation, updateTemplateMutation } = useNotifications();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isEditing = !!editingTemplate;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      event_type: 'MEMBERSHIP_EXPIRY',
      custom_event_name: '',
      description: '',
      channel: 'WHATSAPP',
      template_body: '',
      is_active: true,
    },
  });

  const selectedEventType = watch('event_type');
  const isCustomEvent = selectedEventType === 'CUSTOM' || (isEditing && editingTemplate?.event_type.startsWith('CUSTOM_'));
  const templateBody = watch('template_body');

  useEffect(() => {
    if (isOpen) {
      if (editingTemplate) {
        reset({
          event_type: editingTemplate.event_type.startsWith('CUSTOM_') ? 'CUSTOM' : editingTemplate.event_type,
          custom_event_name: editingTemplate.custom_event_name || '',
          description: editingTemplate.description || '',
          channel: editingTemplate.channel,
          template_body: editingTemplate.template_body,
          is_active: editingTemplate.is_active,
        });
      } else {
        reset({
          event_type: 'MEMBERSHIP_EXPIRY',
          custom_event_name: '',
          description: '',
          channel: 'WHATSAPP',
          template_body: '',
          is_active: true,
        });
      }
    }
  }, [isOpen, editingTemplate, reset]);

  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    const current = templateBody || '';

    if (textarea) {
      const start = textarea.selectionStart ?? current.length;
      const end = textarea.selectionEnd ?? current.length;
      const updated = current.substring(0, start) + variable + current.substring(end);
      setValue('template_body', updated, { shouldValidate: true });
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    } else {
      setValue('template_body', current + variable, { shouldValidate: true });
    }
  };

  const onSubmit = async (data: TemplateFormValues) => {
    try {
      if (isEditing && editingTemplate) {
        await updateTemplateMutation.mutateAsync({
          id: editingTemplate.id,
          data: {
            template_body: data.template_body,
            custom_event_name: data.custom_event_name || undefined,
            description: data.description || undefined,
            is_active: data.is_active,
          },
        });
        toast({ type: 'success', title: 'Plantilla Actualizada', message: 'Los cambios han sido guardados.' });
      } else {
        await createTemplateMutation.mutateAsync({
          event_type: data.event_type,
          custom_event_name: data.custom_event_name || undefined,
          description: data.description || undefined,
          channel: data.channel,
          template_body: data.template_body,
        });
        toast({ type: 'success', title: 'Plantilla Creada', message: 'La plantilla fue creada exitosamente.' });
      }
      onClose();
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      toast({
        type: 'error',
        title: 'Error al guardar',
        message: typeof detail === 'string' ? detail : 'No se pudo guardar la plantilla.',
      });
    }
  };

  const isPending = createTemplateMutation.isPending || updateTemplateMutation.isPending;

  const { ref: textareaFormRef, ...restTextareaRegister } = register('template_body');

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Plantilla' : 'Nueva Plantilla'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full gap-5">
        {!isEditing ? (
          <>
            <Select
              label="Tipo de Evento *"
              options={EVENT_TYPE_OPTIONS}
              error={!!errors.event_type}
              helperText={errors.event_type?.message || 'Selecciona el disparador o elige evento personalizado.'}
              disabled={isPending}
              {...register('event_type')}
            />

            {isCustomEvent && (
              <div className="p-4 rounded-xl bg-bg-surface border border-brand-primary/30 space-y-3 animate-in fade-in duration-300">
                <div className="flex items-center gap-1.5 text-brand-primary text-xs font-semibold uppercase tracking-wider">
                  <Sparkles size={14} />
                  Detalles del Evento Personalizado
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Nombre del Evento *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Cumpleaños del cliente, Reto Fit 30 Días"
                    className="w-full px-3 py-2 bg-bg-page border border-border-medium rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand-primary"
                    disabled={isPending}
                    {...register('custom_event_name')}
                  />
                  {errors.custom_event_name && (
                    <p className="text-xs text-danger mt-1 flex items-center gap-1">
                      <AlertCircle size={12} /> {errors.custom_event_name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Descripción
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Mensaje especial para felicitar al usuario en su aniversario"
                    className="w-full px-3 py-2 bg-bg-page border border-border-medium rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand-primary"
                    disabled={isPending}
                    {...register('description')}
                  />
                </div>
              </div>
            )}

            <Select
              label="Canal de Envío *"
              options={CHANNEL_OPTIONS}
              error={!!errors.channel}
              helperText={errors.channel?.message}
              disabled={isPending}
              {...register('channel')}
            />
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="bg-bg-page rounded-lg p-3 border border-border-medium text-sm">
              <p className="text-text-muted text-xs uppercase font-semibold mb-1">Evento</p>
              <p className="text-text-primary font-medium">
                {editingTemplate?.custom_event_name
                  ? `${editingTemplate.custom_event_name} (Personalizado)`
                  : EVENT_TYPE_OPTIONS.find((o) => o.value === editingTemplate?.event_type)?.label || editingTemplate?.event_type}
              </p>
            </div>
            {editingTemplate?.custom_event_name && (
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Nombre del Evento
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-bg-surface border border-border-medium rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand-primary"
                  disabled={isPending}
                  {...register('custom_event_name')}
                />
              </div>
            )}
            <div className="bg-bg-page rounded-lg p-3 border border-border-medium text-sm">
              <p className="text-text-muted text-xs uppercase font-semibold mb-1">Canal</p>
              <p className="text-text-primary font-medium">{editingTemplate?.channel}</p>
            </div>
          </div>
        )}

        {/* Variables helper */}
        <div>
          <label className="text-sm font-medium text-text-muted mb-2 flex items-center gap-1">
            <Tag size={14} /> Variables disponibles
          </label>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_VARIABLES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insertVariable(v)}
                className="text-xs font-mono bg-brand-primary/10 text-brand-primary border border-brand-primary/20 rounded-md px-2 py-1 hover:bg-brand-primary/20 transition-colors cursor-pointer"
                title={`Haz clic para insertar ${v}`}
              >
                {v}
              </button>
            ))}
          </div>
          <p className="text-xs text-text-muted mt-2">
            Haz clic en una variable para insertarla en la posición del cursor.
          </p>
        </div>

        {/* Template body */}
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-sm font-medium text-text-muted">Contenido de la Plantilla *</label>
          <textarea
            ref={(node) => {
              textareaRef.current = node;
              textareaFormRef(node);
            }}
            {...restTextareaRegister}
            rows={8}
            placeholder={
              isCustomEvent
                ? `Hola {client_name} 🎉\n\nDesde {gym_name} queremos desearte un feliz cumpleaños. ¡Gracias por entrenar con nosotros!`
                : `Hola {client_name},\n\nTu membresía en {gym_name} vence el {expiry_date}.\n\nTe esperamos para renovarla. 💪`
            }
            className={`w-full rounded-md border ${
              errors.template_body ? 'border-danger' : 'border-border-medium'
            } bg-bg-surface px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary transition-fast resize-none font-sans disabled:opacity-50`}
            disabled={isPending}
          />
          {errors.template_body && (
            <span className="text-xs text-danger">{errors.template_body.message}</span>
          )}
          <p className="text-xs text-text-muted text-right">{(templateBody || '').length}/4096</p>
        </div>

        {isEditing && (
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div className="relative">
              <input type="checkbox" className="sr-only" disabled={isPending} {...register('is_active')} />
              <div
                className={`w-10 h-5 rounded-full transition-colors ${
                  watch('is_active') ? 'bg-brand-primary' : 'bg-bg-elevated border border-border-medium'
                }`}
              />
              <div
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  watch('is_active') ? 'translate-x-5' : ''
                }`}
              />
            </div>
            <span className="text-sm font-medium text-text-secondary">
              Plantilla {watch('is_active') ? 'Activa' : 'Inactiva'}
            </span>
          </label>
        )}

        <div className="pt-4 mt-auto border-t border-border-light flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50 cursor-pointer"
            disabled={isPending}
          >
            Cancelar
          </button>
          <ActionGlowButton type="submit" isLoading={isPending}>
            {isEditing ? 'Guardar Cambios' : 'Crear Plantilla'}
          </ActionGlowButton>
        </div>
      </form>
    </Drawer>
  );
}


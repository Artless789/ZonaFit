import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Drawer } from '@shared/ui/Drawer';
import { Select } from '@shared/ui/Select';
import { Input } from '@shared/ui/Input';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { useToast } from '@shared/ui/Toast';
import { notificationSendSchema } from '@shared/schemas/notificationSchema';
import type { Client } from '@shared/types/client';
import { useNotifications } from '../../hooks/useNotifications';
import { EVENT_TYPE_OPTIONS } from '../../services/notificationService';
import { Send, Phone, AlertTriangle } from 'lucide-react';
import type { NotificationSendFormValues } from '@shared/schemas/notificationSchema';

interface ManualDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
}

export function ManualDrawer({ isOpen, onClose, clients }: ManualDrawerProps) {
  const { toast } = useToast();
  const { sendMutation, whatsAppStatusQuery } = useNotifications();
  const waConfigured = whatsAppStatusQuery.data?.configured ?? null;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NotificationSendFormValues>({
    resolver: zodResolver(notificationSendSchema),
    defaultValues: {
      event_type: 'GENERAL',
      channel: 'WHATSAPP',
      recipient: '',
      message_body: '',
    },
  });

  const clientId = watch('client_id');

  // Auto-fill recipient phone when client is selected
  useEffect(() => {
    if (clientId) {
      const client = clients.find(c => c.id === Number(clientId));
      if (client?.phone) {
        setValue('recipient', client.phone, { shouldValidate: true });
      }
    }
  }, [clientId, clients, setValue]);

  useEffect(() => {
    if (isOpen) {
      reset({
        client_id: undefined,
        event_type: 'GENERAL',
        channel: 'WHATSAPP',
        recipient: '',
        message_body: '',
      });
    }
  }, [isOpen, reset]);

  const onSubmit = async (data: NotificationSendFormValues) => {
    try {
      await sendMutation.mutateAsync({
        client_id: data.client_id ? Number(data.client_id) : null,
        event_type: data.event_type,
        channel: data.channel,
        recipient: data.recipient,
        message_body: data.message_body,
      });
      toast({
        type: 'success',
        title: 'Notificación Enviada',
        message: waConfigured
          ? 'El mensaje fue enviado vía WhatsApp.'
          : 'Notificación registrada. WhatsApp no configurado — quedará en estado PENDIENTE.',
      });
      onClose();
    } catch (error: any) {
      toast({
        type: 'error',
        title: 'Error de Envío',
        message: error.response?.data?.detail || 'No se pudo enviar la notificación.',
      });
    }
  };

  const isSending = sendMutation.isPending;

  const clientOptions = [
    { value: '', label: '— Sin cliente (envío general) —' },
    ...clients
      .filter(c => c.is_active)
      .map(c => ({ value: String(c.id), label: `${c.full_name} — ${c.phone || 'Sin número'}` })),
  ];

  const messageBody = watch('message_body');

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Enviar Mensaje Manual"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full gap-5">

        {/* WhatsApp Not Configured Warning */}
        {waConfigured === false && (
          <div className="flex items-start gap-2 bg-warning/5 border border-warning/20 rounded-lg p-3 text-warning text-xs">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>
              WhatsApp no está configurado. El mensaje quedará registrado como <strong>PENDIENTE</strong> pero no se enviará.
            </span>
          </div>
        )}

        <Select
          label="Cliente (Opcional)"
          options={clientOptions}
          helperText="Al seleccionar un cliente se autocompletará su número de teléfono."
          disabled={isSending}
          {...register('client_id')}
        />

        <div className="relative">
          <Input
            label="Número de WhatsApp Destino *"
            placeholder="+573001234567"
            error={!!errors.recipient}
            helperText={errors.recipient?.message || 'Formato Colombia: 3001234567 o +573001234567'}
            disabled={isSending}
            {...register('recipient')}
          />
          <Phone className="absolute right-3 top-[34px] text-brand-primary/50" size={18} />
        </div>

        <Select
          label="Tipo de Evento"
          options={EVENT_TYPE_OPTIONS}
          error={!!errors.event_type}
          helperText={errors.event_type?.message}
          disabled={isSending}
          {...register('event_type')}
        />

        {/* Hidden channel field */}
        <input type="hidden" value="WHATSAPP" {...register('channel')} />

        <div className="flex flex-col gap-1 flex-1">
          <label className="text-sm font-medium text-text-muted mb-1">Mensaje *</label>
          <textarea
            rows={6}
            placeholder="Hola {client_name}, te escribimos de {gym_name}..."
            className={`w-full rounded-md border ${errors.message_body ? 'border-danger' : 'border-border-medium'} bg-bg-surface px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary transition-fast disabled:opacity-50 resize-none`}
            disabled={isSending}
            {...register('message_body')}
          />
          {errors.message_body && (
            <span className="text-xs text-danger">{errors.message_body.message as string}</span>
          )}
          <p className="text-xs text-text-muted text-right">{(messageBody || '').length}/4096</p>
        </div>

        <div className="pt-4 border-t border-border-light flex justify-end gap-3 mt-auto">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
            disabled={isSending}
          >
            Cancelar
          </button>
          <ActionGlowButton type="submit" isLoading={isSending}>
            <Send size={16} className="mr-2" />
            {waConfigured === false ? 'Registrar (sin envío)' : 'Enviar Mensaje'}
          </ActionGlowButton>
        </div>
      </form>
    </Drawer>
  );
}

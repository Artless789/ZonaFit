import { useState, useEffect, useId } from 'react';
import { MessageCircle, ExternalLink, AlertTriangle, User as UserIcon, Phone, FileText } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Badge } from './Badge';
import { useToast } from './Toast';
import { communicationService } from '../../services/communicationService';
import { buildWaLink, openWhatsAppLink, isValidWhatsAppPhone, normalizeWhatsAppPhone } from '../utils/whatsapp';
import type { ClientBasicInfo } from '../types/communication';

export interface WhatsAppMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientBasicInfo | null;
  eventType: string;
  eventLabel?: string;
  contextData?: Record<string, any>;
  initialMessage?: string;
  onEditClient?: (clientId: number) => void;
}

const EVENT_LABELS: Record<string, string> = {
  MEMBERSHIP_EXPIRY: 'Recordatorio de vencimiento',
  MEMBERSHIP_EXPIRED: 'Aviso de vencimiento',
  CREDIT_OVERDUE: 'Saldo pendiente',
  PAYMENT_RECEIVED: 'Comprobante de pago',
  WELCOME: 'Bienvenida',
  GENERAL: 'Mensaje directo',
};

export function WhatsAppMessageModal({
  isOpen,
  onClose,
  client,
  eventType,
  eventLabel,
  contextData,
  initialMessage = '',
  onEditClient,
}: WhatsAppMessageModalProps) {
  const [message, setMessage] = useState<string>(initialMessage);
  const [phone, setPhone] = useState<string>(client?.phone || '');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const textareaId = useId();
  const { toast } = useToast();

  const label = eventLabel || EVENT_LABELS[eventType] || 'Comunicación';
  const hasPhone = Boolean(phone && phone.trim());
  const isValidPhone = hasPhone && isValidWhatsAppPhone(phone);

  useEffect(() => {
    if (!isOpen || !client) return;

    setPhone(client.phone || '');

    // If initialMessage was provided explicitly, start with it
    if (initialMessage) {
      setMessage(initialMessage);
    }

    // Call backend to prepare message and resolve gym templates
    let isCancelled = false;
    setIsLoading(true);

    communicationService
      .prepare({
        client_id: client.id,
        event_type: eventType,
        context_data: contextData || {},
      })
      .then((res) => {
        if (!isCancelled) {
          if (res.rendered_message) {
            setMessage(res.rendered_message);
          }
          if (res.phone) {
            setPhone(res.phone);
          }
        }
      })
      .catch((err) => {
        console.warn('Could not load template from backend, using default fallback:', err);
        // Fallback message if backend prepare failed or offline
        if (!isCancelled && !initialMessage) {
          setMessage(`Hola ${client.full_name} 👋\n\nTe escribimos de ZonaFit respecto a tu cuenta.`);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, client?.id, eventType]);

  const handleOpenWhatsApp = () => {
    if (!client || !isValidPhone || isSubmitting || !message.trim()) return;

    setIsSubmitting(true);

    try {
      // 1. Build link synchronously to guarantee no popup blocker interception
      const link = buildWaLink(phone, message);

      // 2. Open WhatsApp immediately
      openWhatsAppLink(link);

      // 3. Record communication intent in backend asynchronously
      communicationService
        .recordOpened({
          client_id: client.id,
          event_type: eventType,
          phone: normalizeWhatsAppPhone(phone),
          message_body: message,
        })
        .catch((err) => {
          console.error('Failed to log WhatsApp communication history:', err);
        });

      // 4. Feedback to administrator
      toast({
        type: 'success',
        title: 'WhatsApp Web abierto',
        message: 'Revisa el mensaje y pulsa Enviar dentro de WhatsApp.',
      });

      onClose();
    } catch (err) {
      console.error('Error opening WhatsApp:', err);
      toast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo abrir WhatsApp Web.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Enviar mensaje por WhatsApp"
      className="max-w-lg w-full"
    >
      <div className="space-y-4">
        {/* Recipient & Event Summary Box */}
        <div className="rounded-xl border border-border-light bg-surface-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <UserIcon className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-text-muted font-medium">Cliente</p>
                <p className="text-sm font-semibold text-text-primary truncate">
                  {client?.full_name || 'Sin cliente'}
                </p>
              </div>
            </div>

            <Badge variant="default" className="bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 font-medium">
              {label}
            </Badge>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border-light text-xs text-text-secondary">
            <Phone className="w-3.5 h-3.5 text-text-muted" />
            <span className="font-mono text-text-primary">
              {hasPhone ? phone : 'Sin teléfono registrado'}
            </span>
            {isValidPhone && (
              <span className="ml-auto text-emerald-400 text-[11px] font-medium">
                Válido para WhatsApp
              </span>
            )}
          </div>
        </div>

        {/* Warning if no phone or invalid phone */}
        {!isValidPhone && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-2 flex-1">
              <p className="text-amber-200 font-medium leading-relaxed">
                Este cliente no tiene un número de WhatsApp registrado o el formato es incorrecto.
              </p>
              {client && onEditClient && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditClient(client.id);
                  }}
                  className="inline-flex items-center gap-1.5 text-amber-300 hover:text-amber-100 font-semibold underline underline-offset-2 transition-colors cursor-pointer"
                >
                  Editar cliente para agregar teléfono
                </button>
              )}
            </div>
          </div>
        )}

        {/* Message Editor */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor={textareaId}
              className="text-xs font-semibold text-text-secondary flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-text-muted" />
              Mensaje preparado
            </label>
            <span className="text-[11px] text-text-muted">
              {message.length} caracteres
            </span>
          </div>

          <div className="relative">
            <textarea
              id={textareaId}
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isLoading || !isValidPhone}
              placeholder={isLoading ? 'Preparando mensaje...' : 'Escribe el mensaje...'}
              className="w-full rounded-xl border border-border-light bg-surface-dark px-3.5 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all resize-y disabled:opacity-50 font-sans"
            />
            {isLoading && (
              <div className="absolute inset-0 bg-surface-dark/70 rounded-xl flex items-center justify-center backdrop-blur-xs">
                <span className="text-xs text-text-muted flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Cargando plantilla...
                </span>
              </div>
            )}
          </div>
          <p className="text-[11px] text-text-muted leading-relaxed">
            Puedes editar el texto antes de abrir la conversación. En WhatsApp podrás pulsar <strong className="text-text-secondary font-medium">Enviar</strong>.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-light">
          <Button
            variant="ghost"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>

          <Button
            variant="primary"
            type="button"
            onClick={handleOpenWhatsApp}
            disabled={!isValidPhone || !message.trim() || isLoading || isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium border-0 shadow-lg shadow-emerald-950/40 gap-2 cursor-pointer disabled:cursor-not-allowed disabled:bg-emerald-900/40"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Abrir en WhatsApp</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </Button>
        </div>
      </div>
    </Modal>
  );
}

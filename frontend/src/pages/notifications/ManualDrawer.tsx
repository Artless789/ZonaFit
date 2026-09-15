import { useState, useEffect, useCallback, useId } from 'react';
import { Drawer } from '@shared/ui/Drawer';
import { Button } from '@shared/ui/Button';
import { Badge } from '@shared/ui/Badge';
import { useToast } from '@shared/ui/Toast';
import { clientService } from '../../services/clientService';
import { communicationService } from '../../services/communicationService';
import { notificationService } from '../../services/notificationService';
import { buildWaLink, openWhatsAppLink, isValidWhatsAppPhone, normalizeWhatsAppPhone } from '@shared/utils/whatsapp';
import type { Client } from '@shared/types/client';
import type { NotificationTemplate } from '@shared/types/notification';
import { 
  MessageCircle, 
  Search, 
  User as UserIcon, 
  Phone, 
  AlertTriangle, 
  ArrowRight, 
  RotateCcw, 
  ExternalLink 
} from 'lucide-react';

interface ManualDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  clients?: Client[];
  onPrepareMessage?: (client: Client, eventType: string) => void;
}

type FilterType = 'all' | 'active' | 'inactive' | 'expiring_membership' | 'expired_membership' | 'pending_balance';

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Activos' },
  { id: 'inactive', label: 'Inactivos' },
  { id: 'expiring_membership', label: 'Por vencer' },
  { id: 'expired_membership', label: 'Vencida' },
  { id: 'pending_balance', label: 'Saldo pendiente' },
];

const STANDARD_EVENT_OPTIONS = [
  { value: 'GENERAL', label: 'Mensaje Directo / General' },
  { value: 'WELCOME', label: 'Bienvenida al Gimnasio' },
  { value: 'MEMBERSHIP_EXPIRY', label: 'Recordatorio de Vencimiento' },
  { value: 'MEMBERSHIP_EXPIRED', label: 'Aviso de Membresía Vencida' },
  { value: 'PAYMENT_RECEIVED', label: 'Confirmación de Pago' },
  { value: 'CREDIT_OVERDUE', label: 'Recordatorio de Saldo Pendiente' },
  { value: 'GROUP_INVITATION', label: 'Invitación a Grupo de WhatsApp' },
];

export function ManualDrawer({ isOpen, onClose }: ManualDrawerProps) {
  const { toast } = useToast();
  const textareaId = useId();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchResults, setSearchResults] = useState<Client[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Progressive Flow State
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [eventType, setEventType] = useState<string>('GENERAL');
  const [message, setMessage] = useState<string>('');
  const [isPreparingMessage, setIsPreparingMessage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom templates list
  const [customTemplates, setCustomTemplates] = useState<NotificationTemplate[]>([]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setActiveFilter('all');
      setSelectedClient(null);
      setEventType('GENERAL');
      setMessage('');
      fetchClients('', 'all');
      notificationService.getTemplates().then((res) => {
        setCustomTemplates(res.items || []);
      }).catch(() => {});
    }
  }, [isOpen]);

  // Remote Search Function
  const fetchClients = useCallback(async (query: string, filter: FilterType) => {
    try {
      setIsSearching(true);
      const filterParam = filter === 'all' ? undefined : filter;
      const response = await clientService.getClients(1, 15, query.trim() || undefined, undefined, filterParam);
      setSearchResults(response.items || []);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search on query/filter change
  useEffect(() => {
    if (!isOpen || selectedClient) return;
    const timer = setTimeout(() => {
      fetchClients(searchTerm, activeFilter);
    }, 280);
    return () => clearTimeout(timer);
  }, [searchTerm, activeFilter, isOpen, selectedClient, fetchClients]);

  // When selectedClient or eventType changes, resolve the template
  useEffect(() => {
    if (!selectedClient) return;

    let isCancelled = false;
    setIsPreparingMessage(true);

    communicationService
      .prepare({
        client_id: selectedClient.id,
        event_type: eventType,
        context_data: {},
      })
      .then((res) => {
        if (!isCancelled && res.rendered_message) {
          setMessage(res.rendered_message);
        }
      })
      .catch((err) => {
        console.warn('Could not resolve template:', err);
        if (!isCancelled) {
          setMessage(`Hola ${selectedClient.full_name} 👋\n\nTe saludamos desde ZonaFit.`);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsPreparingMessage(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedClient, eventType]);

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
  };

  const handleResetClient = () => {
    setSelectedClient(null);
    setMessage('');
    fetchClients(searchTerm, activeFilter);
  };

  const hasPhone = Boolean(selectedClient?.phone && selectedClient.phone.trim());
  const isValidPhone = hasPhone && isValidWhatsAppPhone(selectedClient!.phone!);

  const handleOpenWhatsApp = async () => {
    if (!selectedClient || !selectedClient.phone) {
      toast({
        type: 'error',
        title: 'Sin teléfono',
        message: 'El cliente no tiene un teléfono válido registrado.',
      });
      return;
    }

    if (!isValidPhone) {
      toast({
        type: 'error',
        title: 'Teléfono inválido',
        message: 'El número de teléfono no tiene un formato válido para WhatsApp.',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const link = buildWaLink(selectedClient.phone, message);
      openWhatsAppLink(link);

      // Track as OPENED
      await communicationService.recordOpened({
        client_id: selectedClient.id,
        event_type: eventType,
        phone: normalizeWhatsAppPhone(selectedClient.phone),
        message_body: message,
      });

      toast({
        type: 'success',
        title: 'WhatsApp Abierto',
        message: 'Se abrió WhatsApp con el mensaje precargado. Pulsa Enviar en el chat.',
      });

      onClose();
    } catch {
      toast({
        type: 'warning',
        title: 'WhatsApp Abierto',
        message: 'Se abrió WhatsApp. No se pudo registrar en historial.',
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Build event options (standard + any custom templates)
  const eventOptions = [
    ...STANDARD_EVENT_OPTIONS,
    ...customTemplates
      .filter((t) => t.is_active && t.custom_event_name && !STANDARD_EVENT_OPTIONS.some((o) => o.value === t.event_type))
      .map((t) => ({
        value: t.event_type,
        label: `${t.custom_event_name} (Personalizado)`,
      })),
  ];

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Nuevo Mensaje de WhatsApp" size="md">
      <div className="flex flex-col h-full gap-5">
        {/* Banner */}
        <div className="p-3.5 rounded-xl bg-surface-card border border-border-light text-xs text-text-secondary space-y-1">
          <p className="font-semibold text-text-primary flex items-center gap-1.5">
            <MessageCircle size={15} className="text-emerald-400" />
            Flujo de Mensajería WhatsApp Web
          </p>
          <p className="leading-relaxed text-text-muted">
            Busca un cliente, elige el motivo de la comunicación y edita el mensaje generado antes de abrir la conversación en WhatsApp.
          </p>
        </div>

        {/* STEP 1: Search and Select Client */}
        {!selectedClient ? (
          <div className="flex flex-col gap-4 flex-1 overflow-hidden">
            {/* Filter Pills */}
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Filtrar clientes
              </label>
              <div className="flex flex-wrap gap-1.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActiveFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      activeFilter === f.id
                        ? 'bg-brand-primary text-white shadow-sm'
                        : 'bg-bg-surface border border-border-light text-text-secondary hover:text-text-primary hover:border-border-medium'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Buscar cliente
              </label>
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="🔎 Nombre, documento o teléfono..."
                  className="w-full pl-10 pr-4 py-2.5 bg-bg-surface border border-border-medium rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                  autoFocus
                />
              </div>
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1">
              {isSearching ? (
                <div className="text-center py-8 text-xs text-text-muted animate-pulse">
                  Buscando clientes...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8 text-xs text-text-muted bg-bg-surface/50 rounded-xl border border-dashed border-border-light p-4">
                  No se encontraron clientes con el criterio especificado.
                </div>
              ) : (
                searchResults.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => handleSelectClient(client)}
                    className="flex items-center justify-between p-3 rounded-xl bg-bg-surface border border-border-light hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                        {client.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate group-hover:text-emerald-400 transition-colors">
                          {client.full_name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                          {client.document && (
                            <span>{client.document_type || 'CC'} {client.document}</span>
                          )}
                          {client.phone ? (
                            <span className="flex items-center gap-1 text-text-secondary">
                              <Phone size={11} className="text-emerald-400" />
                              {client.phone}
                            </span>
                          ) : (
                            <span className="text-amber-400">Sin teléfono</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {client.is_active ? (
                        <Badge variant="success" className="text-xs">Activo</Badge>
                      ) : (
                        <Badge variant="warning" className="text-xs">Inactivo</Badge>
                      )}
                      <ArrowRight size={14} className="text-text-muted group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          /* STEP 2: Selected Client + Motive + Message */
          <div className="flex flex-col gap-4 flex-1 overflow-y-auto custom-scrollbar pr-1">
            {/* Selected Client Card */}
            <div className="p-3.5 rounded-xl bg-bg-surface border border-emerald-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm shrink-0">
                  <UserIcon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-text-primary truncate">
                    {selectedClient.full_name}
                  </p>
                  <p className="text-xs text-text-muted flex items-center gap-2 mt-0.5">
                    {selectedClient.document && (
                      <span>{selectedClient.document_type || 'CC'} {selectedClient.document}</span>
                    )}
                    {selectedClient.phone ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-mono">
                        <Phone size={11} /> {selectedClient.phone}
                      </span>
                    ) : (
                      <span className="text-amber-400">Sin teléfono</span>
                    )}
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetClient}
                className="text-xs text-text-muted hover:text-text-primary shrink-0 gap-1"
              >
                <RotateCcw size={12} /> Cambiar
              </Button>
            </div>

            {/* Phone warning */}
            {!hasPhone && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-300">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <p className="font-semibold">Este cliente no tiene un teléfono registrado.</p>
                  <p className="text-text-muted mt-0.5">No se podrá abrir WhatsApp hasta que el cliente tenga un número válido registrado.</p>
                </div>
              </div>
            )}

            {/* Motivo selector */}
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Motivo del Mensaje
              </label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full px-3 py-2.5 bg-bg-surface border border-border-medium rounded-xl text-sm text-text-primary focus:outline-none focus:border-brand-primary"
              >
                {eventOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Message preview / edit */}
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="flex items-center justify-between">
                <label htmlFor={textareaId} className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Mensaje sugerido (Editable)
                </label>
                <span className="text-[11px] text-text-muted">
                  {message.length} caracteres
                </span>
              </div>

              {isPreparingMessage ? (
                <div className="h-36 rounded-xl bg-bg-surface border border-border-medium flex items-center justify-center text-xs text-text-muted animate-pulse">
                  Cargando plantilla...
                </div>
              ) : (
                <textarea
                  id={textareaId}
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escribe o edita el mensaje..."
                  className="w-full p-3.5 bg-bg-surface border border-border-medium rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-emerald-500 leading-relaxed font-sans resize-y"
                />
              )}
            </div>

            {/* Open WhatsApp Button */}
            <div className="pt-3 border-t border-border-light flex items-center justify-end gap-3 mt-auto">
              <Button variant="ghost" onClick={handleResetClient}>
                Volver a buscar
              </Button>

              <Button
                variant="primary"
                onClick={handleOpenWhatsApp}
                disabled={!hasPhone || isPreparingMessage || isSubmitting}
                isLoading={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 cursor-pointer shadow-md disabled:cursor-not-allowed disabled:bg-emerald-900/40"
              >
                <MessageCircle size={16} />
                <span>Abrir en WhatsApp</span>
                <ExternalLink size={14} className="opacity-80" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}


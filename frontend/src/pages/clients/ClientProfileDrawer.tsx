import { useState, useEffect } from 'react';
import { Drawer } from '@shared/ui/Drawer';
import { Modal } from '@shared/ui/Modal';
import { Skeleton } from '@shared/ui/Skeleton';
import { ErrorState } from '@shared/ui/ErrorState';
import { Badge } from '@shared/ui/Badge';
import { formatCurrency } from '@shared/utils/formatters';
import { Button } from '@shared/ui/Button';
import { AuthorizedImage } from '@shared/ui/AuthorizedImage';
import { useToast } from '@shared/ui/Toast';
import { useQueryClient } from '@tanstack/react-query';
import { useClient360 } from '../../hooks/useClients';
import { clientService } from '../../services/clientService';
import { whatsappGroupService } from '../../services/whatsappGroupService';
import type { WhatsAppGroup } from '@shared/types/whatsappGroup';
import type { Client } from '@shared/types/client';
import { 
  User as UserIcon, 
  Phone, 
  Mail, 
  CreditCard, 
  FileText,
  Activity,
  Edit2,
  MessageCircle,
  Users,
} from 'lucide-react';
import { useWhatsAppWeb } from '@/hooks/useWhatsAppWeb';

interface ClientProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  clientId?: number;
  onEditClick: (client: Client) => void;
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
};

export function ClientProfileDrawer({ isOpen, onClose, clientId, onEditClick }: ClientProfileDrawerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: profile, isLoading, isError, error, refetch } = useClient360(isOpen ? clientId : undefined);
  const [activeTab, setActiveTab] = useState<'resumen' | 'membresias' | 'financiero'>('resumen');
  const [isChangeGroupModalOpen, setIsChangeGroupModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null | undefined>(undefined);
  const [availableGroups, setAvailableGroups] = useState<WhatsAppGroup[]>([]);
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  useEffect(() => {
    if (isOpen) {
      whatsappGroupService.getAll(true).then(setAvailableGroups).catch(() => {});
    }
  }, [isOpen]);

  const { openWhatsAppModal, WhatsAppModalComponent } = useWhatsAppWeb(() => {
    if (profile?.client) {
      onEditClick(profile.client);
    }
  });

  const handleSaveGroup = async () => {
    if (!profile?.client) return;
    try {
      setIsSavingGroup(true);
      const newGroupId = selectedGroupId === undefined ? (profile.client.whatsapp_group_id || null) : selectedGroupId;
      await clientService.updateClient(profile.client.id, {
        whatsapp_group_id: newGroupId,
      });
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client360'] });
      toast({ type: 'success', title: 'Grupo Actualizado', message: 'Grupo de invitación actualizado correctamente.' });
      setIsChangeGroupModalOpen(false);
    } catch {
      toast({ type: 'error', title: 'Error', message: 'No se pudo actualizar el grupo del cliente.' });
    } finally {
      setIsSavingGroup(false);
    }
  };

  if (!isOpen) return null;

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col gap-6 p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="w-20 h-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="w-48 h-6" />
              <Skeleton className="w-32 h-4" />
            </div>
          </div>
          <Skeleton className="w-full h-32" />
          <Skeleton className="w-full h-32" />
        </div>
      );
    }

    if (isError || !profile) {
      return (
        <ErrorState 
          title="Error al cargar el perfil"
          error={error}
          onRetry={() => refetch()}
        />
      );
    }

    const { client, current_membership, financial } = profile;

    return (
      <div className="flex flex-col h-full bg-bg-page">
        {/* Header 360 */}
        <div className="p-6 bg-surface-dark border-b border-white/5">
          <div className="flex items-start justify-between">
            <div className="flex gap-5 items-center">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-bg-elevated border-2 border-border-medium flex items-center justify-center shrink-0">
                {client.photo_url ? (
                  <AuthorizedImage src={client.photo_url} alt={client.full_name} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={32} className="text-text-muted" />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold text-text-primary leading-none">{client.full_name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-medium text-text-secondary">{client.document_type} {client.document}</span>
                  {client.is_active ? <Badge variant="success">ACTIVO</Badge> : <Badge variant="danger">INACTIVO</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-text-muted">
                  <span className="flex items-center gap-1"><Phone size={12} /> {client.phone}</span>
                  {client.email && <span className="flex items-center gap-1"><Mail size={12} /> {client.email}</span>}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-bg-elevated border border-border-light text-text-secondary text-[11px]">
                    <Users size={11} className="text-brand-primary" />
                    Grupo: <strong className="text-text-primary font-medium">{client.whatsapp_group_name || 'Sin grupo'}</strong>
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => openWhatsAppModal({
                  client: {
                    id: client.id,
                    full_name: client.full_name,
                    phone: client.phone,
                  },
                  eventType: 'GENERAL',
                  eventLabel: 'Contactar por WhatsApp',
                })}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white border-0 cursor-pointer shadow-md text-xs"
              >
                <MessageCircle size={14} /> WhatsApp
              </Button>

              {client.whatsapp_group_id ? (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openWhatsAppModal({
                      client: {
                        id: client.id,
                        full_name: client.full_name,
                        phone: client.phone,
                      },
                      eventType: 'GROUP_INVITATION',
                      eventLabel: 'Invitar al grupo',
                    })}
                    className="gap-1.5 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                  >
                    <Users size={13} /> Invitar al grupo
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedGroupId(client.whatsapp_group_id);
                      setIsChangeGroupModalOpen(true);
                    }}
                    className="gap-1.5 text-xs text-text-muted hover:text-text-primary"
                  >
                    Cambiar grupo
                  </Button>
                </>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSelectedGroupId(null);
                    setIsChangeGroupModalOpen(true);
                  }}
                  className="gap-1.5 text-xs text-text-secondary border-border-medium hover:bg-bg-elevated"
                >
                  <Users size={13} /> Asignar / Invitar a un grupo
                </Button>
              )}

              <Button variant="outline" size="sm" onClick={() => onEditClick(client)} className="gap-1.5 text-xs">
                <Edit2 size={13} /> Editar
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center px-6 border-b border-white/5 overflow-x-auto custom-scrollbar">
          <button 
            onClick={() => setActiveTab('resumen')}
            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === 'resumen' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`}
          >
            Resumen General
          </button>
          <button 
            onClick={() => setActiveTab('membresias')}
            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === 'membresias' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`}
          >
            Historial de Membresías
          </button>
          <button 
            onClick={() => setActiveTab('financiero')}
            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === 'financiero' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`}
          >
            Balance Financiero
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {activeTab === 'resumen' && (
            <div className="flex flex-col gap-6">
              
              <div className="grid grid-cols-2 gap-4">
                {/* Membresía Actual */}
                <div className="p-4 rounded-xl bg-bg-surface border border-white/5">
                  <h3 className="text-xs font-semibold text-text-muted uppercase mb-4 flex items-center gap-2"><Activity size={14} /> Estado de Membresía</h3>
                  {current_membership ? (
                    <div>
                      <p className="text-lg font-bold text-text-primary">{current_membership.plan_name}</p>
                      <div className="mt-2 flex items-center gap-2">
                        {current_membership.status === 'ACTIVE' ? <Badge variant="success">Activa</Badge> : <Badge variant="warning">{current_membership.status}</Badge>}
                        {current_membership.days_left > 0 ? (
                          <span className="text-xs font-medium text-warning">Vence en {current_membership.days_left} días</span>
                        ) : (
                          <span className="text-xs font-medium text-danger">Vencida</span>
                        )}
                      </div>
                      <div className="mt-4 space-y-1 text-sm text-text-secondary">
                        <p>Inicio: <span className="text-text-primary">{formatDate(current_membership.start_date)}</span></p>
                        <p>Fin: <span className="text-text-primary">{formatDate(current_membership.end_date)}</span></p>
                        {current_membership.trainer_name && <p>Trainer: <span className="text-text-primary">{current_membership.trainer_name}</span></p>}
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center text-text-muted text-sm">Sin membresía activa</div>
                  )}
                </div>

                {/* Resumen Financiero */}
                <div className="p-4 rounded-xl bg-bg-surface border border-white/5">
                  <h3 className="text-xs font-semibold text-text-muted uppercase mb-4 flex items-center gap-2"><CreditCard size={14} /> Resumen Financiero</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-text-muted">Total Aportado</p>
                      <p className="text-lg font-bold text-success">{formatCurrency(financial.total_paid)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-text-muted">Saldo Pendiente</p>
                        <p className={`text-sm font-semibold ${financial.pending_balance > 0 ? 'text-warning' : 'text-text-primary'}`}>{formatCurrency(financial.pending_balance)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-text-muted">Saldo en Mora</p>
                        <p className={`text-sm font-semibold ${financial.overdue_balance > 0 ? 'text-danger' : 'text-text-primary'}`}>{formatCurrency(financial.overdue_balance)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detalles adicionales */}
              <div className="p-4 rounded-xl bg-bg-surface border border-white/5">
                <h3 className="text-xs font-semibold text-text-muted uppercase mb-4 flex items-center gap-2"><FileText size={14} /> Información Adicional</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-text-muted">Registrado el</p>
                    <p className="font-medium text-text-primary mt-1">{formatDate(client.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Última compra</p>
                    <p className="font-medium text-text-primary mt-1">{financial.last_purchase_date ? formatDate(financial.last_purchase_date) : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Último pago</p>
                    <p className="font-medium text-text-primary mt-1">{financial.last_payment_date ? formatDate(financial.last_payment_date) : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Créditos Activos</p>
                    <p className="font-medium text-text-primary mt-1">{financial.active_credits_count}</p>
                  </div>
                </div>
                {client.notes && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <p className="text-xs text-text-muted mb-1">Notas</p>
                    <p className="text-sm text-text-secondary whitespace-pre-line">{client.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'membresias' && (
            <div className="text-center py-10 text-text-muted">
              {/* Para la fase de Membresías profesionales, aquí se montará el componente de historial o lista */}
              <p className="text-sm">Módulo de historial de membresías próximamente incrustado aquí.</p>
              <Button className="mt-4 mx-auto" onClick={() => {}}>Nueva Membresía</Button>
            </div>
          )}

          {activeTab === 'financiero' && (
            <div className="text-center py-10 text-text-muted">
              {/* Para pagos, ventas y créditos */}
              <p className="text-sm">Historial de transacciones financieras próximamente incrustado aquí.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Drawer 
      isOpen={isOpen} 
      onClose={onClose} 
      title={""} // Ocultar título genérico, lo hacemos custom arriba
      hideHeader={true}
      size="lg" // Hacerlo más ancho
    >
      {renderContent()}

      {/* Modal Cambiar Grupo */}
      <Modal
        isOpen={isChangeGroupModalOpen}
        onClose={() => setIsChangeGroupModalOpen(false)}
        title="Grupo de WhatsApp del Cliente"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsChangeGroupModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              isLoading={isSavingGroup}
              onClick={handleSaveGroup}
            >
              Guardar Grupo
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Selecciona el grupo de invitación asociado al cliente. Esto permite preparar invitaciones con el enlace correspondiente. Recuerda que no se agrega al cliente de forma automática a WhatsApp.
          </p>
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
              Grupo de invitación
            </label>
            <select
              value={selectedGroupId === null || selectedGroupId === undefined ? '' : selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2.5 bg-bg-surface border border-border-medium rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand-primary"
            >
              <option value="">No agregar a ningún grupo</option>
              {availableGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      <WhatsAppModalComponent />
    </Drawer>
  );
}


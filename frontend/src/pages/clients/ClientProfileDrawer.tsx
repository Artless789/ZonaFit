import { useState, useEffect } from 'react';
import { Drawer } from '@shared/ui/Drawer';
import { Modal } from '@shared/ui/Modal';
import { Skeleton } from '@shared/ui/Skeleton';
import { ErrorState } from '@shared/ui/ErrorState';
import { StatusBadge } from '@shared/ui/StatusBadge';
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
  Clock,
  Calendar,
  DollarSign
} from 'lucide-react';
import { useWhatsAppWeb } from '@/hooks/useWhatsAppWeb';
import { cn } from '@shared/utils/cn';

interface ClientProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  clientId?: number;
  onEditClick: (client: Client) => void;
}

const formatDate = (dateString?: string | null) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  } catch {
    return 'Fecha inválida';
  }
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
        <div className="flex flex-col gap-6 p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="w-20 h-20 rounded-2xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="w-48 h-6 rounded-lg" />
              <Skeleton className="w-32 h-4 rounded-lg" />
            </div>
          </div>
          <Skeleton className="w-full h-36 rounded-2xl" />
          <Skeleton className="w-full h-36 rounded-2xl" />
        </div>
      );
    }

    if (isError || !profile) {
      return (
        <div className="p-6">
          <ErrorState
            title="Error al cargar el perfil 360"
            error={error}
            onRetry={() => refetch()}
          />
        </div>
      );
    }

    const { client, current_membership, financial } = profile;

    return (
      <div className="flex flex-col h-full bg-surface-base text-text-primary">
        {/* Header 360 - Hero Section */}
        <div className="p-6 bg-surface-panel/90 border-b border-border-subtle backdrop-blur-md">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
            <div className="flex gap-4 items-center">
              {/* Photo Avatar */}
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-surface-base border-2 border-border-medium flex items-center justify-center shrink-0 shadow-inner group">
                {client.photo_url ? (
                  <AuthorizedImage
                    src={client.photo_url}
                    alt={client.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserIcon size={36} className="text-text-muted/60" />
                )}
              </div>

              {/* Identity & Status */}
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-2xl font-extrabold text-text-primary tracking-tight leading-tight">
                    {client.full_name}
                  </h2>
                  {client.is_active ? (
                    <StatusBadge status="active" label="Cuenta Activa" />
                  ) : (
                    <StatusBadge status="neutral" label="Suspendido" />
                  )}
                </div>

                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-surface-raised border border-border-subtle text-text-secondary font-medium">
                    {client.document_type} {client.document}
                  </span>
                  {client.whatsapp_group_name && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                      <Users size={11} />
                      {client.whatsapp_group_name}
                    </span>
                  )}
                </div>

                {/* Contact row */}
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-text-muted">
                  <span className="flex items-center gap-1 font-mono">
                    <Phone size={12} className="text-text-muted" />
                    {client.phone}
                  </span>
                  {client.email && (
                    <span className="flex items-center gap-1 font-mono">
                      <Mail size={12} className="text-text-muted" />
                      {client.email}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white border-0 cursor-pointer shadow-sm text-xs rounded-xl"
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
                    className="gap-1.5 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 rounded-xl"
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
                    className="gap-1.5 text-xs text-text-muted hover:text-text-primary rounded-xl"
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
                  className="gap-1.5 text-xs text-text-secondary border-border-medium hover:bg-surface-raised rounded-xl"
                >
                  <Users size={13} /> Asignar a un grupo
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditClick(client)}
                className="gap-1.5 text-xs border-border-medium rounded-xl text-text-secondary hover:text-text-primary"
              >
                <Edit2 size={13} /> Editar Socio
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-6 border-b border-border-subtle bg-surface-panel/40 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('resumen')}
            className={cn(
              "px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 whitespace-nowrap transition-colors cursor-pointer",
              activeTab === 'resumen'
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-text-muted hover:text-text-secondary"
            )}
          >
            Resumen General 360
          </button>
          <button
            onClick={() => setActiveTab('membresias')}
            className={cn(
              "px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 whitespace-nowrap transition-colors cursor-pointer",
              activeTab === 'membresias'
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-text-muted hover:text-text-secondary"
            )}
          >
            Membresía & Vigencia
          </button>
          <button
            onClick={() => setActiveTab('financiero')}
            className={cn(
              "px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 whitespace-nowrap transition-colors cursor-pointer",
              activeTab === 'financiero'
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-text-muted hover:text-text-secondary"
            )}
          >
            Balance Financiero & CxC
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
          {activeTab === 'resumen' && (
            <div className="flex flex-col gap-6">

              {/* Dual Cards: Membresía Actual + Resumen Financiero */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Membresía Actual */}
                <div className="p-5 rounded-2xl bg-surface-panel/80 border border-border-subtle shadow-subtle flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-mono uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                        <Activity size={14} className="text-brand-primary" />
                        Membresía Actual
                      </span>
                      {current_membership && (
                        current_membership.days_left > 7 ? (
                          <StatusBadge status="active" label="Activa" />
                        ) : current_membership.days_left > 0 ? (
                          <StatusBadge status="warning" label="Por vencer" />
                        ) : (
                          <StatusBadge status="danger" label="Vencida" />
                        )
                      )}
                    </div>

                    {current_membership ? (
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-lg font-bold text-text-primary tracking-tight">
                            {current_membership.plan_name}
                          </h4>
                          <p className="text-xs text-text-muted mt-0.5">
                            {current_membership.trainer_name ? `Entrenador: ${current_membership.trainer_name}` : 'Sin entrenador asignado'}
                          </p>
                        </div>

                        <div className="p-3 rounded-xl bg-surface-base border border-border-subtle flex items-center justify-between">
                          <span className="text-xs text-text-secondary">Días restantes:</span>
                          <span className={cn(
                            "font-mono font-bold text-sm",
                            current_membership.days_left > 7
                              ? "text-emerald-400"
                              : current_membership.days_left > 0
                              ? "text-amber-400"
                              : "text-rose-400"
                          )}>
                            {current_membership.days_left > 0
                              ? `${current_membership.days_left} días de vigencia`
                              : 'Membresía finalizada'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                          <div>
                            <span className="text-text-muted block text-[11px]">Inicio</span>
                            <span className="text-text-secondary">{formatDate(current_membership.start_date)}</span>
                          </div>
                          <div>
                            <span className="text-text-muted block text-[11px]">Vencimiento</span>
                            <span className="text-text-secondary">{formatDate(current_membership.end_date)}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-text-muted text-xs flex flex-col items-center justify-center">
                        <Clock size={28} className="text-text-muted/40 mb-2" />
                        <span>Sin membresía activa en este momento</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Resumen Financiero */}
                <div className="p-5 rounded-2xl bg-surface-panel/80 border border-border-subtle shadow-subtle flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-mono uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                        <CreditCard size={14} className="text-emerald-400" />
                        Estado Financiero
                      </span>
                      {financial.pending_balance > 0 ? (
                        <StatusBadge status="warning" label="Saldo Pendiente" />
                      ) : (
                        <StatusBadge status="active" label="Al Día" />
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <span className="text-xs text-text-muted">Total Aportado Histórico</span>
                        <h4 className="text-2xl font-bold font-mono text-emerald-400 tracking-tight mt-0.5">
                          {formatCurrency(financial.total_paid)}
                        </h4>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="p-3 rounded-xl bg-surface-base border border-border-subtle">
                          <span className="text-[11px] text-text-muted block">Saldo Pendiente (CxC)</span>
                          <span className={cn(
                            "font-mono font-bold text-sm",
                            financial.pending_balance > 0 ? "text-amber-400" : "text-text-secondary"
                          )}>
                            {formatCurrency(financial.pending_balance)}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-surface-base border border-border-subtle">
                          <span className="text-[11px] text-text-muted block">Saldo en Mora</span>
                          <span className={cn(
                            "font-mono font-bold text-sm",
                            financial.overdue_balance > 0 ? "text-rose-400" : "text-text-secondary"
                          )}>
                            {formatCurrency(financial.overdue_balance)}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-text-muted flex items-center justify-between pt-1">
                        <span>Créditos / Deudas Activas:</span>
                        <span className="font-mono font-semibold text-text-primary">{financial.active_credits_count}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Información de Auditoría y Fechas */}
              <div className="p-5 rounded-2xl bg-surface-panel/80 border border-border-subtle shadow-subtle">
                <span className="text-xs font-mono uppercase tracking-wider text-text-muted flex items-center gap-1.5 mb-4">
                  <FileText size={14} className="text-text-muted" />
                  Actividad & Fechas Clave
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-surface-base border border-border-subtle">
                    <span className="text-text-muted text-[11px] block">Afiliado desde</span>
                    <span className="font-medium text-text-primary mt-1 block">{formatDate(client.created_at)}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-base border border-border-subtle">
                    <span className="text-text-muted text-[11px] block">Último Pago</span>
                    <span className="font-medium text-text-primary mt-1 block">{formatDate(financial.last_payment_date)}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-base border border-border-subtle">
                    <span className="text-text-muted text-[11px] block">Última Compra POS</span>
                    <span className="font-medium text-text-primary mt-1 block">{formatDate(financial.last_purchase_date)}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-base border border-border-subtle">
                    <span className="text-text-muted text-[11px] block">Última Modificación</span>
                    <span className="font-medium text-text-primary mt-1 block">{formatDate(client.updated_at)}</span>
                  </div>
                </div>

                {client.notes && (
                  <div className="mt-4 pt-4 border-t border-border-subtle">
                    <span className="text-xs font-mono text-text-muted uppercase tracking-wider block mb-1.5">
                      Notas & Observaciones
                    </span>
                    <div className="p-3.5 rounded-xl bg-surface-base border border-border-subtle text-xs text-text-secondary leading-relaxed whitespace-pre-line">
                      {client.notes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'membresias' && (
            <div className="p-6 rounded-2xl bg-surface-panel/80 border border-border-subtle shadow-subtle space-y-4">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-brand-primary" />
                <h3 className="text-base font-bold text-text-primary">Detalle de Membresía Actual</h3>
              </div>

              {current_membership ? (
                <div className="space-y-4 text-sm">
                  <div className="p-4 rounded-xl bg-surface-base border border-border-subtle space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-text-primary">{current_membership.plan_name}</span>
                      <StatusBadge
                        status={current_membership.status === 'ACTIVE' ? 'active' : 'neutral'}
                        label={current_membership.status}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs font-mono pt-2 border-t border-border-subtle">
                      <div>
                        <span className="text-text-muted block">Fecha de Inicio</span>
                        <span className="text-text-primary font-semibold">{formatDate(current_membership.start_date)}</span>
                      </div>
                      <div>
                        <span className="text-text-muted block">Fecha de Vencimiento</span>
                        <span className="text-text-primary font-semibold">{formatDate(current_membership.end_date)}</span>
                      </div>
                      <div>
                        <span className="text-text-muted block">Días Restantes</span>
                        <span className={cn(
                          "font-bold",
                          current_membership.days_left > 7 ? "text-emerald-400" : current_membership.days_left > 0 ? "text-amber-400" : "text-rose-400"
                        )}>
                          {current_membership.days_left} días
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted block">Entrenador Responsable</span>
                        <span className="text-text-primary">{current_membership.trainer_name || 'Sin entrenador'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-text-muted text-xs">
                  El socio no cuenta con una membresía activa actualmente.
                </div>
              )}
            </div>
          )}

          {activeTab === 'financiero' && (
            <div className="p-6 rounded-2xl bg-surface-panel/80 border border-border-subtle shadow-subtle space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign size={18} className="text-emerald-400" />
                <h3 className="text-base font-bold text-text-primary">Detalle Financiero & Cuentas por Cobrar</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-surface-base border border-border-subtle">
                  <span className="text-xs text-text-muted block">Total Pagado Histórico</span>
                  <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">
                    {formatCurrency(financial.total_paid)}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-surface-base border border-border-subtle">
                  <span className="text-xs text-text-muted block">Saldo Pendiente (CxC)</span>
                  <span className={cn(
                    "text-xl font-bold font-mono mt-1 block",
                    financial.pending_balance > 0 ? "text-amber-400" : "text-text-secondary"
                  )}>
                    {formatCurrency(financial.pending_balance)}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-surface-base border border-border-subtle">
                  <span className="text-xs text-text-muted block">Saldo Vencido / En Mora</span>
                  <span className={cn(
                    "text-xl font-bold font-mono mt-1 block",
                    financial.overdue_balance > 0 ? "text-rose-400" : "text-text-secondary"
                  )}>
                    {formatCurrency(financial.overdue_balance)}
                  </span>
                </div>
              </div>
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
      title=""
      hideHeader={true}
      size="lg"
    >
      {renderContent()}

      {/* Modal Cambiar Grupo de WhatsApp */}
      <Modal
        isOpen={isChangeGroupModalOpen}
        onClose={() => setIsChangeGroupModalOpen(false)}
        title="Grupo de WhatsApp del Socio"
        containerClassName="max-w-md"
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setIsChangeGroupModalOpen(false)} className="rounded-xl text-xs">
              Cancelar
            </Button>
            <Button
              variant="primary"
              isLoading={isSavingGroup}
              onClick={handleSaveGroup}
              className="rounded-xl text-xs bg-brand-primary hover:bg-brand-primary/90"
            >
              Guardar Grupo
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          <p className="text-xs text-text-secondary leading-relaxed">
            Asigna el grupo oficial de WhatsApp al socio. Esto permite preparar invitaciones automáticas con el enlace directo al grupo sin agregarlo automáticamente.
          </p>
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
              Grupo de WhatsApp
            </label>
            <select
              value={selectedGroupId === null || selectedGroupId === undefined ? '' : selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2.5 bg-surface-base border border-border-medium rounded-xl text-sm text-text-primary focus:outline-none focus:border-brand-primary"
            >
              <option value="">No asignar a ningún grupo</option>
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

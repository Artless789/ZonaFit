import { Drawer } from '@shared/ui/Drawer';
import { StatusBadge } from '@shared/ui/StatusBadge';
import { AuthorizedImage } from '@shared/ui/AuthorizedImage';
import type { Membership } from '@shared/types/membership';
import type { Client } from '@shared/types/client';
import type { MembershipPlan } from '@shared/types/membershipPlan';
import { formatCurrency } from '@shared/utils/formatters';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale/es';
import {
  User,
  Calendar,
  CreditCard,
  Clock,
  CheckCircle2,
  Tag,
  Phone,
  Mail,
  Hash,
  Banknote,
  Download,
  MessageCircle,
  RotateCcw,
} from 'lucide-react';
import { useGymSettings } from '../../hooks/useGymSettings';
import { useWhatsAppWeb } from '@/hooks/useWhatsAppWeb';
import { generateMembershipPaymentReceiptPDF } from '@shared/utils/pdfGenerator';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { cn } from '@shared/utils/cn';

interface MembershipDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  membership: Membership | null;
  clients?: Client[];
  plans?: MembershipPlan[];
  onRenew?: (membership: Membership) => void;
}

export function MembershipDetailDrawer({
  isOpen,
  onClose,
  membership,
  clients = [],
  plans = [],
  onRenew,
}: MembershipDetailDrawerProps) {
  const { query: gymSettingsQuery } = useGymSettings();
  const gymSettings = gymSettingsQuery.data;
  const { openWhatsAppModal, WhatsAppModalComponent } = useWhatsAppWeb();

  if (!membership) return null;

  // Resolve client & plan from membership payload or fallback props
  const client = membership.client || clients.find((c) => c.id === membership.client_id);
  const plan =
    membership.membership_plan || plans.find((p) => p.id === membership.membership_plan_id);

  const formatDate = (isoString: string) => {
    try {
      return format(parseISO(isoString), "d 'de' MMMM, yyyy", { locale: es });
    } catch {
      return isoString;
    }
  };

  const formatShortDate = (isoString: string) => {
    try {
      return format(parseISO(isoString), 'dd/MM/yyyy HH:mm', { locale: es });
    } catch {
      return isoString;
    }
  };

  const getDaysRemaining = (endDateStr: string): number => {
    try {
      const end = parseISO(endDateStr);
      const now = new Date();
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return Math.ceil((endDay - today) / (1000 * 60 * 60 * 24));
    } catch {
      return 999;
    }
  };

  const daysLeft = getDaysRemaining(membership.end_date);
  const isExpired = !membership.is_active || membership.status === 'EXPIRED' || daysLeft < 0;

  const payments = membership.payments || [];
  const totalPaid =
    membership.total_paid ?? payments.reduce((acc, p) => acc + Number(p.amount), 0);
  const pendingBalance =
    membership.pending_balance ?? Math.max(0, Number(membership.price) - totalPaid);

  const whatsAppContext = (() => {
    if (pendingBalance > 0) {
      return {
        eventType: 'CREDIT_OVERDUE',
        eventLabel: 'Recordar saldo',
        buttonText: `Recordar saldo (${formatCurrency(pendingBalance)}) por WhatsApp`,
        contextData: {
          balance_due: formatCurrency(pendingBalance),
          membership_name: plan?.name || 'Membresía',
          expiry_date: formatDate(membership.end_date),
        },
      };
    }
    if (isExpired) {
      return {
        eventType: 'MEMBERSHIP_EXPIRED',
        eventLabel: 'Avisar vencida',
        buttonText: 'Avisar membresía vencida por WhatsApp',
        contextData: {
          membership_name: plan?.name || 'Membresía',
          expiry_date: formatDate(membership.end_date),
        },
      };
    }
    if (daysLeft <= 7) {
      return {
        eventType: 'MEMBERSHIP_EXPIRY',
        eventLabel: 'Recordar vencimiento',
        buttonText: `Recordar vencimiento (${daysLeft === 0 ? 'Vence hoy' : `${daysLeft} días restantes`})`,
        contextData: {
          membership_name: plan?.name || 'Membresía',
          expiry_date: formatDate(membership.end_date),
          days_left: daysLeft.toString(),
        },
      };
    }
    return {
      eventType: 'GENERAL',
      eventLabel: 'Contactar por WhatsApp',
      buttonText: 'Contactar al socio por WhatsApp',
      contextData: {
        membership_name: plan?.name || 'Membresía',
        expiry_date: formatDate(membership.end_date),
      },
    };
  })();

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Ficha de Membresía #${membership.id}`}
    >
      <div className="flex flex-col gap-5 pb-6">
        {/* Header Status & Price Banner */}
        <div className="p-4 bg-surface-raised border border-border-subtle rounded-[var(--radius-xl)] flex items-center justify-between shadow-subtle">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
              Estado de Cobertura
            </span>
            <div>
              {!membership.is_active ? (
                <StatusBadge status="neutral" label="Cancelada" />
              ) : isExpired ? (
                <StatusBadge status="danger" label="Vencida" />
              ) : daysLeft <= 7 ? (
                <StatusBadge
                  status="warning"
                  label={`Por vencer (${daysLeft === 0 ? 'Hoy' : `${daysLeft}d`})`}
                />
              ) : (
                <StatusBadge status="active" label="Activa" />
              )}
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted block">
              Precio Facturado
            </span>
            <div className="text-xl font-black font-mono text-text-primary">
              {formatCurrency(membership.price)}
            </div>
            {membership.discount && membership.discount > 0 && (
              <span className="text-[11px] text-emerald-400 font-mono font-medium block">
                Desc: -{formatCurrency(membership.discount)}
              </span>
            )}
          </div>
        </div>

        {/* Client Profile Section */}
        <div className="flex flex-col gap-2">
          <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
            <User size={13} className="text-brand-primary" />
            Datos del Socio
          </h4>
          <div className="p-3.5 bg-surface-base border border-border-subtle rounded-[var(--radius-lg)] flex items-center gap-3.5 shadow-xs">
            <div className="w-12 h-12 rounded-full overflow-hidden border border-border-subtle shrink-0 bg-surface-raised flex items-center justify-center">
              {client?.photo_url ? (
                <AuthorizedImage
                  src={client.photo_url}
                  alt={client.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User size={22} className="text-text-muted" />
              )}
            </div>
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <h3 className="font-bold text-text-primary text-sm truncate">
                {client?.full_name || `Cliente ID: ${membership.client_id}`}
              </h3>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-secondary">
                {client?.document && (
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    <Hash size={11} className="text-text-muted" />
                    {client.document_type || 'CC'} {client.document}
                  </span>
                )}
                {client?.phone && (
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    <Phone size={11} className="text-text-muted" />
                    {client.phone}
                  </span>
                )}
                {client?.email && (
                  <span className="flex items-center gap-1 text-[11px] truncate max-w-[180px]">
                    <Mail size={11} className="text-text-muted" />
                    {client.email}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Plan Section */}
        <div className="flex flex-col gap-2">
          <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
            <Tag size={13} className="text-brand-primary" />
            Plan Asignado
          </h4>
          <div className="p-3.5 bg-surface-base border border-border-subtle rounded-[var(--radius-lg)] flex flex-col gap-2 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-text-primary text-sm">
                {plan?.name || `Plan #${membership.membership_plan_id}`}
              </span>
              {plan?.duration_days && (
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-surface-raised border border-border-subtle text-text-secondary">
                  {plan.duration_days} días
                </span>
              )}
            </div>
            {plan?.description && (
              <p className="text-xs text-text-secondary leading-snug">{plan.description}</p>
            )}
            {membership.trainer_name && (
              <div className="text-xs text-text-muted pt-2 border-t border-border-subtle flex items-center justify-between">
                <span>Entrenador Asignado:</span>
                <span className="font-semibold text-text-primary">
                  {membership.trainer_name}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Vigencia & Calendario */}
        <div className="flex flex-col gap-2">
          <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
            <Calendar size={13} className="text-brand-primary" />
            Vigencia y Cobertura
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-surface-base border border-border-subtle rounded-[var(--radius-lg)] flex flex-col gap-1">
              <span className="text-[10px] font-mono text-text-muted uppercase flex items-center gap-1">
                <CheckCircle2 size={12} className="text-emerald-400" />
                Fecha de Inicio
              </span>
              <span className="text-xs font-semibold text-text-primary">
                {formatDate(membership.start_date)}
              </span>
            </div>

            <div className="p-3 bg-surface-base border border-border-subtle rounded-[var(--radius-lg)] flex flex-col gap-1">
              <span className="text-[10px] font-mono text-text-muted uppercase flex items-center gap-1">
                <Clock size={12} className={isExpired ? 'text-rose-400' : 'text-amber-400'} />
                Fecha de Vencimiento
              </span>
              <span className="text-xs font-semibold text-text-primary">
                {formatDate(membership.end_date)}
              </span>
              <span className="text-[10px] font-mono font-medium text-text-muted mt-0.5">
                {isExpired
                  ? `Vencida hace ${Math.abs(daysLeft)} días`
                  : daysLeft === 0
                  ? 'Vence hoy'
                  : `Quedan ${daysLeft} días de acceso`}
              </span>
            </div>
          </div>
        </div>

        {/* Resumen Financiero */}
        <div className="flex flex-col gap-2">
          <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
            <Banknote size={13} className="text-brand-primary" />
            Resumen Financiero y Saldos
          </h4>
          <div className="p-4 bg-surface-base border border-border-subtle rounded-[var(--radius-lg)] flex flex-col gap-2.5 shadow-xs text-xs">
            {membership.base_price && membership.discount && membership.discount > 0 ? (
              <>
                <div className="flex justify-between items-center text-text-secondary">
                  <span>Precio Base Catálogo:</span>
                  <span className="font-mono text-text-primary">
                    {formatCurrency(membership.base_price)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-emerald-400 font-semibold">
                  <span>Descuento Otorgado:</span>
                  <span className="font-mono">- {formatCurrency(membership.discount)}</span>
                </div>
                <div className="flex justify-between items-center text-text-secondary">
                  <span>Total Facturado:</span>
                  <span className="font-mono font-bold text-text-primary">
                    {formatCurrency(membership.price)}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-between items-center text-text-secondary">
                <span>Precio Total:</span>
                <span className="font-mono font-bold text-text-primary">
                  {formatCurrency(membership.price)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center text-text-secondary">
              <span>Total Pagado:</span>
              <span className="font-mono font-bold text-emerald-400">
                {formatCurrency(totalPaid)}
              </span>
            </div>
            <div className="flex justify-between items-baseline pt-2 border-t border-border-subtle">
              <span className="font-bold text-xs uppercase tracking-wider text-text-primary">
                Saldo Pendiente:
              </span>
              <span
                className={cn(
                  'font-mono font-black text-sm',
                  pendingBalance > 0 ? 'text-rose-400' : 'text-emerald-400'
                )}
              >
                {formatCurrency(pendingBalance)}
              </span>
            </div>

            {/* WhatsApp Integration Button */}
            <div className="pt-3 border-t border-border-subtle flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const clientInfo = {
                    id: membership.client_id,
                    full_name:
                      client?.full_name ||
                      membership.client_name ||
                      `Cliente #${membership.client_id}`,
                    phone: client?.phone || null,
                  };
                  openWhatsAppModal({
                    client: clientInfo,
                    eventType: whatsAppContext.eventType,
                    eventLabel: whatsAppContext.eventLabel,
                    contextData: whatsAppContext.contextData,
                  });
                }}
                className="w-full py-2.5 px-4 rounded-[var(--radius-md)] font-semibold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <MessageCircle size={15} />
                <span>{whatsAppContext.buttonText}</span>
              </button>
              <p className="text-[10px] text-text-muted text-center">
                Genera el mensaje y abre WhatsApp Web para contactar al socio.
              </p>
            </div>
          </div>
        </div>

        {/* Payments History */}
        <div className="flex flex-col gap-2">
          <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
            <CreditCard size={13} className="text-brand-primary" />
            Historial de Pagos ({payments.length})
          </h4>
          {payments.length === 0 ? (
            <div className="p-4 text-center bg-surface-base border border-border-subtle border-dashed rounded-[var(--radius-lg)] text-text-muted text-xs">
              No hay pagos directos registrados para esta membresía.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {payments.map((pmt) => (
                <div
                  key={pmt.id}
                  className="p-3 bg-surface-base border border-border-subtle rounded-[var(--radius-lg)] flex items-center justify-between shadow-xs text-xs"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-text-primary">
                        {formatCurrency(pmt.amount)}
                      </span>
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-surface-raised border border-border-subtle text-text-secondary">
                        {pmt.payment_method}
                      </span>
                    </div>
                    <span className="text-[10px] text-text-muted font-mono">
                      {formatShortDate(pmt.created_at)}
                    </span>
                    {pmt.reference && (
                      <span className="text-[10px] text-text-secondary">
                        Ref: {pmt.reference}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge
                      status={pmt.status === 'PAID' ? 'paid' : 'neutral'}
                      size="sm"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await generateMembershipPaymentReceiptPDF({
                            receiptNumber: `REC-MEM-${membership.id}-P${pmt.id}`,
                            paymentDate: pmt.created_at,
                            clientName:
                              client?.full_name || `Cliente #${membership.client_id}`,
                            clientDocument: client?.document || 'N/A',
                            clientPhone: client?.phone,
                            planName: plan?.name || 'Membresía',
                            durationDays: plan?.duration_days,
                            startDate: membership.start_date,
                            endDate: membership.end_date,
                            basePrice: membership.base_price
                              ? Number(membership.base_price)
                              : Number(membership.price),
                            discount: membership.discount ? Number(membership.discount) : 0,
                            totalPrice: Number(membership.price),
                            paidAmount: Number(pmt.amount),
                            pendingBalance: pendingBalance,
                            paymentMethod: pmt.payment_method,
                            gymName:
                              gymSettings?.trade_name ||
                              gymSettings?.legal_name ||
                              'Merwil ZonaFit',
                            gymNit: gymSettings?.tax_id,
                            gymPhone: gymSettings?.official_phone,
                            gymAddress: gymSettings?.physical_address,
                            gymCity: gymSettings?.city,
                            receiptFooterNotes: gymSettings?.receipt_footer_notes,
                          });
                        } catch {
                          // PDF error handled
                        }
                      }}
                      title="Descargar Comprobante PDF"
                      className="p-1.5 rounded-[var(--radius-sm)] border border-border-subtle bg-surface-raised hover:bg-surface-panel-hover text-text-secondary hover:text-brand-primary transition-colors cursor-pointer"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Direct Renewal CTA */}
        {onRenew && (
          <div className="pt-2">
            <ActionGlowButton
              type="button"
              onClick={() => {
                onClose();
                onRenew(membership);
              }}
              className="w-full py-3 text-xs font-bold flex items-center justify-center gap-2"
            >
              <RotateCcw size={15} />
              <span>Renovar Plan de este Socio</span>
            </ActionGlowButton>
          </div>
        )}
      </div>

      <WhatsAppModalComponent />
    </Drawer>
  );
}

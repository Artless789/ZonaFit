import { Drawer } from '@shared/ui/Drawer';
import { Badge } from '@shared/ui/Badge';
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
  Download
} from 'lucide-react';
import { useGymSettings } from '../../hooks/useGymSettings';
import { generateMembershipPaymentReceiptPDF } from '@shared/utils/pdfGenerator';

interface MembershipDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  membership: Membership | null;
  clients?: Client[];
  plans?: MembershipPlan[];
}

export function MembershipDetailDrawer({
  isOpen,
  onClose,
  membership,
  clients = [],
  plans = [],
}: MembershipDetailDrawerProps) {
  const { query: gymSettingsQuery } = useGymSettings();
  const gymSettings = gymSettingsQuery.data;

  if (!membership) return null;

  // Resolve client & plan from membership payload or fallback props
  const client = membership.client || clients.find(c => c.id === membership.client_id);
  const plan = membership.membership_plan || plans.find(p => p.id === membership.membership_plan_id);

  const formatDate = (isoString: string) => {
    try {
      return format(parseISO(isoString), "d 'de' MMMM, yyyy", { locale: es });
    } catch {
      return isoString;
    }
  };

  const formatShortDate = (isoString: string) => {
    try {
      return format(parseISO(isoString), "dd/MM/yyyy HH:mm", { locale: es });
    } catch {
      return isoString;
    }
  };

  const renderStatus = (status: string, is_active: boolean) => {
    if (!is_active) return <Badge variant="danger">Cancelada</Badge>;
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return <Badge variant="success">Activa</Badge>;
      case 'EXPIRED':
        return <Badge variant="warning">Expirada</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const payments = membership.payments || [];
  const totalPaid = membership.total_paid ?? payments.reduce((acc, p) => acc + Number(p.amount), 0);
  const pendingBalance = membership.pending_balance ?? Math.max(0, Number(membership.price) - totalPaid);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Detalle de Membresía #${membership.id}`}
    >
      <div className="flex flex-col gap-6 pb-6">
        {/* Header Status & Price Banner */}
        <div className="p-4 bg-bg-elevated/40 border border-border-light rounded-xl flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase text-text-muted">Estado Actual</span>
            <div>{renderStatus(membership.status, membership.is_active)}</div>
          </div>
          <div className="text-right">
            {membership.discount && membership.discount > 0 ? (
              <>
                <span className="text-[11px] text-brand-primary font-medium block">
                  Desc: -{formatCurrency(membership.discount)}
                </span>
                <div className="text-xl font-bold text-text-primary">
                  {formatCurrency(membership.price)}
                </div>
              </>
            ) : (
              <>
                <span className="text-xs font-semibold uppercase text-text-muted">Precio Cobrado</span>
                <div className="text-xl font-bold text-text-primary">
                  {formatCurrency(membership.price)}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Client Section */}
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <User size={14} className="text-brand-primary" />
            Información del Cliente
          </h4>
          <div className="p-4 bg-bg-surface border border-border-light rounded-xl flex items-start gap-4 shadow-sm">
            <div className="w-14 h-14 rounded-full overflow-hidden border border-border-medium flex-shrink-0 bg-bg-elevated flex items-center justify-center">
              {client?.photo_url ? (
                <AuthorizedImage
                  src={client.photo_url}
                  alt={client.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User size={28} className="text-text-muted" />
              )}
            </div>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <h3 className="font-semibold text-text-primary text-base truncate">
                {client?.full_name || `Cliente ID: ${membership.client_id}`}
              </h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
                {client?.document && (
                  <span className="flex items-center gap-1">
                    <Hash size={12} className="text-text-muted" />
                    {client.document_type || 'CC'} {client.document}
                  </span>
                )}
                {client?.phone && (
                  <span className="flex items-center gap-1">
                    <Phone size={12} className="text-text-muted" />
                    {client.phone}
                  </span>
                )}
                {client?.email && (
                  <span className="flex items-center gap-1 truncate">
                    <Mail size={12} className="text-text-muted" />
                    {client.email}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Plan Section */}
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <Tag size={14} className="text-brand-primary" />
            Plan de Membresía
          </h4>
          <div className="p-4 bg-bg-surface border border-border-light rounded-xl flex flex-col gap-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-text-primary text-base">
                {plan?.name || `Plan ID: ${membership.membership_plan_id}`}
              </span>
              {plan?.duration_days && (
                <Badge variant="default">{plan.duration_days} días</Badge>
              )}
            </div>
            {plan?.description && (
              <p className="text-xs text-text-secondary">{plan.description}</p>
            )}
            {membership.trainer_name && (
              <div className="text-xs text-text-muted mt-1 pt-2 border-t border-border-light flex items-center justify-between">
                <span>Entrenador Asignado:</span>
                <span className="font-medium text-text-primary">{membership.trainer_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Dates & Validity */}
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <Calendar size={14} className="text-brand-primary" />
            Vigencia y Fechas
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-bg-surface border border-border-light rounded-xl flex flex-col gap-1">
              <span className="text-xs text-text-muted flex items-center gap-1">
                <CheckCircle2 size={12} className="text-success" />
                Fecha de Inicio
              </span>
              <span className="text-sm font-semibold text-text-primary">
                {formatDate(membership.start_date)}
              </span>
            </div>
            <div className="p-3 bg-bg-surface border border-border-light rounded-xl flex flex-col gap-1">
              <span className="text-xs text-text-muted flex items-center gap-1">
                <Clock size={12} className="text-danger" />
                Fecha de Vencimiento
              </span>
              <span className="text-sm font-semibold text-text-primary">
                {formatDate(membership.end_date)}
              </span>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <Banknote size={14} className="text-brand-primary" />
            Resumen Financiero
          </h4>
          <div className="p-4 bg-bg-surface border border-border-light rounded-xl flex flex-col gap-3 shadow-sm">
            {membership.base_price && membership.discount && membership.discount > 0 ? (
              <>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-secondary">Precio Base del Plan:</span>
                  <span className="font-semibold text-text-primary">{formatCurrency(membership.base_price)}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-brand-primary">
                  <span>Descuento Otorgado:</span>
                  <span className="font-semibold">-{formatCurrency(membership.discount)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-secondary">Total a Pagar:</span>
                  <span className="font-semibold text-text-primary">{formatCurrency(membership.price)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-secondary">Precio Total:</span>
                <span className="font-semibold text-text-primary">{formatCurrency(membership.price)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-secondary">Total Pagado:</span>
              <span className="font-semibold text-success">{formatCurrency(totalPaid)}</span>
            </div>
            <div className="flex justify-between items-center text-sm pt-2 border-t border-border-light">
              <span className="font-medium text-text-primary">Saldo Pendiente:</span>
              <span className={`font-bold ${pendingBalance > 0 ? 'text-danger' : 'text-success'}`}>
                {formatCurrency(pendingBalance)}
              </span>
            </div>
          </div>
        </div>

        {/* Payments History */}
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <CreditCard size={14} className="text-brand-primary" />
            Historial de Pagos ({payments.length})
          </h4>
          {payments.length === 0 ? (
            <div className="p-6 text-center bg-bg-surface border border-border-light border-dashed rounded-xl text-text-muted text-xs">
              No hay pagos registrados directamente asociados a esta membresía.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {payments.map((pmt) => (
                <div
                  key={pmt.id}
                  className="p-3 bg-bg-surface border border-border-light rounded-xl flex items-center justify-between shadow-sm text-xs"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-primary">
                        {formatCurrency(pmt.amount)}
                      </span>
                      <Badge variant="default">{pmt.payment_method}</Badge>
                    </div>
                    <span className="text-text-muted">{formatShortDate(pmt.created_at)}</span>
                    {pmt.reference && (
                      <span className="text-text-secondary">Ref: {pmt.reference}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={pmt.status === 'PAID' ? 'success' : 'default'}>
                      {pmt.status}
                    </Badge>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await generateMembershipPaymentReceiptPDF({
                            receiptNumber: `REC-MEM-${membership.id}-P${pmt.id}`,
                            paymentDate: pmt.created_at,
                            clientName: client?.full_name || `Cliente #${membership.client_id}`,
                            clientDocument: client?.document || 'N/A',
                            clientPhone: client?.phone,
                            planName: plan?.name || 'Membresía',
                            durationDays: plan?.duration_days,
                            startDate: membership.start_date,
                            endDate: membership.end_date,
                            basePrice: membership.base_price ? Number(membership.base_price) : Number(membership.price),
                            discount: membership.discount ? Number(membership.discount) : 0,
                            totalPrice: Number(membership.price),
                            paidAmount: Number(pmt.amount),
                            pendingBalance: pendingBalance,
                            paymentMethod: pmt.payment_method,
                            gymName: gymSettings?.trade_name || gymSettings?.legal_name || 'Merwil ZonaFit',
                            gymNit: gymSettings?.tax_id,
                            gymPhone: gymSettings?.official_phone,
                            gymAddress: gymSettings?.physical_address,
                            gymCity: gymSettings?.city,
                            receiptFooterNotes: gymSettings?.receipt_footer_notes,
                          });
                        } catch (err) {
                          console.error('Error downloading payment receipt:', err);
                        }
                      }}
                      title="Descargar Comprobante PDF"
                      className="p-1.5 rounded-lg border border-border-medium bg-bg-surface hover:bg-bg-elevated text-text-secondary hover:text-brand-primary transition-colors"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}

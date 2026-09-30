import { Drawer } from '@shared/ui/Drawer';
import { StatusBadge } from '@shared/ui/StatusBadge';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { Skeleton } from '@shared/ui/Skeleton';
import {
  CreditCard,
  History,
  AlertCircle,
  MessageCircle,
  Banknote,
  ArrowLeftRight,
  Wallet,
  Receipt,
  Clock,
  User
} from 'lucide-react';
import { useAccountsReceivablePayments } from '../../hooks/useAccountsReceivables';
import { useWhatsAppWeb } from '@/hooks/useWhatsAppWeb';
import type { AccountsReceivable } from '@shared/types/accountsReceivable';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@shared/utils/formatters';

interface CreditsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  ar: AccountsReceivable | null;
  onPay: () => void;
  clientName: string;
  clientPhone?: string;
}

export function CreditsDrawer({ isOpen, onClose, ar, onPay, clientName, clientPhone }: CreditsDrawerProps) {
  const { data: payments = [], isLoading: isLoadingPayments, error } =
    useAccountsReceivablePayments(ar?.id || 0);
  const { openWhatsAppModal, WhatsAppModalComponent } = useWhatsAppWeb();

  const formatPrice = formatCurrency;

  const resolvedClientName = clientName || ar?.client?.full_name || ar?.client_name || (ar ? `Cliente #${ar.client_id}` : '');
  const resolvedClientPhone = clientPhone || ar?.client?.phone;
  const resolvedClientDocument = ar?.client?.document || 'Sin documento';

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMM yyyy, hh:mm a", { locale: es });
    } catch {
      return dateString;
    }
  };

  const formatShortDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMM yyyy", { locale: es });
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING': return <StatusBadge status="warning" label="PENDIENTE" size="sm" mode="pill" />;
      case 'PARTIAL': return <StatusBadge status="info" label="PARCIAL" size="sm" mode="pill" />;
      case 'PAID': return <StatusBadge status="paid" label="PAGADO" size="sm" mode="pill" />;
      case 'OVERDUE': return <StatusBadge status="danger" label="VENCIDO" size="sm" mode="pill" />;
      case 'CANCELLED': return <StatusBadge status="neutral" label="CANCELADO" size="sm" mode="pill" />;
      default: return <StatusBadge status="neutral" label={status} size="sm" mode="pill" />;
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method.toUpperCase()) {
      case 'CASH':
        return <Banknote className="text-emerald-400" size={14} />;
      case 'TRANSFER':
      case 'TRANSFERENCIA':
        return <ArrowLeftRight className="text-indigo-400" size={14} />;
      case 'CARD':
      case 'TARJETA':
        return <CreditCard className="text-amber-400" size={14} />;
      default:
        return <Wallet className="text-brand-primary" size={14} />;
    }
  };

  if (!ar) return null;

  const percentagePaid = ar.original_amount > 0
    ? Math.min(100, Math.round((ar.paid_amount / ar.original_amount) * 100))
    : 0;

  const overdueDays = (() => {
    if (ar.balance_due <= 0) return null;
    try {
      const dueDate = parseISO(ar.due_date);
      const diff = differenceInCalendarDays(new Date(), dueDate);
      return diff;
    } catch {
      return null;
    }
  })();

  const isOverdue = overdueDays !== null && overdueDays > 0;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Expediente de Cuenta por Cobrar"
    >
      <div className="space-y-5 text-sm font-sans">

        {/* Client Profile Context */}
        <div className="rounded-xl border border-border-subtle bg-surface-panel/90 p-4 space-y-3">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-sm font-bold text-brand-primary font-mono shrink-0">
                <User size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary">{resolvedClientName}</h3>
                <div className="flex items-center gap-2 text-xs text-text-muted font-mono mt-0.5">
                  <span>Doc: {resolvedClientDocument}</span>
                  {resolvedClientPhone && (
                    <>
                      <span>•</span>
                      <span>Tel: {resolvedClientPhone}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {getStatusBadge(ar.status)}
          </div>
        </div>

        {/* Financial Breakdown Card */}
        <div className="rounded-xl border border-border-subtle bg-surface-base/80 p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary font-mono flex items-center gap-1.5">
              <Receipt size={14} className="text-brand-primary" />
              <span>Venta Asociada #{ar.sale_id}</span>
            </span>
            {isOverdue ? (
              <span className="text-[11px] font-mono font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                {overdueDays} días en mora
              </span>
            ) : ar.balance_due > 0 ? (
              <span className="text-[11px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                Al día
              </span>
            ) : (
              <span className="text-[11px] font-mono text-text-muted bg-surface-raised px-2 py-0.5 rounded-full">
                Liquidado
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3.5 text-xs font-mono">
            <div>
              <span className="block text-text-muted text-[11px] mb-0.5 uppercase">Monto Original</span>
              <span className="font-bold text-text-primary text-sm">{formatPrice(ar.original_amount)}</span>
            </div>
            <div>
              <span className="block text-text-muted text-[11px] mb-0.5 uppercase">Fecha Vencimiento</span>
              <span className="font-semibold text-text-primary">{formatShortDate(ar.due_date)}</span>
            </div>
            <div>
              <span className="block text-text-muted text-[11px] mb-0.5 uppercase">Total Abonado</span>
              <span className="font-bold text-emerald-400 text-sm">{formatPrice(ar.paid_amount)}</span>
            </div>
            <div>
              <span className="block text-text-muted text-[11px] mb-0.5 uppercase">Saldo Pendiente</span>
              <span className="font-black text-rose-400 text-base">{formatPrice(ar.balance_due)}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-text-muted">Progreso de Pago</span>
              <span className="font-bold text-text-primary">{percentagePaid}%</span>
            </div>
            <div className="w-full h-1.5 bg-surface-raised rounded-full overflow-hidden border border-border-subtle">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${percentagePaid}%` }}
              />
            </div>
          </div>

          {/* Action buttons */}
          {ar.balance_due > 0 && ar.status !== 'CANCELLED' && (
            <div className="pt-2 flex flex-col gap-2">
              <ActionGlowButton onClick={onPay} className="w-full text-xs font-bold py-2">
                <CreditCard className="mr-1.5" size={15} />
                <span>Registrar Nuevo Abono</span>
              </ActionGlowButton>
              <button
                type="button"
                onClick={() => {
                  openWhatsAppModal({
                    client: {
                      id: ar.client_id,
                      full_name: resolvedClientName,
                      phone: resolvedClientPhone || null,
                    },
                    eventType: 'CREDIT_OVERDUE',
                    eventLabel: 'Recordar saldo',
                    contextData: {
                      balance_due: formatPrice(ar.balance_due),
                      amount: formatPrice(ar.balance_due),
                      sale_id: ar.sale_id.toString(),
                      due_date: formatShortDate(ar.due_date),
                    },
                  });
                }}
                className="w-full py-2 px-3 rounded-lg font-medium text-xs bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-300 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <MessageCircle size={14} />
                <span>Avisar Saldo por WhatsApp</span>
              </button>
            </div>
          )}
        </div>

        {/* Payment History */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5 font-mono">
              <History size={14} className="text-brand-primary" />
              <span>Historial de Abonos ({payments.length})</span>
            </h4>
          </div>

          {isLoadingPayments ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 flex flex-col items-center justify-center py-6 text-center">
               <AlertCircle className="text-rose-400 opacity-80 mb-2" size={20} />
               <p className="text-rose-300 text-xs">Error al cargar historial de abonos.</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="rounded-xl border border-border-subtle bg-surface-base/50 flex flex-col items-center justify-center py-8 text-center text-text-muted border-dashed">
              <CreditCard size={28} className="opacity-20 mb-2" />
              <p className="text-xs">No se han registrado abonos para este crédito aún.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {payments.map(payment => (
                <div key={payment.id} className="rounded-xl border border-border-subtle bg-surface-panel/90 p-3 flex justify-between items-center hover:bg-surface-panel-hover transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-emerald-400 text-sm">
                        {formatPrice(payment.amount)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-text-secondary bg-surface-base px-2 py-0.5 rounded border border-border-subtle">
                        {getMethodIcon(payment.payment_method)}
                        <span>{payment.payment_method}</span>
                      </span>
                    </div>
                    <div className="text-[11px] text-text-muted font-mono flex items-center gap-1">
                      <Clock size={11} />
                      <span>{formatDate(payment.created_at)}</span>
                    </div>
                  </div>
                  <StatusBadge
                    status={payment.status === 'PAID' ? 'paid' : 'neutral'}
                    label={payment.status === 'PAID' ? 'APLICADO' : payment.status}
                    size="sm"
                    mode="pill"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <WhatsAppModalComponent />
    </Drawer>
  );
}

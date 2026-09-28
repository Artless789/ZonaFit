import { Drawer } from '@shared/ui/Drawer';
import { Badge } from '@shared/ui/Badge';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { Skeleton } from '@shared/ui/Skeleton';
import { CreditCard, History, AlertCircle, MessageCircle } from 'lucide-react';
import { useAccountsReceivablePayments } from '../../hooks/useAccountsReceivables';
import { useWhatsAppWeb } from '@/hooks/useWhatsAppWeb';
import type { AccountsReceivable } from '@shared/types/accountsReceivable';
import { format } from 'date-fns';
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
  // We use enabled: !!ar to only fetch payments when we have an AR selected
  const { data: payments = [], isLoading: isLoadingPayments, error } = 
    useAccountsReceivablePayments(ar?.id || 0);
  const { openWhatsAppModal, WhatsAppModalComponent } = useWhatsAppWeb();

  const formatPrice = formatCurrency;
  
  const resolvedClientName = clientName || ar?.client?.full_name || ar?.client_name || (ar ? `Cliente #${ar.client_id}` : '');
  const resolvedClientPhone = clientPhone || ar?.client?.phone;

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
    switch (status) {
      case 'PENDING': return <Badge variant="warning">Pendiente</Badge>;
      case 'PARTIAL': return <Badge variant="info">Parcial</Badge>;
      case 'PAID': return <Badge variant="success">Pagado</Badge>;
      case 'OVERDUE': return <Badge variant="danger">Vencido</Badge>;
      case 'CANCELLED': return <Badge variant="neutral">Cancelado</Badge>;
      default: return <Badge variant="neutral">{status}</Badge>;
    }
  };

  if (!ar) return null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Detalle de Cuenta"
    >
      <div className="space-y-6">
        
        {/* Main Details */}
        <div className="rounded-xl border border-border-light bg-bg-surface/40 space-y-4">
          <div className="flex justify-between items-start border-b border-border-light pb-4">
            <div>
              <h3 className="text-lg font-bold text-text-primary">{resolvedClientName}</h3>
              <p className="text-sm text-text-muted">Venta #{ar.sale_id}</p>
            </div>
            {getStatusBadge(ar.status)}
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="block text-text-muted mb-1">Monto Original</span>
              <span className="font-semibold text-text-primary">{formatPrice(ar.original_amount)}</span>
            </div>
            <div>
              <span className="block text-text-muted mb-1">Vencimiento</span>
              <span className="font-semibold text-text-primary">{formatShortDate(ar.due_date)}</span>
            </div>
            <div>
              <span className="block text-text-muted mb-1">Total Pagado</span>
              <span className="font-semibold text-brand-primary">{formatPrice(ar.paid_amount)}</span>
            </div>
            <div>
              <span className="block text-text-muted mb-1">Saldo Pendiente</span>
              <span className="font-bold text-danger text-base">{formatPrice(ar.balance_due)}</span>
            </div>
          </div>
          
          {ar.balance_due > 0 && ar.status !== 'CANCELLED' && (
            <div className="pt-2 flex flex-col gap-2">
              <ActionGlowButton onClick={onPay} className="w-full">
                <CreditCard className="mr-2" size={18} />
                Registrar Abono
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
                className="w-full py-2 px-4 rounded-xl font-medium text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <MessageCircle size={14} />
                <span>Avisar saldo por WhatsApp</span>
              </button>
            </div>
          )}
        </div>

        {/* Payment History */}
        <div className="space-y-3">
          <h4 className="text-md font-bold text-text-primary flex items-center gap-2 px-1">
            <History size={18} className="text-text-muted" />
            HISTORIAL DE PAGOS
          </h4>
          
          {isLoadingPayments ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-danger/20 bg-danger/5 flex flex-col items-center justify-center py-6 text-center">
               <AlertCircle className="text-danger opacity-80 mb-2" size={24} />
               <p className="text-danger text-sm">Error al cargar historial.</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="rounded-xl border border-border-light bg-bg-surface/40 flex flex-col items-center justify-center py-8 text-center text-text-muted border-dashed">
              <CreditCard size={32} className="opacity-20 mb-2" />
              <p className="text-sm">No hay pagos registrados aún.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {payments.map(payment => (
                <div key={payment.id} className="rounded-xl border border-border-light bg-bg-surface/40 p-3 flex justify-between items-center group hover:bg-bg-elevated transition-colors">
                  <div>
                    <div className="font-semibold text-text-primary text-sm">
                      {formatPrice(payment.amount)}
                    </div>
                    <div className="text-xs text-text-muted flex gap-2">
                      <span>{payment.payment_method}</span>
                      <span>•</span>
                      <span>{formatDate(payment.created_at)}</span>
                    </div>
                  </div>
                  <Badge variant={payment.status === 'PAID' ? 'success' : 'neutral'} className="text-[10px]">
                    {payment.status}
                  </Badge>
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

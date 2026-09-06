import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { subscriptionService } from '../../services/subscriptionService';
import { SUBSCRIPTION_QUERY_KEY } from '@shared/subscription/useLicenseStatus';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { Button } from '@shared/ui/Button';
import { Badge } from '@shared/ui/Badge';
import { Spinner } from '@shared/ui/Spinner';
import { useToast } from '@shared/ui/Toast';
import { Modal } from '@shared/ui/Modal';
import { CreditCard, CalendarClock, ShieldAlert, Receipt, CheckCircle2, History, XCircle, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@shared/utils/formatters';

function parseSubscriptionDate(value: string): Date {
  return new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`);
}

export function SubscriptionManagementPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const { data: subscription, isLoading: isLoadingSub } = useQuery({
    queryKey: SUBSCRIPTION_QUERY_KEY,
    queryFn: subscriptionService.getMySubscription
  });

  const { data: history, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['subscription', 'history'],
    queryFn: subscriptionService.getHistory
  });

  const cancelMutation = useMutation({
    mutationFn: subscriptionService.cancelSubscription,
    onSuccess: () => {
      toast({ type: 'success', title: 'Suscripción cancelada', message: 'Tu suscripción no se renovará.' });
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
      setIsCancelModalOpen(false);
    },
    onError: () => {
      toast({ type: 'error', title: 'Error', message: 'No se pudo procesar la solicitud.' });
    }
  });

  const reactivateMutation = useMutation({
    mutationFn: subscriptionService.reactivateSubscription,
    onSuccess: () => {
      toast({ type: 'success', title: 'Suscripción reactivada', message: 'Tu suscripción se renovará automáticamente.' });
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
    },
    onError: () => {
      toast({ type: 'error', title: 'Error', message: 'No se pudo procesar la solicitud.' });
    }
  });

  const handleNavigateToCheckout = () => {
    if (window.location.pathname.startsWith('/demo')) {
      navigate('/demo/subscription/checkout');
    } else {
      navigate('/subscription/checkout');
    }
  };

  if (isLoadingSub) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner className="w-12 h-12" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-white tracking-tight mb-2 text-glow">Gestión de Suscripción</h1>
        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-8 text-center flex flex-col items-center gap-6">
          <Receipt className="w-16 h-16 text-text-muted" />
          <h2 className="text-2xl font-bold text-white">Sin Plan Activo</h2>
          <p className="text-text-secondary max-w-md mx-auto">No tienes ninguna suscripción configurada. Elige un plan para activar todas las funcionalidades de ZonaFit.</p>
          <ActionGlowButton onClick={handleNavigateToCheckout}>
            Ver Planes
          </ActionGlowButton>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return parseSubscriptionDate(dateStr).toLocaleDateString('es-CO', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const formatCurrencyLocal = (amount: number) => {
    return formatCurrency(amount / 100);
  };

  const isCancelled = !!subscription.cancellation_requested_at;
  const isExpired = subscription.status === 'EXPIRED';
  const isPastDue = subscription.status === 'PAST_DUE';

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight mb-2 text-glow">Gestión de Suscripción</h1>
        <p className="text-text-secondary">Administra tu plan, métodos de pago e historial de facturación.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Resumen del Plan Actual */}
        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-6 md:col-span-2 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-primary/10 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-sm text-text-muted uppercase tracking-wider mb-1">Plan Actual</p>
              <h2 className="text-2xl font-bold text-white">{subscription.plan?.name || 'Prueba Gratis'}</h2>
            </div>
            <Badge variant={
              isExpired ? 'danger' : 
              isPastDue ? 'warning' : 
              subscription.status === 'TRIAL' ? 'info' : 'success'
            }>
              {subscription.status}
            </Badge>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-border-light/20">
              <span className="text-text-secondary flex items-center gap-2">
                <CalendarClock size={16} /> Próximo corte
              </span>
              <span className="text-white font-medium">{formatDate(subscription.ends_at)}</span>
            </div>
            
            <div className="flex justify-between items-center py-3 border-b border-border-light/20">
              <span className="text-text-secondary flex items-center gap-2">
                <Receipt size={16} /> Valor
              </span>
              <span className="text-white font-medium">
                {subscription.plan ? `${formatCurrencyLocal(subscription.plan.price * 100)} / ${subscription.plan.billing_interval === 'MONTHLY' ? 'mes' : 'año'}` : 'Gratis'}
              </span>
            </div>

            {isCancelled && !isExpired && (
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mt-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="text-warning mt-0.5" size={20} />
                  <div>
                    <h4 className="text-warning font-semibold text-sm">Cancelación Programada</h4>
                    <p className="text-warning/80 text-xs mt-1">Tu suscripción ha sido cancelada y no se renovará. Seguirás teniendo acceso hasta el {formatDate(subscription.ends_at)}.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex gap-3">
            <ActionGlowButton onClick={handleNavigateToCheckout}>
              Cambiar Plan
            </ActionGlowButton>
            
            {subscription.status !== 'TRIAL' && !isCancelled && !isExpired && (
              <Button variant="danger" onClick={() => setIsCancelModalOpen(true)}>
                Cancelar Suscripción
              </Button>
            )}
            
            {isCancelled && !isExpired && (
              <Button variant="outline" onClick={() => reactivateMutation.mutate()} disabled={reactivateMutation.isPending}>
                <RefreshCw size={16} className="mr-2" /> Reanudar Suscripción
              </Button>
            )}
          </div>
        </div>

        {/* Método de Pago */}
        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-6 flex flex-col">
          <p className="text-sm text-text-muted uppercase tracking-wider mb-4">Método de Pago</p>
          
          <div className="flex-grow flex flex-col justify-center items-center text-center">
            {subscription.payment_source_id ? (
              <>
                <div className="w-16 h-16 rounded-full bg-surface-dark border border-border-light/30 flex items-center justify-center mb-4">
                  <CreditCard size={32} className="text-text-primary" />
                </div>
                <h3 className="text-white font-medium mb-1">Tarjeta vinculada</h3>
                <p className="text-text-secondary text-sm">Terminada en •••• {subscription.payment_method_last4 || '****'}</p>
                <div className="mt-6 flex items-center gap-1 text-success text-sm bg-success/10 px-3 py-1 rounded-full border border-success/20">
                  <CheckCircle2 size={14} /> <span>Cobro automático activo</span>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-surface-darker border border-border-light/20 flex items-center justify-center mb-4">
                  <CreditCard size={32} className="text-text-muted" />
                </div>
                <h3 className="text-white font-medium mb-1">Sin método guardado</h3>
                <p className="text-text-secondary text-sm">No tienes una tarjeta vinculada para cobro automático.</p>
                
                {subscription.status !== 'TRIAL' && (
                  <Button variant="outline" className="mt-6 w-full text-sm" onClick={handleNavigateToCheckout}>
                    Agregar Tarjeta
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Historial de Pagos */}
      <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-6">
        <div className="flex items-center gap-3 mb-6">
          <History size={20} className="text-brand-primary" />
          <h2 className="text-xl font-bold text-white">Historial de Facturación</h2>
        </div>

        {isLoadingHistory ? (
          <div className="flex justify-center items-center h-32">
            <Spinner className="w-8 h-8" />
          </div>
        ) : history && history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-light/30">
                  <th className="py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Fecha</th>
                  <th className="py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Monto</th>
                  <th className="py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Referencia</th>
                  <th className="py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light/10">
                {history.map((payment) => (
                  <tr key={payment.id} className="hover:bg-surface-dark/50 transition-colors">
                    <td className="py-3 px-4 text-sm text-white">
                      {new Date(payment.created_at).toLocaleDateString('es-CO')}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-white">
                      {formatCurrencyLocal(payment.amount_in_cents)}
                    </td>
                    <td className="py-3 px-4 text-sm text-text-secondary font-mono text-xs">
                      {payment.reference}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <Badge variant={
                        payment.status === 'APPROVED' ? 'success' :
                        payment.status === 'DECLINED' ? 'danger' :
                        payment.status === 'ERROR' ? 'danger' : 'warning'
                      }>
                        {payment.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <Receipt className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-50" />
            <p className="text-text-secondary">No hay pagos registrados aún.</p>
          </div>
        )}
      </div>

      {/* Modal de Cancelación */}
      <Modal isOpen={isCancelModalOpen} onClose={() => setIsCancelModalOpen(false)} title="Cancelar Suscripción">
        <div className="space-y-4">
          <div className="p-4 bg-danger/10 border border-danger/30 rounded-lg flex gap-3">
            <XCircle className="text-danger shrink-0 mt-0.5" />
            <div>
              <h4 className="text-danger font-semibold">¿Estás seguro?</h4>
              <p className="text-danger/80 text-sm mt-1">Al cancelar, no se generarán nuevos cobros. Podrás seguir usando la plataforma hasta el final de tu ciclo actual ({formatDate(subscription.ends_at)}).</p>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t border-border-light/20">
            <Button variant="outline" onClick={() => setIsCancelModalOpen(false)}>
              Mantener Suscripción
            </Button>
            <Button 
              variant="danger" 
              onClick={() => cancelMutation.mutate()} 
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Cancelando...' : 'Sí, cancelar plan'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

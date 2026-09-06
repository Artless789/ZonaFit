import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { subscriptionService, PaymentHistory } from '../../services/subscriptionService';
import { SUBSCRIPTION_QUERY_KEY } from '@shared/subscription/useLicenseStatus';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { Button } from '@shared/ui/Button';
import { Badge } from '@shared/ui/Badge';
import { Spinner } from '@shared/ui/Spinner';
import { useToast } from '@shared/ui/Toast';
import { Modal } from '@shared/ui/Modal';
import { 
  CreditCard, 
  CalendarClock, 
  ShieldAlert, 
  Receipt, 
  CheckCircle2, 
  History, 
  RefreshCw, 
  Download, 
  AlertTriangle, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles,
  Check
} from 'lucide-react';
import { formatCurrency } from '@shared/utils/formatters';
import { generateSubscriptionReceiptPDF } from '@shared/utils/subscriptionPdfGenerator';
import { useAuth } from '../../context/AuthContext';
import { useGymSettings } from '../../hooks/useGymSettings';

function parseSubscriptionDate(value: string): Date {
  return new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`);
}

const CANCEL_REASONS = [
  { id: 'expensive', label: 'Demasiado costoso para mi flujo actual de caja' },
  { id: 'missing_features', label: 'Me faltan herramientas o funcionalidades clave' },
  { id: 'technical_issues', label: 'Experimenté problemas técnicos o lentitud' },
  { id: 'closing_temporary', label: 'Cierre o pausa temporal de actividades de mi gimnasio' },
  { id: 'competitor', label: 'Decidí migrar a otra alternativa o software' },
  { id: 'other', label: 'Otro motivo no listado' }
];

export function SubscriptionManagementPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { query: gymSettingsQuery } = useGymSettings();
  const gymSettings = gymSettingsQuery.data;
  
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelStep, setCancelStep] = useState<1 | 2>(1);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelFeedback, setCancelFeedback] = useState<string>('');

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

  const handleOpenCancelModal = () => {
    setCancelStep(1);
    setCancelReason('');
    setCancelFeedback('');
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancel = () => {
    cancelMutation.mutate({
      reason: cancelReason,
      feedback: cancelFeedback
    });
  };

  const handleDownloadReceipt = async (payment: PaymentHistory) => {
    try {
      await generateSubscriptionReceiptPDF({
        payment,
        subscription,
        gymName: gymSettings?.trade_name || gymSettings?.legal_name || 'Gimnasio Merwil ZonaFit',
        gymEmail: gymSettings?.official_email || user?.email || '',
        ownerName: user?.full_name || 'Administrador',
      });
      toast({
        type: 'success',
        title: 'Recibo generado',
        message: `Comprobante ${payment.reference} descargado correctamente.`
      });
    } catch (err) {
      console.error('Error generating PDF receipt:', err);
      toast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo generar el comprobante en PDF.'
      });
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
          <p className="text-text-secondary max-w-md mx-auto">No tienes ninguna suscripción configurada. Elige un plan para activar todas las funcionalidades de Merwil ZonaFit.</p>
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
                {subscription.plan ? `${formatCurrencyLocal(subscription.plan.price * 100)} / ${subscription.plan.billing_interval === 'MONTHLY' ? 'mes' : subscription.plan.billing_interval === 'YEARLY' ? 'año' : 'período'}` : 'Gratis'}
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
              <Button variant="danger" onClick={handleOpenCancelModal}>
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
                  <th className="py-3 px-4 text-xs font-semibold text-text-muted uppercase tracking-wider text-right">Comprobante</th>
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
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant={
                          payment.status === 'APPROVED' ? 'success' :
                          payment.status === 'VOIDED' ? 'warning' :
                          payment.status === 'DECLINED' ? 'danger' :
                          payment.status === 'ERROR' ? 'danger' : 'warning'
                        }>
                          {payment.status === 'VOIDED' ? 'ANULADO / REEMBOLSADO' : payment.status}
                        </Badge>
                        {payment.refund_reason && (
                          <span className="text-[11px] text-text-muted italic">
                            Motivo: {payment.refund_reason}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="inline-flex items-center gap-1.5 text-xs py-1 px-2.5 hover:border-brand-primary/50"
                        onClick={() => handleDownloadReceipt(payment)}
                        title="Descargar comprobante oficial en PDF"
                      >
                        <Download size={14} className="text-brand-primary" />
                        <span>PDF</span>
                      </Button>
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

      {/* Modal de Cancelación Anti-Churn de 2 Pasos */}
      <Modal 
        isOpen={isCancelModalOpen} 
        onClose={() => setIsCancelModalOpen(false)} 
        title={cancelStep === 1 ? "¿Por qué deseas cancelar tu suscripción?" : "Antes de confirmar tu cancelación"}
      >
        <div className="space-y-5">
          {cancelStep === 1 ? (
            /* PASO 1: Encuesta de motivos */
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">
                Nos importa mucho tu experiencia. Por favor indícanos el motivo principal por el que decides cancelar:
              </p>

              <div className="space-y-2">
                {CANCEL_REASONS.map((r) => {
                  const isSelected = cancelReason === r.label;
                  return (
                    <div
                      key={r.id}
                      onClick={() => setCancelReason(r.label)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between text-sm ${
                        isSelected 
                          ? 'border-brand-primary bg-brand-primary/10 text-white font-medium' 
                          : 'border-border-light/30 bg-surface-dark/40 hover:bg-surface-dark text-text-secondary'
                      }`}
                    >
                      <span>{r.label}</span>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-brand-primary bg-brand-primary text-black' : 'border-border-light'
                      }`}>
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                  Comentarios adicionales (opcional)
                </label>
                <textarea
                  rows={2}
                  value={cancelFeedback}
                  onChange={(e) => setCancelFeedback(e.target.value)}
                  placeholder="¿Hay algo específico que podríamos haber hecho mejor?"
                  className="w-full bg-surface-dark border border-border-light rounded-lg p-2.5 text-sm text-white placeholder:text-text-muted focus:outline-none focus:border-brand-primary"
                />
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-border-light/20">
                <Button variant="ghost" onClick={() => setIsCancelModalOpen(false)}>
                  Mantener mi plan
                </Button>
                <Button 
                  variant="primary" 
                  disabled={!cancelReason}
                  onClick={() => setCancelStep(2)}
                  className="flex items-center gap-1.5"
                >
                  <span>Continuar</span>
                  <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          ) : (
            /* PASO 2: Oferta de retención adaptativa y confirmación */
            <div className="space-y-4">
              {cancelReason === 'Demasiado costoso para mi flujo actual de caja' && (
                <div className="p-4 rounded-xl border border-brand-primary/40 bg-brand-primary/10 space-y-3">
                  <div className="flex items-start gap-3">
                    <Sparkles className="text-brand-primary shrink-0 mt-1" size={20} />
                    <div>
                      <h4 className="text-white font-semibold text-sm">¿Sabías que puedes reducir tu costo mensual?</h4>
                      <p className="text-text-secondary text-xs mt-1">
                        Puedes optar por un ciclo trimestral, semestral o anual con tarifas preferenciales, o contactar a soporte para activar una facilidad de pago personalizada sin pausar la operación de tu gimnasio.
                      </p>
                    </div>
                  </div>
                  <div className="pt-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-xs text-brand-primary border-brand-primary/50"
                      onClick={() => {
                        setIsCancelModalOpen(false);
                        handleNavigateToCheckout();
                      }}
                    >
                      Explorar planes con descuento
                    </Button>
                  </div>
                </div>
              )}

              {(cancelReason === 'Me faltan herramientas o funcionalidades clave' || cancelReason === 'Experimenté problemas técnicos o lentitud') && (
                <div className="p-4 rounded-xl border border-warning/40 bg-warning/10 flex items-start gap-3">
                  <ShieldAlert className="text-warning shrink-0 mt-1" size={20} />
                  <div>
                    <h4 className="text-warning font-semibold text-sm">Asistencia Técnica y Soporte Prioritario</h4>
                    <p className="text-warning/80 text-xs mt-1">
                      Nuestro equipo de ingeniería puede agendar una llamada directa contigo hoy mismo para resolver cualquier inconveniente técnico o activar integraciones especiales a tu medida.
                    </p>
                  </div>
                </div>
              )}

              <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl flex gap-3">
                <AlertTriangle className="text-danger shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="text-danger font-semibold text-sm">Impacto de la cancelación</h4>
                  <p className="text-danger/80 text-xs mt-1">
                    No se volverán a realizar cobros en tu método de pago. Tu acceso completo y el funcionamiento de los torniquetes seguirán habilitados hasta el <strong>{formatDate(subscription.ends_at)}</strong>.
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-border-light/20">
                <Button 
                  variant="ghost" 
                  onClick={() => setCancelStep(1)}
                  className="flex items-center gap-1 text-xs"
                >
                  <ArrowLeft size={14} />
                  <span>Atrás</span>
                </Button>
                
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsCancelModalOpen(false)}>
                    Mantener Suscripción
                  </Button>
                  <Button 
                    variant="danger" 
                    onClick={handleConfirmCancel} 
                    disabled={cancelMutation.isPending}
                  >
                    {cancelMutation.isPending ? 'Cancelando...' : 'Confirmar Cancelación'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

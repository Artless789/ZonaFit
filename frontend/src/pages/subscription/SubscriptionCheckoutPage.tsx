import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionService, PlanInfo } from '../../services/subscriptionService';
import { GlassCard } from '../../components/shared/GlassCard';
import { ActionGlowButton } from '../../components/shared/ActionGlowButton';
import { Button } from '../../components/shared/Button';
import { Badge } from '../../components/shared/Badge';
import { EmptyState } from '../../components/shared/EmptyState';
import { ErrorState } from '../../components/shared/ErrorState';
import { Skeleton } from '../../components/shared/Skeleton';
import { CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

declare global {
  interface Window {
    WidgetCheckout: any;
  }
}

export function SubscriptionCheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'IDLE' | 'PENDING' | 'APPROVED' | 'DECLINED' | 'ERROR' | 'VOIDED'>('IDLE');

  const { data: subscription, isLoading: isLoadingSub, error: errorSub, refetch: refetchSub } = useQuery({
    queryKey: ['mySubscription'],
    queryFn: subscriptionService.getMySubscription
  });

  const { data: plans, isLoading: isLoadingPlans, error: errorPlans, refetch: refetchPlans } = useQuery({
    queryKey: ['availablePlans'],
    queryFn: subscriptionService.getPlans
  });

  const { mutate: verifyPayment, isPending: isVerifying } = useMutation({
    mutationFn: ({ transactionId }: { transactionId: string }) => 
      subscriptionService.verifyPayment({ subscriptionId: subscription!.id, transactionId }),
    onSuccess: (data) => {
      setPaymentStatus(data.status as any);
      if (data.status === 'APPROVED') {
        queryClient.invalidateQueries({ queryKey: ['mySubscription'] });
      }
    },
    onError: () => {
      setPaymentStatus('ERROR');
    }
  });

  const { mutate: initPayment, isPending: isInitializing } = useMutation({
    mutationFn: subscriptionService.initPayment,
    onSuccess: (data) => {
      // Abre el widget de Wompi
      const checkout = new window.WidgetCheckout({
        currency: data.currency,
        amountInCents: data.amount_in_cents,
        reference: data.reference,
        publicKey: data.public_key,
        signature: { integrity: data.signature }
      });

      checkout.open(function (result: any) {
        const transaction = result.transaction;
        if (transaction && transaction.status) {
          if (transaction.id) {
            verifyPayment({ transactionId: transaction.id });
          } else {
            setPaymentStatus(transaction.status);
          }
        } else {
          setPaymentStatus('ERROR');
        }
      });
    },
    onError: () => {
      setPaymentStatus('ERROR');
    }
  });

  const handlePay = () => {
    if (!subscription || !selectedPlanId) return;
    setPaymentStatus('PENDING');
    initPayment({ subscriptionId: subscription.id, planId: selectedPlanId });
  };

  const resetFlow = () => {
    setPaymentStatus('IDLE');
  };

  if (isLoadingSub || isLoadingPlans) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-1/3 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (errorSub || errorPlans) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <ErrorState
          title="Error al cargar planes"
          description="Ocurrió un problema de red. Por favor, intenta de nuevo."
          onRetry={() => {
            refetchSub();
            refetchPlans();
          }}
        />
      </div>
    );
  }

  if (subscription?.is_lifetime) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <GlassCard className="p-8 text-center border-success/30 bg-success/10 flex flex-col items-center">
          <CheckCircle2 className="w-16 h-16 text-success mb-4" />
          <h2 className="text-2xl font-bold text-text-primary mb-2">Suscripción Sin Vencimiento</h2>
          <p className="text-success mb-6">
            Tu cuenta tiene acceso vitalicio a ZonaFit. No necesitas realizar pagos.
          </p>
          <Button onClick={() => navigate('/dashboard')} variant="outline">
            Ir al Dashboard
          </Button>
        </GlassCard>
      </div>
    );
  }

  if (!plans || plans.length === 0) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <EmptyState
          title="No hay planes disponibles"
          description="En este momento no hay planes configurados en la plataforma. Contacta al administrador."
          icon={<AlertCircle size={32} />}
        />
      </div>
    );
  }

  if (paymentStatus === 'APPROVED') {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <GlassCard className="p-8 text-center flex flex-col items-center border-success/30 bg-success/5">
          <CheckCircle2 className="w-16 h-16 text-success mb-4" />
          <h2 className="text-3xl font-bold text-text-primary mb-2">Pago Aprobado</h2>
          <p className="text-text-secondary mb-8">
            Tu suscripción se ha activado exitosamente. Ya puedes disfrutar de ZonaFit.
          </p>
          <ActionGlowButton onClick={() => navigate('/dashboard')}>
            Ingresar a la Plataforma
          </ActionGlowButton>
        </GlassCard>
      </div>
    );
  }

  if (paymentStatus === 'DECLINED' || paymentStatus === 'ERROR' || paymentStatus === 'VOIDED') {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <GlassCard className="p-8 text-center flex flex-col items-center border-danger/30 bg-danger/5">
          {paymentStatus === 'DECLINED' ? (
            <XCircle className="w-16 h-16 text-danger mb-4" />
          ) : (
            <AlertCircle className="w-16 h-16 text-warning mb-4" />
          )}
          <h2 className="text-3xl font-bold text-text-primary mb-2">
            {paymentStatus === 'DECLINED' ? 'Pago Rechazado' : 'Error procesando el pago'}
          </h2>
          <p className="text-text-secondary mb-8">
            {paymentStatus === 'DECLINED'
              ? 'Tu entidad financiera ha rechazado la transacción.'
              : 'Ocurrió un error inesperado o la transacción fue anulada.'}
          </p>
          <Button onClick={resetFlow} variant="primary">
            Intentar nuevamente
          </Button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-text-primary mb-3">Elige tu plan comercial</h1>
        <p className="text-text-secondary text-lg">
          Selecciona el plan que mejor se adapte a tu gimnasio para activar tu cuenta.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {plans.map((plan: PlanInfo) => {
          const isSelected = selectedPlanId === plan.id;
          return (
            <div
              key={plan.id}
              onClick={() => setSelectedPlanId(plan.id)}
              className={`relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${
                isSelected
                  ? 'ring-2 ring-brand-primary transform scale-[1.02]'
                  : 'hover:ring-1 hover:ring-border-strong'
              }`}
            >
              <GlassCard className={`h-full p-6 flex flex-col ${isSelected ? 'bg-brand-primary/10 border-brand-primary/30' : ''}`}>
                <div className="mb-4">
                  <Badge variant={plan.billing_interval === 'YEARLY' ? 'success' : 'default'} className="mb-3">
                    {plan.billing_interval === 'YEARLY' ? 'Anual' : 'Mensual'}
                  </Badge>
                  <h3 className="text-xl font-bold text-text-primary">{plan.name}</h3>
                </div>

                <div className="flex items-baseline mb-4">
                  <span className="text-3xl font-bold text-text-primary">
                    ${plan.price.toLocaleString()}
                  </span>
                  <span className="text-text-muted ml-2">{plan.currency}</span>
                </div>

                {plan.description && (
                  <p className="text-text-secondary mb-6 flex-grow text-sm">
                    {plan.description}
                  </p>
                )}

                <div className="mt-auto">
                  <div className={`w-full text-center py-2 rounded-lg font-medium transition-colors ${
                    isSelected ? 'bg-brand-primary text-text-white' : 'bg-bg-surface text-text-secondary border border-border-light'
                  }`}>
                    {isSelected ? 'Plan Seleccionado' : 'Seleccionar'}
                  </div>
                </div>
              </GlassCard>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center">
        {selectedPlanId ? (
          <div className="flex flex-col items-center">
            {paymentStatus === 'PENDING' && (isInitializing || isVerifying) && (
              <div className="flex items-center text-text-secondary mb-4">
                <Clock className="w-5 h-5 mr-2 animate-spin" />
                <span>Procesando y verificando pago...</span>
              </div>
            )}
            <ActionGlowButton 
              onClick={handlePay} 
              disabled={paymentStatus === 'PENDING' || isInitializing || isVerifying}
              className="px-10 py-4 text-lg"
            >
              Continuar con el pago
            </ActionGlowButton>
          </div>
        ) : (
          <p className="text-text-muted">Selecciona un plan para continuar</p>
        )}
      </div>
    </div>
  );
}

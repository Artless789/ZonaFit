import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionService, PlanInfo } from '../../services/subscriptionService';
import { SUBSCRIPTION_QUERY_KEY } from '@shared/subscription/useLicenseStatus';
import { useAuth } from '../../context/AuthContext';

import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { Button } from '@shared/ui/Button';
import { Badge } from '@shared/ui/Badge';
import { EmptyState } from '@shared/ui/EmptyState';
import { ErrorState } from '@shared/ui/ErrorState';
import { Spinner } from '@shared/ui/Spinner';
import { CheckCircle2, XCircle, AlertCircle, Clock, ArrowLeft, ShieldCheck } from 'lucide-react';
import { useNavigate, useSearchParams, useLocation, Navigate } from 'react-router-dom';
import { formatCurrency } from '@shared/utils/formatters';

declare global {
  interface Window {
    WidgetCheckout: any;
  }
}

export function SubscriptionCheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading: isLoadingAuth } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const planIdParam = searchParams.get('planId');
  const transactionIdParam = searchParams.get('id') || searchParams.get('transaction_id') || searchParams.get('transactionId');
  const verifiedRef = useRef<string | null>(null);

  const queryClient = useQueryClient();
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'IDLE' | 'PENDING' | 'APPROVED' | 'DECLINED' | 'ERROR' | 'VOIDED'>('IDLE');

  const { data: subscription, isLoading: isLoadingSub, error: errorSub, refetch: refetchSub } = useQuery({
    queryKey: SUBSCRIPTION_QUERY_KEY,
    queryFn: subscriptionService.getMySubscription,
    enabled: isAuthenticated
  });

  const { data: plans, isLoading: isLoadingPlans, error: errorPlans, refetch: refetchPlans } = useQuery({
    queryKey: ['availablePlans'],
    queryFn: subscriptionService.getPlans,
    enabled: isAuthenticated
  });

  // Preselect plan from URL param if valid and not yet selected
  useEffect(() => {
    if (planIdParam && plans && plans.length > 0) {
      const id = parseInt(planIdParam, 10);
      const exists = plans.some((p: PlanInfo) => p.id === id);
      if (exists) {
        setSelectedPlanId(id);
      }
    }
  }, [planIdParam, plans]);

  const handleSelectPlan = (planId: number) => {
    setSelectedPlanId(planId);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('planId', planId.toString());
      return next;
    }, { replace: true });
  };

  const { mutate: verifyPayment, isPending: isVerifying } = useMutation({
    mutationFn: ({ transactionId }: { transactionId: string }) => 
      subscriptionService.verifyPayment({ subscriptionId: subscription!.id, transactionId }),
    onSuccess: (data) => {
      setPaymentStatus(data.status as any);
      if (data.status === 'APPROVED') {
        queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
      }
    },
    onError: () => {
      setPaymentStatus('ERROR');
    }
  });

  // Automatically verify payment if redirected back by Wompi (e.g. 3DS or PSE callback)
  useEffect(() => {
    if (transactionIdParam && subscription && paymentStatus === 'IDLE' && !isVerifying && verifiedRef.current !== transactionIdParam) {
      verifiedRef.current = transactionIdParam;
      setPaymentStatus('PENDING');
      verifyPayment({ transactionId: transactionIdParam });
    }
  }, [transactionIdParam, subscription, paymentStatus, isVerifying, verifyPayment]);

  const { mutate: initPayment, isPending: isInitializing } = useMutation({
    mutationFn: subscriptionService.initPayment,
    onSuccess: (data) => {
      try {
        if (!window.WidgetCheckout) {
          console.error('El widget de Wompi no está cargado.');
          setPaymentStatus('ERROR');
          return;
        }

        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const checkoutConfig: any = {
          currency: data.currency,
          amountInCents: data.amount_in_cents,
          reference: data.reference,
          publicKey: data.public_key,
          signature: { integrity: data.signature },
        };

        if (!isLocalhost) {
          checkoutConfig.redirectUrl = `${window.location.origin}/app/subscription/checkout`;
        }

        // Abre el widget de Wompi
        const checkout = new window.WidgetCheckout(checkoutConfig);

        checkout.open(function (result: any) {
          const transaction = result?.transaction;
          if (transaction && transaction.status) {
            if (transaction.id) {
              verifyPayment({ transactionId: transaction.id });
            } else {
              setPaymentStatus(transaction.status);
            }
          } else {
            // El usuario cerró el widget o canceló la transacción antes de pagar
            setPaymentStatus('IDLE');
          }
        });
      } catch (err) {
        console.error('Error al instanciar el widget de Wompi:', err);
        setPaymentStatus('ERROR');
      }
    },
    onError: () => {
      setPaymentStatus('ERROR');
    }
  });

  const handlePay = () => {
    if (!subscription || !selectedPlanId || isInitializing || isVerifying) return;
    setPaymentStatus('PENDING');
    initPayment({ subscriptionId: subscription.id, planId: selectedPlanId });
  };

  const resetFlow = () => {
    setPaymentStatus('IDLE');
    if (transactionIdParam) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('id');
        next.delete('transaction_id');
        next.delete('transactionId');
        return next;
      }, { replace: true });
    }
  };

  if (isLoadingAuth || isLoadingSub || isLoadingPlans) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-transparent">
        <Spinner className="w-12 h-12 mb-4" />
        <p className="text-text-secondary text-sm animate-pulse">Cargando detalles de suscripción...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    const redirectUrl = location.pathname + location.search;
    return <Navigate to={`/login?planId=${planIdParam || ''}&redirect=${encodeURIComponent(redirectUrl)}`} replace />;
  }

  if (errorSub || errorPlans) {
    return (
      <div className="min-h-screen p-8 max-w-4xl mx-auto flex flex-col justify-center">
        <ErrorState
          title="Error al cargar planes"
          description="Ocurrió un problema de red al consultar tu suscripción. Por favor, intenta de nuevo."
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
      <div className="min-h-screen p-8 max-w-4xl mx-auto flex flex-col justify-center">
        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-8 text-center border-success/30 bg-success/10 flex flex-col items-center">
          <CheckCircle2 className="w-16 h-16 text-success mb-4" />
          <h2 className="text-2xl font-bold text-text-primary mb-2">Suscripción Sin Vencimiento</h2>
          <p className="text-success mb-6">
            Tu cuenta tiene acceso vitalicio a ZonaFit. No necesitas realizar pagos.
          </p>
          <Button onClick={() => window.location.assign('/app/dashboard')} variant="outline">
            Ir al Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!plans || !Array.isArray(plans) || plans.length === 0) {
    return (
      <div className="min-h-screen p-8 max-w-4xl mx-auto flex flex-col justify-center">
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
      <div className="min-h-screen p-8 max-w-4xl mx-auto flex flex-col justify-center">
        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-8 text-center flex flex-col items-center border-success/30 bg-success/5 shadow-glass-large">
          <CheckCircle2 className="w-16 h-16 text-success mb-4" />
          <h2 className="text-3xl font-bold text-text-primary mb-2">¡Pago Aprobado con Éxito!</h2>
          <p className="text-text-secondary mb-8 max-w-md">
            Tu suscripción se ha activado correctamente para tu gimnasio. Ya tienes acceso completo a todas las funciones de ZonaFit.
          </p>
          <ActionGlowButton onClick={() => window.location.assign('/app/dashboard')} className="px-8 py-3 font-semibold">
            Ingresar a la Plataforma
          </ActionGlowButton>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'DECLINED' || paymentStatus === 'ERROR' || paymentStatus === 'VOIDED') {
    return (
      <div className="min-h-screen p-8 max-w-4xl mx-auto flex flex-col justify-center">
        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-8 text-center flex flex-col items-center border-danger/30 bg-danger/5 shadow-glass-large">
          {paymentStatus === 'DECLINED' ? (
            <XCircle className="w-16 h-16 text-danger mb-4" />
          ) : (
            <AlertCircle className="w-16 h-16 text-warning mb-4" />
          )}
          <h2 className="text-3xl font-bold text-text-primary mb-2">
            {paymentStatus === 'DECLINED' ? 'Pago Rechazado' : 'Error procesando el pago'}
          </h2>
          <p className="text-text-secondary mb-8 max-w-md">
            {paymentStatus === 'DECLINED'
              ? 'Tu entidad financiera ha rechazado la transacción. Puedes probar con otro medio de pago.'
              : 'Ocurrió un error inesperado o la transacción fue anulada. Tu cuenta sigue intacta.'}
          </p>
          <Button onClick={resetFlow} variant="primary" className="px-6 py-2.5">
            Intentar nuevamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-8 max-w-5xl mx-auto flex flex-col">
      {/* Top Header */}
      <header className="flex justify-between items-center py-4 mb-6 border-b border-border-light/20">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="ZonaFit Logo" className="w-8 object-contain" />
          <span className="text-lg font-bold text-white tracking-tight">ZONAFIT</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-brand-primary/15 text-brand-primary border border-brand-primary/30 flex items-center gap-1 font-medium">
            <ShieldCheck size={12} /> Checkout Seguro
          </span>
        </div>
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-text-muted hover:text-white"
        >
          <ArrowLeft size={16} /> Volver
        </Button>
      </header>

      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-text-primary mb-3">Elige tu plan comercial</h1>
        <p className="text-text-secondary text-base">
          Selecciona el plan que mejor se adapte a tu gimnasio para activar tu membresía.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {plans.map((plan: PlanInfo) => {
          const isSelected = selectedPlanId === plan.id;
          return (
            <div
              key={plan.id}
              onClick={() => handleSelectPlan(plan.id)}
              className={`relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${
                isSelected
                  ? 'ring-2 ring-brand-primary transform scale-[1.02]'
                  : 'hover:ring-1 hover:ring-border-strong'
              }`}
            >
              <div className={`rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 h-full p-6 flex flex-col ${isSelected ? 'bg-brand-primary/10 border-brand-primary/30' : ''}`}>
                <div className="mb-4">
                  <Badge variant={plan.billing_interval === 'YEARLY' ? 'success' : 'default'} className="mb-3">
                    {plan.billing_interval === 'YEARLY' ? 'Anual' : 'Mensual'}
                  </Badge>
                  <h3 className="text-xl font-bold text-text-primary">{plan.name}</h3>
                </div>

                <div className="flex items-baseline mb-4">
                  <span className="text-3xl font-bold text-text-primary">
                    {formatCurrency(plan.price)}
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
              </div>
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

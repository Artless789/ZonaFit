import { useState, useEffect } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Outlet, useLocation } from 'react-router-dom';
import { Card } from '@shared/ui/Card';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { Button } from '@shared/ui/Button';
import { ShieldAlert, Receipt, Zap, AlertCircle } from 'lucide-react';
import { Spinner } from '@shared/ui/Spinner';
import { Badge } from '@shared/ui/Badge';
import { useLicenseStatus, isSubscriptionActive, SUBSCRIPTION_QUERY_KEY } from '../shared/subscription/useLicenseStatus';
import { subscriptionService } from '../services/subscriptionService';

export function SubscriptionGuard() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const { data: subscription, isLoading, isError, refetch } = useLicenseStatus();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isBillingRoute = location.pathname.includes('/subscription/checkout') || location.pathname.includes('/settings/subscription');

  const emergencyMutation = useMutation({
    mutationFn: subscriptionService.requestEmergencyExtension,
    onSuccess: () => {
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.detail || 'No se pudo activar la prórroga de emergencia.');
    }
  });

  useEffect(() => {
    const handleSubscriptionRestricted = () => {
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
    };
    window.addEventListener('subscription-restricted', handleSubscriptionRestricted);
    return () => window.removeEventListener('subscription-restricted', handleSubscriptionRestricted);
  }, [queryClient]);

  // Siempre permitir acceso a checkout y gestión de suscripción para no atrapar al usuario en bucle de bloqueo
  if (isBillingRoute) {
    return <Outlet />;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner className="w-12 h-12" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card variant="surface" className="p-8 text-center max-w-lg mx-auto flex flex-col items-center gap-4 mt-8">
        <ShieldAlert className="w-12 h-12 text-danger" />
        <h2 className="text-xl font-bold text-text-primary">No se pudo verificar tu suscripción</h2>
        <p className="text-sm text-text-secondary">Ocurrió un error al intentar verificar el estado comercial de tu gimnasio.</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-brand-primary text-text-white rounded-md text-sm hover:bg-brand-primary-hover transition-fast"
        >
          Reintentar
        </button>
      </Card>
    );
  }

  if (subscription === null) {
    return (
      <Card variant="surface" className="p-8 text-center max-w-lg mx-auto flex flex-col items-center gap-6 mt-8">
        <div className="p-4 rounded-full bg-warning/10">
          <Receipt className="w-12 h-12 text-warning" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Sin Plan Activo</h2>
          <p className="text-text-secondary">Tu gimnasio aún no tiene una suscripción configurada.</p>
        </div>
        
        <div className="mt-4">
          <ActionGlowButton 
            className="px-8 py-3" 
            onClick={() => window.location.assign('/subscription/checkout')}
          >
            Ver planes
          </ActionGlowButton>
        </div>
      </Card>
    );
  }

  if (!subscription) return <Outlet />;

  if (!isSubscriptionActive(subscription)) {
    let reason = "Tu suscripción no es válida actualmente.";
    if (subscription.status === 'EXPIRED') reason = "Tu suscripción ha expirado y ha finalizado el periodo de gracia.";
    if (subscription.status === 'CANCELLED') reason = "Tu suscripción fue cancelada.";
    if (subscription.status === 'PAST_DUE') reason = "Tu suscripción presenta pagos atrasados.";
    if (subscription.status === 'TRIAL') reason = "Tu periodo de prueba ha expirado o requiere activación.";

    return (
      <Card variant="surface" className="p-8 text-center max-w-lg mx-auto flex flex-col items-center gap-6 mt-8">
        <div className="p-4 rounded-full bg-danger/10">
          <Receipt className="w-12 h-12 text-danger" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Acceso Restringido</h2>
          <p className="text-text-secondary">{reason}</p>
        </div>
        
        <div className="w-full flex flex-col gap-3 text-left bg-bg-surface p-4 rounded-lg border border-border-light">
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-muted">Estado actual:</span>
            <Badge variant="danger">{subscription.status}</Badge>
          </div>
          {subscription.plan && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-text-muted">Plan asociado:</span>
              <span className="text-sm font-medium text-text-primary">{subscription.plan.name}</span>
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="w-full p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="mt-2 flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
          <ActionGlowButton 
            className="px-8 py-3 w-full sm:w-auto"
            onClick={() => window.location.assign('/subscription/checkout')}
          >
            Actualizar plan
          </ActionGlowButton>

          {subscription.can_request_emergency_extension && (
            <Button
              variant="outline"
              onClick={() => emergencyMutation.mutate()}
              disabled={emergencyMutation.isPending}
              className="w-full sm:w-auto border-amber-500/40 text-amber-300 hover:bg-amber-500/10 flex items-center gap-2"
              title="Otorga 24 horas de acceso provisional para que puedas operar de inmediato"
            >
              <Zap size={16} className="text-amber-400" />
              {emergencyMutation.isPending ? 'Activando...' : 'Prórroga de Emergencia (24h)'}
            </Button>
          )}
        </div>

        {subscription.can_request_emergency_extension && (
          <p className="text-xs text-text-muted text-center mt-2">
            La prórroga de 24 horas te permite operar de emergencia mientras regularizas tu pago bancario.
          </p>
        )}
      </Card>
    );
  }

  return <Outlet />;
}

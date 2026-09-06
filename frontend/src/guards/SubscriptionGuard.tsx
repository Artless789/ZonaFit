import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Outlet } from 'react-router-dom';
import { Card } from '@shared/ui/Card';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { ShieldAlert, Receipt } from 'lucide-react';
import { Spinner } from '@shared/ui/Spinner';
import { Badge } from '@shared/ui/Badge';
import { useLicenseStatus, isSubscriptionActive, SUBSCRIPTION_QUERY_KEY } from '../shared/subscription/useLicenseStatus';

export function SubscriptionGuard() {
  const queryClient = useQueryClient();
  const { data: subscription, isLoading, isError, refetch } = useLicenseStatus();

  useEffect(() => {
    const handleSubscriptionRestricted = () => {
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
    };
    window.addEventListener('subscription-restricted', handleSubscriptionRestricted);
    return () => window.removeEventListener('subscription-restricted', handleSubscriptionRestricted);
  }, [queryClient]);

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
    if (subscription.status === 'EXPIRED') reason = "Tu suscripción ha expirado.";
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

        <div className="mt-4">
          <ActionGlowButton 
            className="px-8 py-3"
            onClick={() => window.location.assign('/subscription/checkout')}
          >
            Actualizar plan
          </ActionGlowButton>
        </div>

        <p className="text-xs text-text-muted text-center mt-2">
          Contacta con el soporte si crees que esto es un error.
        </p>
      </Card>
    );
  }

  return <Outlet />;
}

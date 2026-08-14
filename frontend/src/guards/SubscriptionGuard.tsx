import { useQuery } from '@tanstack/react-query';
import { Outlet, Link } from 'react-router-dom';
import { subscriptionService } from '../services/subscriptionService';
import { GlassCard } from '../components/shared/GlassCard';
import { ActionGlowButton } from '../components/shared/ActionGlowButton';
import { ShieldAlert, Receipt } from 'lucide-react';
import { Spinner } from '../components/shared/Spinner';
import { Badge } from '../components/shared/Badge';

function parseSubscriptionDate(value: string): Date {
  return new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`);
}

export function SubscriptionGuard() {
  const { data: subscription, isLoading, isError, refetch } = useQuery({
    queryKey: ['subscription', 'me'],
    queryFn: () => subscriptionService.getMySubscription(),
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner className="w-12 h-12" />
      </div>
    );
  }

  if (isError) {
    return (
      <GlassCard className="p-8 text-center max-w-lg mx-auto flex flex-col items-center gap-4 mt-8">
        <ShieldAlert className="w-12 h-12 text-danger" />
        <h2 className="text-xl font-bold text-text-primary">No se pudo verificar tu suscripción</h2>
        <p className="text-sm text-text-secondary">Ocurrió un error al intentar verificar el estado comercial de tu gimnasio.</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-brand-primary text-text-white rounded-md text-sm hover:bg-brand-primary-hover transition-fast"
        >
          Reintentar
        </button>
      </GlassCard>
    );
  }

  if (subscription === null) {
    return (
      <GlassCard className="p-8 text-center max-w-lg mx-auto flex flex-col items-center gap-6 mt-8">
        <div className="p-4 rounded-full bg-warning/10">
          <Receipt className="w-12 h-12 text-warning" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Sin Plan Activo</h2>
          <p className="text-text-secondary">Tu gimnasio aún no tiene una suscripción configurada.</p>
        </div>
        
        <div className="mt-4">
          <Link to="/subscription/checkout">
            <ActionGlowButton className="px-8 py-3">
              Ver planes
            </ActionGlowButton>
          </Link>
        </div>
      </GlassCard>
    );
  }

  if (!subscription) return <Outlet />;

  const isActive = () => {
    if (subscription.is_lifetime) return true;
    
    const now = new Date();
    
    if (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIAL') {
      return false;
    }
    
    if (subscription.starts_at && parseSubscriptionDate(subscription.starts_at) > now) {
      return false;
    }
    
    if (subscription.ends_at && parseSubscriptionDate(subscription.ends_at) < now) {
      return false;
    }
    
    return true;
  };

  if (!isActive()) {
    let reason = "Tu suscripción no es válida actualmente.";
    if (subscription.status === 'EXPIRED') reason = "Tu suscripción ha expirado.";
    if (subscription.status === 'CANCELLED') reason = "Tu suscripción fue cancelada.";
    if (subscription.status === 'PAST_DUE') reason = "Tu suscripción presenta pagos atrasados.";
    if (subscription.status === 'TRIAL') reason = "Tu periodo de prueba ha expirado o requiere activación.";

    return (
      <GlassCard className="p-8 text-center max-w-lg mx-auto flex flex-col items-center gap-6 mt-8">
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
          <Link to="/subscription/checkout">
            <ActionGlowButton className="px-8 py-3">
              Actualizar plan
            </ActionGlowButton>
          </Link>
        </div>

        <p className="text-xs text-text-muted text-center mt-2">
          Contacta con el soporte si crees que esto es un error.
        </p>
      </GlassCard>
    );
  }

  return <Outlet />;
}

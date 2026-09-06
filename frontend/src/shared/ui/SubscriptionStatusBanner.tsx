import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { subscriptionService } from '../../services/subscriptionService';
import { SUBSCRIPTION_QUERY_KEY } from '@shared/subscription/useLicenseStatus';

import { ActionGlowButton } from './ActionGlowButton';
import { Badge } from './Badge';
import { Skeleton } from './Skeleton';
import { CalendarClock, CheckCircle2, ShieldAlert } from 'lucide-react';

function parseSubscriptionDate(value: string): Date {
  return new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`);
}

export function SubscriptionStatusBanner() {
  const navigate = useNavigate();
  const { data: subscription, isLoading, isError } = useQuery({
    queryKey: SUBSCRIPTION_QUERY_KEY,
    queryFn: subscriptionService.getMySubscription
  });

  if (isLoading) {
    return <Skeleton className="h-24 w-full mb-6 rounded-xl" />;
  }

  if (isError || !subscription) {
    return null; // El Dashboard no debería fallar por esto, o SubscriptionGuard ya lo atajó.
  }

  const handleNavigateToSubscription = () => {
    if (window.location.pathname.startsWith('/demo')) {
      navigate('/demo/settings/subscription');
    } else {
      navigate('/settings/subscription');
    }
  };

  // Calculate days remaining
  const calculateDaysRemaining = () => {
    if (subscription.is_lifetime) return null;
    if (!subscription.ends_at) return null;
    const now = new Date();
    const end = parseSubscriptionDate(subscription.ends_at);
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const daysRemaining = calculateDaysRemaining();
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return parseSubscriptionDate(dateString).toLocaleDateString('es-CO', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  if (subscription.is_lifetime) {
    return (
      <div className="rounded-[var(--radius-xl)] p-4 mb-8 border border-emerald-500/20 bg-emerald-500/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-white">Plan vitalicio</h3>
                <Badge variant="success">LIFETIME</Badge>
              </div>
              <p className="text-sm text-text-secondary">Sin vencimiento. Disfruta de acceso permanente.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (subscription.status === 'TRIAL') {
    return (
      <div className="rounded-[var(--radius-xl)] p-4 mb-8 border border-info/30 bg-info/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-info/20 rounded-lg text-info">
              <CalendarClock size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-white">Tu periodo de prueba está activo</h3>
                <Badge variant="info">TRIAL</Badge>
              </div>
              <p className="text-sm text-text-secondary">
                {daysRemaining !== null 
                  ? `Te quedan ${daysRemaining} días. Vence el ${formatDate(subscription.ends_at)}.` 
                  : `Vence el ${formatDate(subscription.ends_at)}.`}
              </p>
            </div>
          </div>
          <ActionGlowButton 
            onClick={handleNavigateToSubscription}
            className="whitespace-nowrap px-6 py-2"
          >
            Ver planes
          </ActionGlowButton>
        </div>
      </div>
    );
  }

  // Periodo de Gracia (Grace Period)
  if (subscription.is_in_grace_period) {
    const daysGrace = subscription.days_left_in_grace ?? 0;
    return (
      <div className="rounded-xl p-4 mb-8 border border-amber-500/40 bg-amber-500/10 shadow-lg shadow-amber-950/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-amber-500/20 rounded-lg text-amber-400 shrink-0">
              <ShieldAlert size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-amber-300 text-base">Periodo de Gracia Activo</h3>
                <Badge variant="warning">GRACE PERIOD</Badge>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                Tu plan venció el <strong className="text-text-primary">{formatDate(subscription.ends_at)}</strong>. 
                Tienes <strong className="text-amber-300">{daysGrace > 0 ? `${daysGrace} día(s)` : 'últimas horas'}</strong> de gracia antes de la suspensión del torniquete y sistema.
              </p>
            </div>
          </div>
          <ActionGlowButton 
            onClick={handleNavigateToSubscription}
            className="whitespace-nowrap px-6 py-2.5 shrink-0"
          >
            Pagar y Regularizar
          </ActionGlowButton>
        </div>
      </div>
    );
  }

  if (subscription.status === 'ACTIVE') {
    // Si tiene más de 7 días, mostramos un banner sutil
    const isExpiringSoon = daysRemaining !== null && daysRemaining <= 7;
    
    return (
      <div className={`rounded-xl p-4 mb-8 border ${isExpiringSoon ? 'border-warning/30 bg-warning/5' : 'border-success/20 bg-success/5'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-lg ${isExpiringSoon ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'}`}>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-white">Plan {subscription.plan?.name || 'activo'}</h3>
                <Badge variant="success">ACTIVE</Badge>
              </div>
              <p className="text-sm text-text-secondary">
                {isExpiringSoon && daysRemaining !== null
                  ? `Atención: tu plan vence en ${daysRemaining} días (${formatDate(subscription.ends_at)}).`
                  : `Próxima renovación: ${formatDate(subscription.ends_at)}`}
              </p>
            </div>
          </div>
          {isExpiringSoon && (
            <ActionGlowButton 
              onClick={handleNavigateToSubscription}
              className="whitespace-nowrap px-6 py-2"
            >
              Renovar ahora
            </ActionGlowButton>
          )}
        </div>
      </div>
    );
  }

  // The rest (PAST_DUE, EXPIRED, CANCELLED) are technically blocked by SubscriptionGuard
  // But if they are rendered here, handle them properly.
  
  return (
    <div className="rounded-[var(--radius-xl)] p-4 mb-8 border border-danger/30 bg-danger/5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-danger/20 rounded-lg text-danger">
            <ShieldAlert size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-white">
                {subscription.status === 'PAST_DUE' ? 'Tu suscripción requiere atención' : 'Tu suscripción ha vencido'}
              </h3>
              <Badge variant="danger">{subscription.status}</Badge>
            </div>
            <p className="text-sm text-text-secondary">
              Venció el {formatDate(subscription.ends_at)}. Actualiza tu plan para recuperar el acceso total.
            </p>
          </div>
        </div>
        <ActionGlowButton 
          onClick={handleNavigateToSubscription}
          className="whitespace-nowrap px-6 py-2"
        >
          Elegir un plan
        </ActionGlowButton>
      </div>
    </div>
  );
}

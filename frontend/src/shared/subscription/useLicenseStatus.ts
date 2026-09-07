import { useQuery } from '@tanstack/react-query';
import { subscriptionService } from '../../services/subscriptionService';
import type { SubscriptionInfo } from '../../services/subscriptionService';

// Clave canónica única para toda la codebase
export const SUBSCRIPTION_QUERY_KEY = ['subscription', 'me'] as const;

function parseSubscriptionDate(value: string): Date {
  if (!value) return new Date();
  // Ensure string is treated as UTC if no timezone offset is present
  const hasTimezone = value.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(value);
  const normalized = hasTimezone ? value : `${value}Z`;
  return new Date(normalized);
}

const CLOCK_DRIFT_TOLERANCE_MS = 15 * 60 * 1000; // 15 minutos de tolerancia para desajustes de reloj cliente-servidor

export function isSubscriptionActive(subscription: SubscriptionInfo | null | undefined): boolean {
  if (!subscription) return false;
  if (subscription.is_lifetime) return true;
  if (subscription.is_in_grace_period) return true; // Grace period preserves active operational access

  const now = new Date();
  if (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIAL') return false;

  // Los periodos de prueba (TRIAL) inician inmediatamente al registrarse/activarse.
  // Para otras suscripciones, se valida starts_at con tolerancia contra reloj desfasado.
  if (subscription.status !== 'TRIAL' && subscription.starts_at) {
    const startsAt = parseSubscriptionDate(subscription.starts_at);
    if (startsAt.getTime() > now.getTime() + CLOCK_DRIFT_TOLERANCE_MS) {
      return false;
    }
  }

  // Validación de fecha de fin
  if (subscription.ends_at) {
    const endsAt = parseSubscriptionDate(subscription.ends_at);
    if (endsAt < now) return false;
  }

  return true;
}

export function useLicenseStatus() {
  return useQuery({
    queryKey: SUBSCRIPTION_QUERY_KEY,
    queryFn: () => subscriptionService.getMySubscription(),
    refetchOnWindowFocus: true,    // EXPLÍCITO: sobreescribe el false global del QueryClient
    staleTime: 1000 * 60 * 5,     // 5 minutos — limita re-fetches excesivos
    retry: 1,
  });
}

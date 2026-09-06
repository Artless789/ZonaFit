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

export function isSubscriptionActive(subscription: SubscriptionInfo | null | undefined): boolean {
  if (!subscription) return false;
  if (subscription.is_lifetime) return true;

  const now = new Date();
  if (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIAL') return false;
  if (subscription.starts_at && parseSubscriptionDate(subscription.starts_at) > now) return false;
  if (subscription.ends_at && parseSubscriptionDate(subscription.ends_at) < now) return false;
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

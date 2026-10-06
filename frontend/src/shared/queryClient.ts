import { QueryClient } from '@tanstack/react-query';
import type { Query } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { PersistedClient } from '@tanstack/query-persist-client-core';

export const PERSIST_CACHE_BUSTER = 'zf-cache-v2';
export const PERSIST_MAX_AGE = 1000 * 60 * 30; // 30 minutos máximo para configuración/catálogos estáticos

/**
 * Queries operativas, financieras, de seguridad y de administración que NUNCA
 * deben persistirse en localStorage para evitar mostrar datos de sesiones o días
 * anteriores como si fueran el estado actual del gimnasio.
 */
const NON_PERSISTED_QUERY_KEYS = new Set([
  // Autenticación, seguridad, usuarios y auditoría
  'auth',
  'sensitive',
  'users',
  'audit',
  'audit-logs',
  'superadmin-audit',
  'superadmin-dashboard',
  'superadmin-gyms',
  'superadmin-gym-detail',
  'superadmin-plans',
  'superadmin-plans-all',
  'superadmin-subscriptions',
  'superadmin-users',
  // Datos operativos y financieros críticos / volátiles
  'clients',
  'client360',
  'memberships',
  'payments',
  'sales',
  'invoices',
  'invoiceDetails',
  'cash-registers',
  'cash-movements',
  'accounts-receivables',
  'products',
  'inventory-movements',
  'categories',
  'dashboard',
  'incomeDetails',
  'reports',
  'notifications',
  'subscription',
]);

/**
 * Únicas queries estáticas/configuración elegibles para persistencia local breve.
 * Las queries por gimnasio exigen gym_id explícito en queryKey[1] para aislamiento multi-tenant.
 */
const TENANT_SCOPED_STATIC_KEYS = new Set(['gymSettings', 'membershipPlans']);
const GLOBAL_STATIC_KEYS = new Set(['availablePlans']);

export const isPersistableQueryKey = (queryKey: readonly unknown[]): boolean => {
  if (!Array.isArray(queryKey) || queryKey.length === 0) {
    return false;
  }

  const rootKey = String(queryKey[0] ?? '');
  const queryKeyStr = JSON.stringify(queryKey).toLowerCase();

  // Never persist auth, sensitive data, superadmin, or tenant-specific user/audit data across sessions
  if (
    queryKeyStr.includes('auth') ||
    queryKeyStr.includes('sensitive') ||
    queryKeyStr.includes('"users"') ||
    queryKeyStr.includes('audit') ||
    queryKeyStr.includes('superadmin')
  ) {
    return false;
  }

  if (NON_PERSISTED_QUERY_KEYS.has(rootKey)) {
    return false;
  }

  if (TENANT_SCOPED_STATIC_KEYS.has(rootKey)) {
    const tenantId = queryKey[1];
    return (
      (typeof tenantId === 'number' && Number.isFinite(tenantId)) ||
      (typeof tenantId === 'string' && tenantId.trim().length > 0)
    );
  }

  if (GLOBAL_STATIC_KEYS.has(rootKey)) {
    return true;
  }

  return false;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 1000 * 10, // 10 segundos en memoria para reactividad operacional inmediata
      gcTime: PERSIST_MAX_AGE, // 30 minutos en memoria (sin retención de 24h)
      networkMode: 'online',
    },
    mutations: {
      networkMode: 'online',
    }
  },
});

export const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  deserialize: (cachedString: string): PersistedClient => {
    const parsed = JSON.parse(cachedString) as PersistedClient;
    if (parsed?.clientState?.queries && Array.isArray(parsed.clientState.queries)) {
      parsed.clientState.queries = parsed.clientState.queries.filter((q) =>
        isPersistableQueryKey(q.queryKey)
      );
    }
    return parsed;
  },
});

// Garantizar que al ejecutar queryClient.clear() (ej. en login, logout o 401)
// se elimine inmediatamente la entrada de caché persistida sin esperar el throttle.
queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'removed' && queryClient.getQueryCache().getAll().length === 0) {
    persister.removeClient();
  }
});

export const dehydrateQueryFilter = (query: Query): boolean => {
  if (query.state.status !== 'success') {
    return false;
  }
  return isPersistableQueryKey(query.queryKey);
};

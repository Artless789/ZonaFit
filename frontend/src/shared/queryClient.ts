import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutos
      gcTime: 1000 * 60 * 60 * 24, // 24 horas en caché para offline
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'online',
    }
  },
});

export const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

export const dehydrateQueryFilter = (query: any) => {
  const queryKeyStr = JSON.stringify(query.queryKey).toLowerCase();
  // Never persist auth, sensitive data, or tenant-specific user/audit data across sessions
  if (
    queryKeyStr.includes('auth') ||
    queryKeyStr.includes('sensitive') ||
    queryKeyStr.includes('"users"') ||
    queryKeyStr.includes('audit')
  ) {
    return false;
  }
  return query.state.status === 'success';
};

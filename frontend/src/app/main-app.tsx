import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import '../index.css'
import AppOperativa from './AppOperativa.tsx'
import { ToastProvider } from '@shared/ui/Toast'
import { registerSW } from 'virtual:pwa-register'
import { OfflineBanner } from '../shared/network/OfflineBanner';
import { SyncIndicator } from '../shared/offline/SyncIndicator';
import {
  queryClient,
  persister,
  dehydrateQueryFilter,
  PERSIST_CACHE_BUSTER,
  PERSIST_MAX_AGE,
} from '@shared/queryClient'

// Auto-reload on vite dynamic import preload error (ChunkLoadError after new deployment)
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Vite preload error detected, reloading to fetch latest assets...', event);
  window.location.reload();
});

// Registramos el SW exclusivo para la App de forma diferida tras window.load / idle
if ('serviceWorker' in navigator) {
  const scheduleSW = () => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => registerSW({ immediate: true }));
    } else {
      setTimeout(() => registerSW({ immediate: true }), 1000);
    }
  };

  if (document.readyState === 'complete') {
    scheduleSW();
  } else {
    window.addEventListener('load', scheduleSW);
  }
}

export { queryClient };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider 
      client={queryClient}
      persistOptions={{
        persister,
        buster: PERSIST_CACHE_BUSTER,
        maxAge: PERSIST_MAX_AGE,
        dehydrateOptions: {
          shouldDehydrateQuery: dehydrateQueryFilter
        }
      }}
    >
      <ToastProvider>
        <OfflineBanner />
        <SyncIndicator />
        <AppOperativa />
      </ToastProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
)

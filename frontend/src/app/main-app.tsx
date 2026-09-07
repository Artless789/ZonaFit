import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import '../index.css'
import AppOperativa from './AppOperativa.tsx'
import { ToastProvider } from '@shared/ui/Toast'
import { registerSW } from 'virtual:pwa-register'
import { OfflineBanner } from '../shared/network/OfflineBanner';
import { SyncIndicator } from '../shared/offline/SyncIndicator';
import { queryClient, persister, dehydrateQueryFilter } from '@shared/queryClient'

// Registramos el SW exclusivo para la App de forma diferida tras window.load / idle
if ('serviceWorker' in navigator) {
  const scheduleSW = () => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => registerSW());
    } else {
      setTimeout(() => registerSW(), 1000);
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
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
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

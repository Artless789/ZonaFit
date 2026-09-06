import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import '../index.css'
import Web from './Web.tsx'
import { ToastProvider } from '@shared/ui/Toast'
import { setupDemoInterceptor } from '../demo/demoInterceptor'
import { OfflineBanner } from '@shared/network/OfflineBanner'
import { queryClient, persister, dehydrateQueryFilter } from '@shared/queryClient'

setupDemoInterceptor();

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
        <Web />
      </ToastProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
)

import React, { useEffect, useState } from 'react';
import { SyncManager } from './syncManager';
import { SyncStatus } from './offlineTypes';
import { RefreshCw, CheckCircle, AlertTriangle, CloudOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const SyncIndicator: React.FC = () => {
  const [pending, setPending] = useState(0);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Suscripción al SyncManager
    const unsubscribe = SyncManager.subscribe((count, newStatus) => {
      setPending(count);
      setStatus(newStatus);
      
      if (count > 0 || newStatus === 'syncing' || newStatus === 'error') {
        setIsVisible(true);
      } else if (newStatus === 'success' && count === 0) {
        // Ocultar después de unos segundos de éxito
        setTimeout(() => setIsVisible(false), 3000);
      }
    });

    return () => { unsubscribe(); };
  }, []);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium"
      >
        {status === 'syncing' && (
          <>
            <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
            <span>Sincronizando {pending} operaciones...</span>
          </>
        )}
        
        {status === 'idle' && pending > 0 && (
          <>
            <CloudOff className="w-4 h-4 text-orange-400" />
            <span>{pending} {pending === 1 ? 'operación pendiente' : 'operaciones pendientes'}</span>
          </>
        )}
        
        {status === 'error' && (
          <>
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span>{pending} {pending === 1 ? 'operación requiere' : 'operaciones requieren'} atención</span>
          </>
        )}
        
        {status === 'success' && pending === 0 && (
          <>
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span>Sincronizado</span>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

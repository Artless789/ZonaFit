import React, { useEffect, useState } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [showRestored, setShowRestored] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowRestored(false);
    } else if (isOnline && wasOffline) {
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
        setWasOffline(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-0 left-0 right-0 z-[100] flex justify-center p-2 pointer-events-none"
        >
          <div className="bg-amber-900/90 text-amber-50 border border-amber-500/30 shadow-lg backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-3 text-sm font-medium">
            <WifiOff className="w-4 h-4 text-amber-400" />
            <span>Sin conexión a Internet. Los datos pueden no estar actualizados.</span>
          </div>
        </motion.div>
      )}

      {showRestored && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-0 left-0 right-0 z-[100] flex justify-center p-2 pointer-events-none"
        >
          <div className="bg-emerald-900/90 text-emerald-50 border border-emerald-500/30 shadow-lg backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-3 text-sm font-medium">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Conexión restaurada</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

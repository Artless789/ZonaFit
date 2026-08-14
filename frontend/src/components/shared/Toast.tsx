import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '../../utils/cn';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextType {
  toast: (options: Omit<ToastProps, 'id'>) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const toastIcons = {
  success: <CheckCircle className="text-success" size={20} />,
  error: <AlertCircle className="text-danger" size={20} />,
  warning: <AlertTriangle className="text-warning" size={20} />,
  info: <Info className="text-info" size={20} />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const addToast = useCallback((options: Omit<ToastProps, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, ...options }]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      
      <div className="fixed bottom-0 right-0 z-[var(--z-toast)] p-6 flex flex-col gap-3 pointer-events-none w-full max-w-sm">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              className={cn(
                "pointer-events-auto flex w-full flex-col gap-1 rounded-xl bg-bg-elevated p-4 shadow-lg border",
                toast.type === 'success' && "border-success/20",
                toast.type === 'error' && "border-danger/20",
                toast.type === 'warning' && "border-warning/20",
                toast.type === 'info' && "border-info/20",
                "backdrop-blur-[var(--glass-blur)]"
              )}
              role="alert"
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  {toastIcons[toast.type]}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-text-primary">
                    {toast.title}
                  </h3>
                  {toast.message && (
                    <p className="mt-1 text-sm text-text-secondary">
                      {toast.message}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="shrink-0 rounded-md p-1 text-text-muted hover:bg-border-light transition-colors focus:outline-none"
                  aria-label="Cerrar notificación"
                >
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

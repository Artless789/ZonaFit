import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@shared/utils/cn';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  position?: 'left' | 'right';
  size?: 'md' | 'lg' | 'xl';
  hideHeader?: boolean;
  noPadding?: boolean;
}

export function Drawer({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  className,
  position = 'right',
  size = 'md',
  hideHeader = false,
  noPadding = false
}: DrawerProps) {
  useEffect(() => {
    if (!isOpen) return;
    const prevCount = Number(document.body.dataset.scrollLockCount || '0');
    document.body.dataset.scrollLockCount = String(prevCount + 1);
    document.body.style.overflow = 'hidden';

    return () => {
      const currentCount = Number(document.body.dataset.scrollLockCount || '1');
      const nextCount = Math.max(0, currentCount - 1);
      if (nextCount === 0) {
        delete document.body.dataset.scrollLockCount;
        document.body.style.overflow = '';
      } else {
        document.body.dataset.scrollLockCount = String(nextCount);
      }
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const slideVariants = {
    hidden: { x: position === 'right' ? '100%' : '-100%' },
    visible: { x: 0 },
  };

  const sizeClass = {
    'md': 'max-w-md',
    'lg': 'max-w-2xl',
    'xl': 'max-w-4xl'
  }[size];

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[var(--z-drawer)] flex">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md touch-manipulation"
            aria-hidden="true"
          />
          
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={slideVariants}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
              "material-glass-strong relative flex h-dvh max-h-dvh w-full flex-col shadow-modal",
              position === 'right' ? "ml-auto border-l border-border-medium" : "mr-auto border-r border-border-medium",
              sizeClass,
              className
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? "drawer-title" : undefined}
          >
            {!hideHeader && (
              <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5 border-b border-border-light shrink-0">
                {title && (
                  <h2 id="drawer-title" className="text-base sm:text-lg font-semibold tracking-tight text-text-primary truncate">
                    {title}
                  </h2>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-white/[0.06] hover:text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary cursor-pointer touch-manipulation"
                  aria-label="Cerrar cajón"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            {hideHeader && (
               <button
                 type="button"
                 onClick={onClose}
                 className="
                   absolute top-3 right-3 sm:top-4 sm:right-4 z-50 flex size-10 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary cursor-pointer touch-manipulation
                 "
                 aria-label="Cerrar cajón"
               >
                 <X size={20} />
               </button>
            )}
            <div
              className={cn(
                "flex-1 overflow-y-auto overscroll-contain text-text-secondary",
                !noPadding && "p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:p-6 [&>form]:h-auto [&>form]:min-h-full"
              )}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

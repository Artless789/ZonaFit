import { useEffect } from 'react';
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
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[var(--z-drawer)] flex">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            aria-hidden="true"
          />
          
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={slideVariants}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
              "material-glass-strong relative flex h-full w-full flex-col shadow-xl",
              sizeClass,
              position === 'right' ? "ml-auto" : "mr-auto",
              className
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? "drawer-title" : undefined}
          >
            {!hideHeader && (
              <div className="flex items-center justify-between p-6 border-b border-border-light">
                {title && (
                  <h2 id="drawer-title" className="text-xl font-semibold text-text-primary">
                    {title}
                  </h2>
                )}
                <button
                  onClick={onClose}
                  className="rounded-full p-1 text-text-muted hover:bg-border-light hover:text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  aria-label="Cerrar cajón"
                >
                  <X size={20} />
                </button>
              </div>
            )}
            {hideHeader && (
               <button
                 onClick={onClose}
                 className="absolute top-4 right-4 z-50 rounded-full p-1.5 bg-black/20 text-white hover:bg-black/40 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary"
                 aria-label="Cerrar cajón"
               >
                 <X size={20} />
               </button>
            )}
            <div className={cn("flex-1 overflow-y-auto text-text-secondary", !noPadding && "p-6")}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

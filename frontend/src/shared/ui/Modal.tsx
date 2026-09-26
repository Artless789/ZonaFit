import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

import { cn } from '@shared/utils/cn';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  hideCloseButton?: boolean;
}

export function Modal({ 
  isOpen, 
  onClose, 
  title,
  description,
  children, 
  footer,
  className,
  containerClassName,
  hideCloseButton = false
}: ModalProps) {
  // Prevent body scroll when modal is open
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

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-(--z-modal) flex items-center justify-center p-4 sm:p-6">
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
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn("relative w-full max-w-lg z-[calc(var(--z-modal)+1)] flex flex-col", containerClassName)}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? "modal-title" : undefined}
            aria-describedby={description ? "modal-description" : undefined}
          >
            <div className={cn("w-full flex flex-col max-h-[90vh] shadow-modal overflow-hidden material-glass-strong rounded-[var(--radius-2xl)] border border-border-medium", className)}>
              {/* Header */}
              {(title || !hideCloseButton) && (
                <div className="shrink-0 flex items-start justify-between px-6 py-5 border-b border-border-light">
                  <div className="flex flex-col gap-1 pr-4">
                    {title && (
                      <h2 id="modal-title" className="text-lg font-semibold tracking-tight text-text-primary">
                        {title}
                      </h2>
                    )}
                    {description && (
                      <div id="modal-description" className="text-sm text-text-secondary">
                        {description}
                      </div>
                    )}
                  </div>
                  {!hideCloseButton && (
                    <button
                      onClick={onClose}
                      className="shrink-0 rounded-full p-1.5 text-text-muted hover:bg-white/[0.06] hover:text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      aria-label="Cerrar modal"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              )}
              
              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 text-text-secondary">
                {children}
              </div>

              {/* Footer */}
              {footer && (
                <div className="shrink-0 px-6 py-4 border-t border-border-light bg-surface-base/40 flex items-center justify-end gap-3">
                  {footer}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: any;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ 
  title = "No pudimos cargar la información", 
  description, 
  error,
  onRetry, 
  className = '' 
}: ErrorStateProps) {
  
  // Extract userMessage if available (from our api interceptor)
  const message = description || error?.userMessage || "Comprueba tu conexión e inténtalo nuevamente.";

  return (
    <Card variant="surface" className={`flex flex-col items-center justify-center p-10 text-center border-brand-primary/20 ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center max-w-sm"
      >
        <div className="w-14 h-14 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary mb-4 shadow-[0_0_15px_rgba(220,38,38,0.15)]">
          <AlertTriangle size={28} />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-text-muted text-sm mb-6">{message}</p>
        
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <RefreshCcw size={16} className="mr-2" />
            Reintentar
          </Button>
        )}
      </motion.div>
    </Card>
  );
}

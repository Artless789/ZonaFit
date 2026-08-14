import { motion } from 'framer-motion';
import { GlassCard } from './GlassCard';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <GlassCard className={`flex flex-col items-center justify-center p-12 text-center border-dashed border-border-strong/50 bg-surface-dark/30 ${className}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center max-w-sm"
      >
        {icon && (
          <div className="w-16 h-16 rounded-full bg-surface-dark border border-border-strong flex items-center justify-center text-text-muted mb-4 shadow-inner">
            {icon}
          </div>
        )}
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-text-muted text-sm mb-6">{description}</p>
        {action && <div>{action}</div>}
      </motion.div>
    </GlassCard>
  );
}

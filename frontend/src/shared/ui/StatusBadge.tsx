import { ReactNode } from 'react';
import { cn } from '@shared/utils/cn';

export type SystemStatus =
  | 'active'
  | 'expired'
  | 'pending'
  | 'paid'
  | 'open'
  | 'closed'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

export interface StatusBadgeProps {
  /** Domain status code */
  status: SystemStatus;
  /** Custom label override (defaults to standardized Spanish uppercase) */
  label?: ReactNode;
  /** Display style: pill (rounded background), dot (inline indicator), outline */
  mode?: 'pill' | 'dot' | 'outline';
  /** Size tier */
  size?: 'sm' | 'md';
  className?: string;
}

const DEFAULT_LABELS: Record<SystemStatus, string> = {
  active: 'Activo',
  expired: 'Vencido',
  pending: 'Pendiente',
  paid: 'Pagado',
  open: 'Abierta',
  closed: 'Cerrada',
  success: 'Éxito',
  warning: 'Alerta',
  danger: 'Error',
  info: 'Info',
  neutral: 'Neutral',
};

export function StatusBadge({
  status,
  label,
  mode = 'pill',
  size = 'md',
  className,
}: StatusBadgeProps) {
  const displayLabel = label ?? DEFAULT_LABELS[status];

  // Visual tokens per semantic state
  const isEmerald = status === 'active' || status === 'paid' || status === 'open' || status === 'success';
  const isDanger = status === 'expired' || status === 'danger';
  const isWarning = status === 'pending' || status === 'warning';
  const isInfo = status === 'info';
  const isNeutral = status === 'closed' || status === 'neutral';

  if (mode === 'dot') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 font-mono select-none',
          size === 'sm' && 'text-[10px]',
          size === 'md' && 'text-[11px]',
          isEmerald && 'text-emerald-400',
          isDanger && 'text-brand-primary',
          isWarning && 'text-amber-400',
          isInfo && 'text-blue-400',
          isNeutral && 'text-text-muted',
          className
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'size-1.5 rounded-full shrink-0',
            isEmerald && 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]',
            isDanger && 'bg-brand-primary shadow-[0_0_8px_rgba(220,38,38,0.7)]',
            isWarning && 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]',
            isInfo && 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.7)]',
            isNeutral && 'bg-text-muted'
          )}
        />
        <span>{displayLabel}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-mono uppercase tracking-[0.14em] font-medium transition-colors select-none',
        size === 'sm' && 'px-2 py-0.5 text-[9px]',
        size === 'md' && 'px-2.5 py-1 text-[10px]',
        mode === 'pill' && [
          isEmerald && 'border border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
          isDanger && 'border border-brand-primary/35 bg-brand-primary/15 text-red-300',
          isWarning && 'border border-amber-400/25 bg-amber-400/10 text-amber-300',
          isInfo && 'border border-blue-400/25 bg-blue-400/10 text-blue-300',
          isNeutral && 'border border-white/10 bg-white/[0.04] text-text-muted',
        ],
        mode === 'outline' && [
          'bg-transparent',
          isEmerald && 'border border-emerald-400/40 text-emerald-400',
          isDanger && 'border border-brand-primary/50 text-brand-primary',
          isWarning && 'border border-amber-400/40 text-amber-400',
          isInfo && 'border border-blue-400/40 text-blue-400',
          isNeutral && 'border border-border-light text-text-muted',
        ],
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 rounded-full shrink-0',
          isEmerald && 'bg-emerald-400',
          isDanger && 'bg-brand-primary',
          isWarning && 'bg-amber-400',
          isInfo && 'bg-blue-400',
          isNeutral && 'bg-text-muted'
        )}
      />
      <span>{displayLabel}</span>
    </span>
  );
}

StatusBadge.displayName = 'StatusBadge';

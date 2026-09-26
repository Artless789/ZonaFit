import { HTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@shared/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold tracking-wide uppercase transition-colors duration-150 select-none',
  {
    variants: {
      variant: {
        default: 'bg-brand-primary/10 text-brand-primary border border-brand-primary/25',
        brand: 'bg-brand-primary/10 text-brand-primary border border-brand-primary/25',
        neutral: 'bg-white/[0.04] text-text-secondary border border-border-light',
        success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
        warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
        danger: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
        info: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div 
        ref={ref}
        className={cn(badgeVariants({ variant }), className)} 
        {...props} 
      />
    );
  }
);

Badge.displayName = 'Badge';

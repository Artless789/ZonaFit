import { HTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@shared/utils/cn';

const cardVariants = cva(
  'relative overflow-hidden transition-all duration-200',
  {
    variants: {
      variant: {
        panel: 'bg-surface-panel border border-border-light shadow-subtle rounded-[var(--radius-xl)]',
        surface: 'bg-surface-panel border border-border-light shadow-subtle rounded-[var(--radius-xl)]',
        elevated: 'bg-surface-raised border border-border-medium shadow-elevated rounded-[var(--radius-xl)]',
        glass: 'liquid-glass rounded-[24px] md:rounded-[28px]',
        'glass-soft': 'liquid-glass-soft rounded-[var(--radius-xl)]',
        'glass-elevated': 'liquid-glass-elevated rounded-[24px] md:rounded-[28px]',
        metric: 'bg-surface-panel border border-border-light rounded-[var(--radius-lg)] shadow-xs hover:border-border-medium transition-all',
        section: 'bg-surface-panel border border-border-light rounded-[var(--radius-xl)]',
        interactive: 'bg-surface-panel border border-border-light rounded-[var(--radius-xl)] shadow-subtle hover:border-border-medium hover:shadow-elevated hover:-translate-y-0.5 transition-all cursor-pointer',
        default: 'bg-surface-panel border border-border-light shadow-subtle rounded-[var(--radius-xl)]',
      },
      padding: {
        none: 'p-0',
        xs: 'p-3',
        sm: 'p-4',
        md: 'p-5 sm:p-6',
        lg: 'p-6 sm:p-8',
        xl: 'p-8 sm:p-10',
      },
      hover: {
        true: 'hover:shadow-elevated hover:border-border-medium hover:-translate-y-0.5',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'panel',
      padding: 'md',
      hover: false,
    },
  }
);

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, hover, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(cardVariants({ variant, padding, hover, className }))}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

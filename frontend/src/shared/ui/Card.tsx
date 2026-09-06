import { HTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@shared/utils/cn';

const cardVariants = cva(
  'relative overflow-hidden transition-all duration-300',
  {
    variants: {
      variant: {
        surface: 'material-surface rounded-[var(--radius-xl)]',
        elevated: 'material-elevated rounded-[var(--radius-xl)]',
        glass: 'material-glass rounded-[var(--radius-xl)]',
        metric: 'bg-bg-page border border-border-light rounded-[var(--radius-xl)]',
        section: 'bg-bg-surface border border-border-medium rounded-[var(--radius-xl)]',
        default: 'material-surface rounded-[var(--radius-xl)]',
      },
      padding: {
        none: 'p-0',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
        xl: 'p-10',
      },
      hover: {
        true: 'hover:shadow-md hover:-translate-y-1',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'surface',
      padding: 'lg',
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

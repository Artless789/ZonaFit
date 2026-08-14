import { HTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const cardVariants = cva(
  'relative overflow-hidden transition-all duration-300',
  {
    variants: {
      variant: {
        default: 'bg-bg-elevated border border-border-medium shadow-sm rounded-[var(--radius-xl)]',
        glass: 'glass-card',
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
      variant: 'default',
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

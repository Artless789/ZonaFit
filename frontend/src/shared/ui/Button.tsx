import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@shared/utils/cn';

const buttonVariants = cva(
  'group inline-flex items-center justify-center rounded-[var(--radius-md)] text-sm font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-page disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-brand-primary text-white shadow-sm hover:bg-brand-primary-hover active:bg-brand-primary-active active:scale-[0.98]',
        secondary:
          'bg-bg-elevated text-text-primary border border-border-medium shadow-xs hover:border-border-strong hover:bg-bg-surface-hover active:scale-[0.98]',
        outline:
          'border border-border-medium text-text-primary hover:bg-bg-surface-hover hover:border-border-strong active:scale-[0.98]',
        ghost:
          'text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover active:scale-[0.98]',
        danger:
          'bg-danger text-white shadow-sm hover:bg-danger/90 active:scale-[0.98]',
        link:
          'text-text-secondary hover:text-brand-primary p-0 h-auto bg-transparent active:scale-[0.98]',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-8 text-lg',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, leftIcon, rightIcon, children, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading && (
          <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {!isLoading && leftIcon && (
          <span className={cn("flex items-center", children ? "mr-2" : "", variant === 'link' && "transition-transform group-hover:-translate-x-1")}>
            {leftIcon}
          </span>
        )}
        {children}
        {!isLoading && rightIcon && (
          <span className={cn("flex items-center", children ? "ml-2" : "", variant === 'link' && "transition-transform group-hover:translate-x-1")}>
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

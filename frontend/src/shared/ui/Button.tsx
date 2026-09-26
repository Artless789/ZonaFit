import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@shared/utils/cn';

const buttonVariants = cva(
  'group inline-flex items-center justify-center font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
  {
    variants: {
      variant: {
        primary:
          'bg-brand-primary text-white shadow-glow-brand hover:bg-brand-primary-hover active:bg-brand-primary-active active:scale-[0.98]',
        secondary:
          'bg-surface-raised text-text-primary border border-border-medium shadow-xs hover:border-border-strong hover:bg-surface-panel-hover active:scale-[0.98]',
        outline:
          'border border-border-medium bg-transparent text-text-primary hover:bg-surface-panel-hover hover:border-border-strong active:scale-[0.98]',
        ghost:
          'bg-transparent text-text-secondary hover:text-text-primary hover:bg-white/[0.05] active:scale-[0.98]',
        danger:
          'bg-danger text-white shadow-sm hover:bg-danger/90 active:scale-[0.98]',
        link:
          'text-text-secondary hover:text-brand-primary p-0 h-auto bg-transparent active:scale-[0.98]',
      },
      size: {
        default: 'h-10 px-4 py-2 text-sm rounded-[var(--radius-md)]',
        sm: 'h-8 px-3 text-xs rounded-[var(--radius-sm)]',
        lg: 'h-11 px-6 text-base rounded-[var(--radius-md)]',
        icon: 'h-9 w-9 p-0 rounded-[var(--radius-md)]',
        'icon-sm': 'h-7.5 w-7.5 p-0 rounded-[var(--radius-sm)]',
        'icon-lg': 'h-11 w-11 p-0 rounded-[var(--radius-md)]',
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

import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const buttonVariants = cva(
  'group inline-flex items-center justify-center rounded-[var(--radius-md)] text-sm font-medium transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden',
  {
    variants: {
      variant: {
        primary:
          'bg-brand-primary/95 text-white border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-2px_6px_rgba(0,0,0,0.3),0_4px_12px_-2px_rgba(220,38,38,0.3)] hover:bg-brand-primary hover:border-white/20 hover:shadow-[inset_0_1px_2px_rgba(255,255,255,0.35),inset_0_-2px_6px_rgba(0,0,0,0.3),0_6px_16px_-2px_rgba(220,38,38,0.4)] active:scale-[0.97] active:shadow-[inset_0_2px_8px_rgba(0,0,0,0.4)]',
        secondary:
          'bg-bg-surface/50 text-text-primary border border-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.06),0_4px_12px_rgba(0,0,0,0.2)] backdrop-blur-md hover:bg-bg-elevated/70 hover:border-white/[0.1] hover:shadow-[inset_0_1px_2px_rgba(255,255,255,0.1),0_6px_16px_rgba(0,0,0,0.25)] active:scale-[0.97] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]',
        outline:
          'border border-border-strong text-text-primary hover:bg-white/[0.03] hover:border-white/10 active:scale-[0.97]',
        ghost:
          'text-text-secondary hover:text-text-primary hover:bg-white/[0.04] active:scale-[0.97]',
        danger:
          'bg-danger/90 text-white border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-2px_6px_rgba(0,0,0,0.3),0_4px_12px_-2px_rgba(220,38,38,0.3)] hover:bg-danger hover:border-white/20 hover:shadow-[inset_0_1px_2px_rgba(255,255,255,0.3),inset_0_-2px_6px_rgba(0,0,0,0.3),0_6px_16px_-2px_rgba(220,38,38,0.4)] active:scale-[0.97] active:shadow-[inset_0_2px_8px_rgba(0,0,0,0.4)]',
        link:
          'text-text-secondary hover:text-brand-primary p-0 h-auto bg-transparent shadow-none border-none hover:shadow-none hover:bg-transparent active:scale-[0.98]',
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

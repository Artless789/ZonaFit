import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@shared/utils/cn';
import { Spinner } from './Spinner';

export interface ActionGlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
}

export const ActionGlowButton = forwardRef<HTMLButtonElement, ActionGlowButtonProps>(
  ({ className, children, isLoading, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "group relative inline-flex items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-brand-primary/40 bg-gradient-to-b from-[#EF4444] to-[#DC2626] px-4.5 py-2 text-sm font-semibold text-white shadow-glow-brand transition-all duration-150 ease-out hover:brightness-105 hover:border-brand-primary/60 hover:shadow-[0_6px_20px_-2px_rgba(220,38,38,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base active:scale-[0.98] active:brightness-95 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer",
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {/* Capa de iluminación interactiva (Sheen) */}
        <span 
          className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] bg-gradient-to-tr from-transparent via-white/[0.1] to-transparent opacity-0 transition-all duration-[1000ms] ease-out group-hover:translate-x-[100%] group-hover:opacity-100 -translate-x-[100%]"
          aria-hidden="true"
        />
        
        {/* Highlight especular estático */}
        <span 
          className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]"
          aria-hidden="true"
        />

        <span className="relative z-10 flex items-center justify-center gap-2">
          {isLoading ? (
            <Spinner className="mr-2 h-5 w-5 text-white" />
          ) : null}
          {children}
        </span>
      </button>
    );
  }
);

ActionGlowButton.displayName = 'ActionGlowButton';

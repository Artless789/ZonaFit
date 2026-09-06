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
          "group relative inline-flex items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-[#B91C1C] bg-gradient-to-b from-[#EF4444] to-[#DC2626] px-5 py-2.5 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-2px_4px_rgba(185,28,28,0.4),0_4px_12px_-4px_rgba(220,38,38,0.3)] transition-all duration-300 ease-out hover:brightness-110 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(185,28,28,0.4),0_6px_16px_-4px_rgba(220,38,38,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 active:scale-[0.98] active:brightness-95 active:shadow-[inset_0_2px_8px_rgba(153,27,27,0.5)] disabled:pointer-events-none disabled:opacity-50",
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

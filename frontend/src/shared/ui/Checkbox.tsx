import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@shared/utils/cn';

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, error, label, id, ...props }, ref) => {
    const checkboxId = id || (label ? `checkbox-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

    return (
      <div className="flex items-center gap-2">
        <div className="relative flex items-center">
          <input
            type="checkbox"
            id={checkboxId}
            ref={ref}
            className={cn(
              "peer h-4 w-4 shrink-0 appearance-none rounded-sm border border-border-medium bg-bg-surface/60 backdrop-blur-sm shadow-xs hover:border-border-strong hover:bg-bg-surface-hover/80 transition-all duration-200",
              "checked:bg-brand-primary checked:border-brand-primary checked:shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]",
              "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-primary/15 focus-visible:border-brand-primary",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-danger",
              className
            )}
            {...props}
          />
          {/* Custom checkmark icon that appears when checked */}
          <svg
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none opacity-0 peer-checked:opacity-100 text-text-white transition-opacity"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        {label && (
          <label
            htmlFor={checkboxId}
            className={cn(
              "text-sm font-medium leading-none cursor-pointer text-text-secondary select-none",
              props.disabled && "cursor-not-allowed opacity-50"
            )}
          >
            {label}
          </label>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

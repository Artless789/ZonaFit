import { InputHTMLAttributes, forwardRef, ReactNode, useId } from 'react';
import { cn } from '@shared/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean | string;
  label?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, helperText, leftIcon, rightIcon, id, required, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const helperId = `${inputId}-helper`;
    const hasError = Boolean(error);

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label 
            htmlFor={inputId} 
            className="text-sm font-medium text-text-primary"
          >
            {label}
            {required && <span className="text-danger ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        
        <div className="relative flex w-full items-center">
          {leftIcon && (
            <div className="pointer-events-none absolute left-3.5 flex items-center justify-center text-text-muted select-none z-10">
              {leftIcon}
            </div>
          )}
          
          <input
            id={inputId}
            ref={ref}
            required={required}
            aria-invalid={hasError ? "true" : "false"}
            aria-describedby={helperText ? helperId : undefined}
            className={cn(
              "flex h-10 w-full rounded-[var(--radius-sm)] border border-border-medium bg-surface-base text-sm text-text-primary shadow-xs transition-all duration-150",
              "file:border-0 file:bg-transparent file:text-sm file:font-medium",
              "placeholder:text-text-muted",
              "hover:border-border-strong hover:bg-surface-panel",
              "focus-visible:outline-none focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/25",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-base",
              leftIcon ? "pl-10" : "pl-3.5",
              rightIcon ? "pr-10" : "pr-3.5",
              hasError && "border-danger bg-danger/5 hover:border-danger hover:bg-danger/5 focus-visible:border-danger focus-visible:ring-danger/20",
              className
            )}
            {...props}
          />
          
          {rightIcon && (
            <div className="absolute right-3.5 flex items-center justify-center text-text-muted z-10">
              {rightIcon}
            </div>
          )}
        </div>
        
        {helperText && (
          <span 
            id={helperId}
            className={cn(
              "text-xs mt-0.5 font-medium", 
              hasError ? "text-danger" : "text-text-muted"
            )}
          >
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

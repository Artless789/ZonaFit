import React, { SelectHTMLAttributes, forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  error?: boolean;
  label?: string;
  helperText?: string;
  options?: SelectOption[];
  onValueChange?: (value: string) => void;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children?: React.ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, label, helperText, options, id, children, onValueChange, onChange, ...props }, ref) => {
    const selectId = id || (label ? `select-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (onChange) onChange(e);
      if (onValueChange) onValueChange(e.target.value);
    };

    return (
      <div className={cn("flex w-full flex-col gap-1 relative", className)}>
        {label && (
          <label 
            htmlFor={selectId} 
            className="text-sm font-medium text-text-muted mb-1"
          >
            {label}
          </label>
        )}
        <div className="relative w-full">
          <select
            id={selectId}
            ref={ref}
            onChange={handleChange}
            className={cn(
              "flex h-10 w-full rounded-xl border border-border-medium bg-bg-surface/60 px-4 py-2 pr-10 text-sm text-text-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 focus-visible:border-brand-primary",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-bg-page",
              "transition-all duration-200 appearance-none cursor-pointer shadow-sm hover:bg-bg-surface backdrop-blur-md",
              error && "border-danger focus-visible:ring-danger/50 focus-visible:border-danger",
            )}
            {...props}
          >
            {/* If neither options nor children provided, add a default placeholder to avoid breaking */}
            {(!options && !children) && (
              <option value="" disabled hidden>Selecciona una opción</option>
            )}
            
            {options && options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
            
            {children}
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted opacity-70">
             <ChevronDown size={16} />
          </div>
        </div>
        {helperText && (
          <span className={cn("text-xs", error ? "text-danger" : "text-text-muted")}>
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export const SelectItem = ({ value, children, ...props }: React.OptionHTMLAttributes<HTMLOptionElement>) => {
  return (
    <option value={value} {...props}>
      {children}
    </option>
  );
};

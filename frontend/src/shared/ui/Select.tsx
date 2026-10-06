import React, { SelectHTMLAttributes, forwardRef, useState, useRef, useCallback, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@shared/utils/cn';

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
  ({ className, error, label, helperText, options, id, children, onValueChange, onChange, value, defaultValue, ...props }, ref) => {
    const selectId = id || (label ? `select-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
    const [isOpen, setIsOpen] = useState(false);
    
    // Support uncontrolled vs controlled
    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = useState<string | number>(
      isControlled ? (value as string | number) : (defaultValue as string | number) || ''
    );
    
    useEffect(() => {
      if (isControlled) setInternalValue(value as string | number);
    }, [value, isControlled]);

    const nativeSelectRef = useRef<HTMLSelectElement | null>(null);

    const setRefs = useCallback(
      (node: HTMLSelectElement) => {
        nativeSelectRef.current = node;
        
        // Forward ref to parent
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          (ref as any).current = node;
        }
        
        // Hijack the value setter to sync internal state when react-hook-form calls reset()
        if (node && typeof window !== 'undefined') {
          const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
          const valueGetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.get;
          
          if (valueSetter && valueGetter && !node.dataset.hijacked) {
            Object.defineProperty(node, 'value', {
              set(v) {
                valueSetter.call(node, v);
                setInternalValue(v);
              },
              get() {
                return valueGetter.call(node);
              },
              configurable: true
            });
            node.dataset.hijacked = "true";
          }
          
          // Set initial value to match our state if empty
          if (!node.value && internalValue) {
             node.value = String(internalValue);
          }
        }
      },
      [ref, internalValue]
    );

    // Extract options from children if provided
    let extractedOptions: SelectOption[] = [];
    if (options) {
      extractedOptions = options;
    } else if (children) {
      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child)) {
          const element = child as React.ReactElement<any>;
          if (element.props.value !== undefined) {
            extractedOptions.push({
              value: element.props.value,
              label: element.props.children || element.props.label || String(element.props.value),
            });
          }
        }
      });
    }

    const currentOption = extractedOptions.find((opt) => String(opt.value) === String(internalValue));
    
    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      const handleClickOutside = (e: PointerEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('pointerdown', handleClickOutside);
      return () => document.removeEventListener('pointerdown', handleClickOutside);
    }, []);

    const handleSelect = (val: string | number) => {
      if (!isControlled) {
        setInternalValue(val);
      }
      
      if (onValueChange) {
        onValueChange(String(val));
      }
      
      if (onChange) {
         // Create a synthetic event lookalike for react-hook-form
         onChange({
           target: { name: props.name, value: String(val) },
           currentTarget: { name: props.name, value: String(val) },
           preventDefault: () => {},
           stopPropagation: () => {},
           type: 'change'
         } as any);
      }
      
      setIsOpen(false);
    };

    return (
      <div className={cn("flex w-full flex-col gap-1 relative", className)} ref={containerRef}>
        {label && (
          <label 
            htmlFor={selectId} 
            className="text-sm font-medium text-text-muted mb-1"
          >
            {label}
          </label>
        )}
        <div className="relative w-full">
          {/* Custom Trigger Liquid Glass */}
          <div
            onClick={() => !props.disabled && setIsOpen(!isOpen)}
            className={cn(
              "flex min-h-[44px] h-11 w-full items-center justify-between rounded-[var(--radius-md)] border border-border-medium bg-bg-surface px-4 py-2 text-sm text-text-primary touch-manipulation",
              "transition-all duration-200 cursor-pointer shadow-xs hover:border-border-strong hover:bg-bg-surface-hover",
              isOpen && "ring-2 ring-brand-primary/20 border-brand-primary bg-bg-surface",
              props.disabled && "cursor-not-allowed opacity-50 bg-bg-page hover:shadow-none hover:bg-bg-page hover:border-border-medium",
              error && "border-danger bg-danger/5 hover:border-danger hover:bg-danger/5 ring-2 ring-danger/20",
            )}
          >
            <span 
              className={cn("truncate pr-2", !currentOption && "text-text-muted")}
              title={currentOption ? currentOption.label : undefined}
            >
              {currentOption ? currentOption.label : "Selecciona una opción"}
            </span>
            <ChevronDown 
              size={16} 
              className={cn("text-text-muted shrink-0 transition-transform duration-300", isOpen && "transform rotate-180 text-brand-primary")} 
            />
          </div>

          {/* Hidden Native Select for Forms (e.g., react-hook-form) */}
          <select
            id={selectId}
            ref={setRefs}
            value={internalValue}
            onChange={(e) => {
              if (onChange) onChange(e);
              if (onValueChange) onValueChange(e.target.value);
            }}
            className="absolute inset-0 w-full h-full opacity-0 z-[-1] pointer-events-none"
            {...props}
          >
            <option value="" disabled hidden>Selecciona una opción</option>
            {extractedOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Liquid Glass Dropdown Menu */}
          <AnimatePresence>
            {isOpen && !props.disabled && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 4, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="absolute z-[var(--z-dropdown)] w-full rounded-[var(--radius-md)] material-elevated overflow-hidden"
                style={{ top: '100%' }}
              >
                <div className="max-h-60 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-border-medium scrollbar-track-transparent">
                  {extractedOptions.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-text-muted text-center">
                      No hay opciones
                    </div>
                  ) : (
                    extractedOptions.map((opt) => {
                      const isSelected = String(opt.value) === String(internalValue);
                      return (
                        <div
                          key={opt.value}
                          onClick={() => handleSelect(opt.value)}
                          title={opt.label}
                          className={cn(
                            "flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer transition-colors duration-200",
                            isSelected 
                              ? "bg-brand-primary/10 text-brand-primary font-medium" 
                              : "text-text-secondary hover:bg-surface-light hover:text-text-primary"
                          )}
                        >
                          <span className="truncate pr-2">{opt.label}</span>
                          {isSelected && <Check size={16} className="text-brand-primary shrink-0 ml-2" />}
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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

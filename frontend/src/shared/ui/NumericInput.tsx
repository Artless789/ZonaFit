import React, { forwardRef, useState, useEffect, useRef, useImperativeHandle } from 'react';
import { Input, InputProps } from './Input';
import { formatNumber, parseNumericString } from '@shared/utils/formatters';

export const NumericInput = forwardRef<HTMLInputElement, InputProps>(
  ({ onChange, onBlur, name, value, defaultValue, ...props }, ref) => {
    // Hidden input to maintain the raw numeric string for React Hook Form (RHF)
    const hiddenRef = useRef<HTMLInputElement>(null);
    // Visible input ref for focus/blur delegation
    const visibleRef = useRef<HTMLInputElement>(null);
    
    // Initialize display value formatted
    const initial = value !== undefined ? value : defaultValue;
    const [displayValue, setDisplayValue] = useState(() => {
      if (initial !== undefined && initial !== null && initial !== '') {
        const num = Number(initial);
        return !isNaN(num) ? formatNumber(initial as string | number) : '';
      }
      return '';
    });

    // Intercept programmatic value assignments (such as RHF reset) on the ref
    useImperativeHandle(ref, () => {
      if (!hiddenRef.current) return {} as HTMLInputElement;
      return new Proxy(hiddenRef.current, {
        set(target, prop, val) {
          if (prop === 'value') {
            if (val !== null && val !== undefined && val !== '') {
              const num = Number(val);
              setDisplayValue(!isNaN(num) ? formatNumber(val) : '');
            } else {
              setDisplayValue('');
            }
          }
          (target as any)[prop] = val;
          return true;
        },
        get(target, prop) {
          if (prop === 'focus') {
            return () => visibleRef.current?.focus();
          }
          if (prop === 'blur') {
            return () => visibleRef.current?.blur();
          }
          const val = (target as any)[prop];
          if (typeof val === 'function') {
            return val.bind(target);
          }
          return val;
        }
      });
    }, []);

    // Keep display synced if controlled value changes externally
    useEffect(() => {
      if (value !== undefined) {
        if (value !== null && value !== '') {
          const num = Number(value);
          setDisplayValue(!isNaN(num) ? formatNumber(value as string | number) : '');
        } else {
          setDisplayValue('');
        }
        if (hiddenRef.current) {
          hiddenRef.current.value = value !== null && value !== undefined ? String(value) : '';
        }
      }
    }, [value]);

    const handleDisplayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = parseNumericString(e.target.value);
      
      if (raw === '-') {
        setDisplayValue('-');
      } else if (raw !== '') {
        setDisplayValue(formatNumber(raw));
      } else {
        setDisplayValue('');
      }
      
      // Update the hidden input that RHF will read on submit
      if (hiddenRef.current) {
        hiddenRef.current.value = raw;
      }

      // Propagate the onChange event with the raw value
      if (onChange) {
        const mockEvent = {
          ...e,
          target: {
            ...e.target,
            value: raw,
            name: name
          }
        };
        onChange(mockEvent as React.ChangeEvent<HTMLInputElement>);
      }
    };

    return (
      <>
        {/* Hidden input holds the raw number string for RHF */}
        <input 
          type="hidden" 
          ref={hiddenRef} 
          name={name}
          defaultValue={defaultValue} 
        />
        {/* Visible input for user interaction */}
        <Input
          ref={visibleRef}
          {...props}
          type="text"
          value={displayValue}
          onChange={handleDisplayChange}
          onBlur={onBlur}
        />
      </>
    );
  }
);

NumericInput.displayName = 'NumericInput';

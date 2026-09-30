import { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@shared/utils/cn';

export interface MetricDeltaProps {
  /** Delta numeric value or pre-formatted string (e.g. 14.5 or "-3.2%") */
  value: number | string;
  /** Force specific direction arrow, or 'auto' to derive from sign */
  direction?: 'up' | 'down' | 'neutral' | 'auto';
  /**
   * Polarity: If true (default), positive is good (green), negative is bad (red).
   * If false (e.g. churn or expenses), positive is bad (red), negative is good (green).
   */
  isPositiveGood?: boolean;
  /** Suffix to append to numeric values (default: '%') */
  suffix?: string;
  /** Contextual hint text, e.g. "vs. mes ant." */
  hint?: ReactNode;
  /** Text size tier (default: 'xs') */
  size?: '2xs' | 'xs' | 'sm';
  className?: string;
}

export function MetricDelta({
  value,
  direction = 'auto',
  isPositiveGood = true,
  suffix = '%',
  hint,
  size = 'xs',
  className,
}: MetricDeltaProps) {
  const numericValue = typeof value === 'number' ? value : parseFloat(value);
  const isNumeric = !Number.isNaN(numericValue);

  // Compute direction
  const computedDirection =
    direction !== 'auto'
      ? direction
      : isNumeric
        ? numericValue > 0
          ? 'up'
          : numericValue < 0
            ? 'down'
            : 'neutral'
        : 'neutral';

  const isPositive = computedDirection === 'up';
  const isNeutral = computedDirection === 'neutral';

  // Format display text
  const formattedValue =
    typeof value === 'number'
      ? `${Math.abs(value).toFixed(1)}${suffix}`
      : value;

  // Semantic color based on polarity
  const isFavorable = isPositive ? isPositiveGood : !isPositiveGood;

  const colorClass = isNeutral
    ? 'text-text-muted'
    : isFavorable
      ? 'text-emerald-400'
      : 'text-brand-primary';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-mono select-none',
        size === '2xs' && 'text-[10px]',
        size === 'xs' && 'text-[11px]',
        size === 'sm' && 'text-xs',
        className
      )}
      aria-label={`Variación: ${computedDirection} ${formattedValue}${hint ? `, ${hint}` : ''}`}
    >
      <span className={cn('inline-flex items-center gap-0.5 font-medium', colorClass)}>
        {computedDirection === 'up' && (
          <ArrowUpRight
            className={cn(
              size === '2xs' && 'size-2.5',
              size === 'xs' && 'size-3',
              size === 'sm' && 'size-3.5'
            )}
            aria-hidden="true"
          />
        )}
        {computedDirection === 'down' && (
          <ArrowDownRight
            className={cn(
              size === '2xs' && 'size-2.5',
              size === 'xs' && 'size-3',
              size === 'sm' && 'size-3.5'
            )}
            aria-hidden="true"
          />
        )}
        {computedDirection === 'neutral' && (
          <Minus
            className={cn(
              size === '2xs' && 'size-2.5',
              size === 'xs' && 'size-3',
              size === 'sm' && 'size-3.5'
            )}
            aria-hidden="true"
          />
        )}
        <span>{formattedValue}</span>
      </span>

      {hint && (
        <span className="text-text-muted font-normal truncate">
          {hint}
        </span>
      )}
    </span>
  );
}

MetricDelta.displayName = 'MetricDelta';

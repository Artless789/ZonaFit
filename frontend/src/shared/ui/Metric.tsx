import { ReactNode } from 'react';
import { cn } from '@shared/utils/cn';
import { MetricDelta } from './MetricDelta';
import { DataLabel } from './DataLabel';

export interface MetricProps {
  /** Metric title or label */
  label: ReactNode;
  /** Primary numeric value (string or number, formatted as tabular figures) */
  value: ReactNode;
  /** Optional editorial index (e.g. "01" or 1) */
  index?: string | number;
  /** Optional percentage or value delta (e.g. 12.4 or -3.1) */
  delta?: number | string;
  /** Contextual hint for the delta (e.g. "vs. mes ant.") */
  deltaHint?: ReactNode;
  /** Polarity: true if positive is favorable, false if negative is favorable */
  isPositiveGood?: boolean;
  /** Optional trend series data to render a minimal sparkline */
  sparklineData?: number[];
  /** Secondary informational text below the value */
  secondaryText?: ReactNode;
  /** Optional action or badge in the top right */
  action?: ReactNode;
  /** Visual presentation variant */
  variant?: 'default' | 'panel' | 'glass' | 'subtle';
  /** Value size scale */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Pure SVG polyline sparkline: zero external dependencies, crisp vector rendering.
 */
function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${26 - ((v - min) / range) * 22}`)
    .join(' ');

  return (
    <svg
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      className={cn(
        'h-6 w-full select-none',
        positive ? 'text-white/35' : 'text-brand-primary/65'
      )}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function Metric({
  label,
  value,
  index,
  delta,
  deltaHint,
  isPositiveGood = true,
  sparklineData,
  secondaryText,
  action,
  variant = 'default',
  size = 'md',
  className,
}: MetricProps) {
  const isPositive =
    delta !== undefined
      ? typeof delta === 'number'
        ? delta >= 0
        : !String(delta).startsWith('-')
      : true;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 transition-colors',
        variant === 'panel' && 'p-5 md:p-6 rounded-[var(--radius-xl)] bg-surface-panel border border-border-light shadow-subtle',
        variant === 'glass' && 'p-5 md:p-6 rounded-[var(--radius-xl)] liquid-glass-soft',
        variant === 'subtle' && 'p-4 rounded-[var(--radius-lg)] bg-surface-base/60 border border-border-subtle',
        className
      )}
    >
      {/* Header: Label + optional action */}
      <div className="flex items-center justify-between gap-3">
        <DataLabel index={index} size="xs">
          {label}
        </DataLabel>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {/* Main value */}
      <div className="flex flex-col gap-2">
        <span
          className={cn(
            'font-light tabular-nums tracking-[-0.03em] text-text-primary text-balance',
            size === 'sm' && 'text-2xl md:text-3xl leading-none',
            size === 'md' && 'text-3xl md:text-4xl lg:text-[42px] leading-none',
            size === 'lg' && 'text-4xl md:text-5xl lg:text-6xl leading-none'
          )}
        >
          {value}
        </span>

        {/* Optional sparkline */}
        {sparklineData && sparklineData.length > 1 && (
          <div className="pt-1">
            <Sparkline data={sparklineData} positive={isPositive} />
          </div>
        )}

        {/* Delta trend or secondary text */}
        {(delta !== undefined || secondaryText) && (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {delta !== undefined && (
              <MetricDelta
                value={delta}
                hint={deltaHint}
                isPositiveGood={isPositiveGood}
                size="xs"
              />
            )}
            {secondaryText && (
              <span className="font-mono text-[11px] text-text-muted truncate">
                {secondaryText}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

Metric.displayName = 'Metric';

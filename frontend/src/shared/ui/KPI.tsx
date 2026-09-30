import { ReactNode } from 'react';
import { cn } from '@shared/utils/cn';
import { Metric, MetricProps } from './Metric';

export interface KPIProps extends MetricProps {
  /** Optional icon displayed next to the label */
  icon?: ReactNode;
  /** Whether this KPI is displayed within a border-divided grid (adjusts dividers) */
  inGrid?: boolean;
}

export interface KPIGridProps {
  children: ReactNode;
  /** Number of columns on desktop (default: 4) */
  columns?: 2 | 3 | 4;
  className?: string;
}

/**
 * Composite KPI component that standardizes metric display across panels and dashboards.
 */
export function KPI({
  icon,
  className,
  ...props
}: KPIProps) {
  return (
    <Metric
      {...props}
      action={
        props.action || (icon ? <div className="text-text-muted">{icon}</div> : undefined)
      }
      className={className}
    />
  );
}

KPI.displayName = 'KPI';

/**
 * Editorial KPI Grid container with fine hairline dividers (border-white/10) matching the Dark Cinematic visual language.
 */
export function KPIGrid({
  children,
  columns = 4,
  className,
}: KPIGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border-light border-y border-border-light py-2',
        columns === 3 && 'lg:grid-cols-3',
        columns === 4 && 'lg:grid-cols-4',
        className
      )}
    >
      {children}
    </div>
  );
}

KPIGrid.displayName = 'KPIGrid';

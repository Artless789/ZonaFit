import { ReactNode } from 'react';
import { cn } from '@shared/utils/cn';

export interface DataLabelProps {
  children: ReactNode;
  /** Optional index or prefix, e.g. "01" */
  index?: string | number;
  /** Optional glowing status dot */
  dotColor?: 'emerald' | 'brand' | 'amber' | 'neutral' | 'blue';
  /** Text size tier (default: 'xs') */
  size?: '2xs' | 'xs' | 'sm';
  /** Whether the text should use muted tone (default: true) */
  muted?: boolean;
  className?: string;
}

export function DataLabel({
  children,
  index,
  dotColor,
  size = 'xs',
  muted = true,
  className,
}: DataLabelProps) {
  const formattedIndex =
    index !== undefined && index !== null
      ? typeof index === 'number'
        ? String(index).padStart(2, '0')
        : index
      : null;

  return (
    <span
      className={cn(
        'font-mono uppercase tracking-[0.14em] inline-flex items-center gap-1.5 select-none',
        size === '2xs' && 'text-[10px] leading-tight',
        size === 'xs' && 'text-[11px] leading-tight',
        size === 'sm' && 'text-xs leading-normal',
        muted ? 'text-text-muted' : 'text-text-secondary',
        className
      )}
    >
      {dotColor && (
        <span
          aria-hidden="true"
          className={cn(
            'size-1.5 rounded-full shrink-0',
            dotColor === 'emerald' && 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]',
            dotColor === 'brand' && 'bg-brand-primary shadow-[0_0_8px_rgba(220,38,38,0.6)]',
            dotColor === 'amber' && 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]',
            dotColor === 'neutral' && 'bg-text-muted',
            dotColor === 'blue' && 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]'
          )}
        />
      )}
      {formattedIndex && (
        <span className="text-text-secondary">{formattedIndex} —</span>
      )}
      <span>{children}</span>
    </span>
  );
}

DataLabel.displayName = 'DataLabel';

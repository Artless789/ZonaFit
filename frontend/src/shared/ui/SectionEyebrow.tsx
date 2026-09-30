import { ReactNode } from 'react';
import { cn } from '@shared/utils/cn';

export interface SectionEyebrowProps {
  /** Optional numerical index (e.g. "01" or 1) */
  index?: string | number;
  /** Eyebrow label, e.g. "FLUJO DE INGRESOS" */
  label: ReactNode;
  /** Optional section heading title */
  title?: ReactNode;
  /** ID for accessibility (aria-labelledby) */
  titleId?: string;
  /** HTML tag for the title heading (default: 'h2') */
  titleLevel?: 'h1' | 'h2' | 'h3' | 'h4' | 'span';
  /** Optional secondary explanatory text */
  description?: ReactNode;
  /** Action slot on the right (button, link, badge, filter) */
  action?: ReactNode;
  /** Visual variant: default (red index accent), subtle (muted index), neutral */
  variant?: 'default' | 'subtle' | 'neutral';
  /** Whether to render a horizontal divider below the entire header block */
  hasDivider?: boolean;
  className?: string;
}

export function SectionEyebrow({
  index,
  label,
  title,
  titleId,
  titleLevel = 'h2',
  description,
  action,
  variant = 'default',
  hasDivider = false,
  className,
}: SectionEyebrowProps) {
  const formattedIndex =
    index !== undefined && index !== null
      ? typeof index === 'number'
        ? String(index).padStart(2, '0')
        : index
      : null;

  const TitleTag = titleLevel;

  return (
    <header
      className={cn(
        'flex flex-col gap-2',
        hasDivider && 'border-b border-border-light pb-4 md:pb-5',
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          {/* Eyebrow strip: 01 — LABEL */}
          <p className="eyebrow flex items-center gap-2">
            {formattedIndex && (
              <>
                <span
                  className={cn(
                    'font-mono font-medium',
                    variant === 'default' && 'text-brand-primary',
                    variant === 'subtle' && 'text-text-muted',
                    variant === 'neutral' && 'text-text-secondary'
                  )}
                >
                  {formattedIndex}
                </span>
                <span
                  aria-hidden="true"
                  className="h-px w-5 bg-white/20"
                />
              </>
            )}
            <span className="truncate">{label}</span>
          </p>

          {/* Heading title (Reference 1:1) */}
          {title && (
            <TitleTag
              id={titleId}
              className="text-xl font-medium tracking-tight text-balance text-text-primary"
            >
              {title}
            </TitleTag>
          )}

          {/* Description */}
          {description && (
            <p className="text-xs md:text-sm text-text-secondary max-w-2xl leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* Action slot */}
        {action && (
          <div className="shrink-0 flex items-center gap-2">
            {action}
          </div>
        )}
      </div>
    </header>
  );
}

SectionEyebrow.displayName = 'SectionEyebrow';

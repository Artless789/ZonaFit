import { ReactNode, HTMLAttributes } from 'react';
import { cn } from '@shared/utils/cn';
import { SectionEyebrow } from './SectionEyebrow';

export interface GlassPanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Optional element ID for accessibility linking */
  id?: string;
  /** Section number index (e.g. "01" or 1) */
  index?: string | number;
  /** Eyebrow label, e.g. "FLUJO DE INGRESOS" */
  eyebrow?: ReactNode;
  /** Section main title */
  title?: ReactNode;
  /** Optional secondary explanatory text */
  description?: ReactNode;
  /** Action slot (top right) */
  action?: ReactNode;
  /** Glass intensity variant (default: 'default') */
  variant?: 'default' | 'subtle' | 'elevated';
  /** Padding scale */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Border radius */
  rounded?: 'lg' | 'xl' | '2xl' | '3xl';
  className?: string;
  children: ReactNode;
}

export function GlassPanel({
  id,
  index,
  eyebrow,
  title,
  description,
  action,
  variant = 'default',
  padding = 'md',
  rounded = '2xl',
  className,
  children,
  ...rest
}: GlassPanelProps) {
  const headingId = id ? `${id}-heading` : undefined;
  const hasHeader = eyebrow || title || action || description;

  return (
    <section
      id={id}
      aria-labelledby={title && headingId ? headingId : undefined}
      className={cn(
        'flex flex-col gap-6 overflow-hidden transition-all duration-200',
        // Glass variants
        variant === 'default' && 'liquid-glass',
        variant === 'subtle' && 'liquid-glass-soft',
        variant === 'elevated' && 'liquid-glass-elevated',
        // Radius
        rounded === 'lg' && 'rounded-[var(--radius-lg)]',
        rounded === 'xl' && 'rounded-[var(--radius-xl)]',
        rounded === '2xl' && 'rounded-[24px] md:rounded-[28px]',
        rounded === '3xl' && 'rounded-[32px]',
        // Padding
        padding === 'none' && 'p-0',
        padding === 'sm' && 'p-4 md:p-5',
        padding === 'md' && 'p-5 md:p-7',
        padding === 'lg' && 'p-7 md:p-9',
        className
      )}
      {...rest}
    >
      {hasHeader && (
        <SectionEyebrow
          index={index}
          label={eyebrow}
          title={title}
          titleId={headingId}
          description={description}
          action={action}
        />
      )}
      {children}
    </section>
  );
}

GlassPanel.displayName = 'GlassPanel';

import { ReactNode } from 'react';
import { cn } from '@shared/utils/cn';

export interface CinematicLayerProps {
  /** Optional ambient colored glows (Merwil brand red & neutral graphite depth) */
  ambientGlow?: boolean;
  /** Whether to render subtle geometric 96px grid overlay */
  grid?: boolean;
  /** Whether to render subtle fractal noise film grain overlay */
  grain?: boolean;
  /** Optional background image path (preserves existing assets) */
  imageSrc?: string;
  /** Image alt text (default empty string as decorative backdrop) */
  imageAlt?: string;
  /** Gradient scrim contrast tier over background images */
  contrast?: 'subtle' | 'medium' | 'deep';
  /** Optional backdrop blur for image */
  blur?: 'none' | 'sm' | 'md';
  /**
   * Layout position mode:
   * 'fixed': fills entire viewport in the background (ideal for page / app shell)
   * 'absolute': fills relative parent container (ideal for hero sections / cards)
   */
  mode?: 'fixed' | 'absolute';
  /** Custom image class name */
  imageClassName?: string;
  className?: string;
  children?: ReactNode;
}

/**
 * Pure presentation component establishing the Dark Cinematic depth foundation.
 * Non-invasive: pointer-events-none, aria-hidden, lightweight CSS gradients & SVG masks.
 */
export function CinematicLayer({
  ambientGlow = true,
  grid = true,
  grain = true,
  imageSrc,
  imageAlt = '',
  contrast = 'medium',
  blur = 'none',
  mode = 'fixed',
  imageClassName,
  className,
  children,
}: CinematicLayerProps) {
  const isFixed = mode === 'fixed';

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none z-0 overflow-hidden select-none',
        isFixed ? 'fixed inset-0' : 'absolute inset-0',
        className
      )}
    >
      {/* 1. Optional background photo asset */}
      {imageSrc && (
        <div className="absolute inset-0 z-0">
          <img
            src={imageSrc}
            alt={imageAlt}
            loading="lazy"
            decoding="async"
            className={cn(
              'h-full w-full object-cover object-right opacity-85 transition-opacity',
              blur === 'sm' && 'blur-xs',
              blur === 'md' && 'blur-sm',
              imageClassName
            )}
          />

          {/* Cinematic Scrims (Multi-directional gradient shielding for high legibility) */}
          <div
            className={cn(
              'absolute inset-0',
              contrast === 'subtle' &&
                'bg-gradient-to-r from-surface-base via-surface-base/80 to-surface-base/30',
              contrast === 'medium' &&
                'bg-gradient-to-r from-surface-base via-surface-base/90 to-surface-base/40',
              contrast === 'deep' &&
                'bg-gradient-to-r from-surface-base via-surface-base/95 to-surface-base/70'
            )}
          />
          <div
            className={cn(
              'absolute inset-0',
              contrast === 'subtle' &&
                'bg-gradient-to-t from-surface-base via-surface-base/40 to-transparent',
              contrast === 'medium' &&
                'bg-gradient-to-t from-surface-base via-surface-base/60 to-transparent',
              contrast === 'deep' &&
                'bg-gradient-to-t from-surface-base via-surface-base/80 to-surface-base/20'
            )}
          />
        </div>
      )}

      {/* 2. Ambient Colored Glows (Drifting or static brand depth) */}
      {ambientGlow && (
        <>
          <div
            className="absolute -top-[15%] left-[5%] size-[600px] rounded-full opacity-40 blur-[130px]"
            style={{
              background:
                'radial-gradient(circle, var(--color-ambient-brand, rgba(220, 38, 38, 0.08)) 0%, transparent 70%)',
            }}
          />
          <div
            className="absolute -bottom-[20%] right-[5%] size-[700px] rounded-full opacity-35 blur-[150px]"
            style={{
              background:
                'radial-gradient(circle, var(--color-ambient-neutral, rgba(255, 255, 255, 0.035)) 0%, transparent 65%)',
            }}
          />
        </>
      )}

      {/* 3. Subtle Geometric Grid Mask */}
      {grid && <div className="cinematic-grid absolute inset-0 opacity-80" />}

      {/* 4. Film Grain Overlay */}
      {grain && <div className="cinematic-grain absolute inset-0" />}

      {/* 5. Custom children or overlay slots */}
      {children}
    </div>
  );
}

CinematicLayer.displayName = 'CinematicLayer';

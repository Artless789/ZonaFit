import { forwardRef } from 'react';
import { Card, CardProps } from './Card';
import { cn } from '../../utils/cn';

export interface GlassCardProps extends Omit<CardProps, 'variant'> {
  /** Activa un reflejo interactivo sutil al pasar el cursor y al presionar (ideal para tarjetas clicables) */
  interactive?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, children, hover, interactive = false, ...props }, ref) => {
    const isInteractive = hover || interactive;
    
    return (
      <Card 
        ref={ref} 
        variant="glass" 
        hover={false} /* Desactivamos el hover default de Card para controlarlo aquí a medida */
        className={cn(
          "group relative transition-all duration-300 ease-out",
          isInteractive && "hover:-translate-y-[1px] active:translate-y-[0px] active:scale-[0.99] cursor-pointer hover:shadow-glass-large",
          className
        )} 
        {...props}
      >
        {isInteractive && (
          <>
            {/* Reflejo diagonal suave (Sheen) en hover */}
            <div 
              className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] opacity-0 transition-all duration-500 ease-out bg-gradient-to-tr from-transparent via-white/[0.04] to-transparent translate-x-[-100%] group-hover:translate-x-[100%] group-hover:opacity-100"
              aria-hidden="true" 
            />
            
            {/* Aumento sutil del highlight, borde luminoso y sombra profunda en hover */}
            <div 
              className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_0_20px_rgba(220,38,38,0.03),0_15px_45px_-10px_rgba(0,0,0,0.5)]"
              aria-hidden="true" 
            />

            {/* Intensificación focalizada en el estado active (presión física) */}
            <div 
              className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] opacity-0 transition-opacity duration-150 ease-out group-active:opacity-100 shadow-[inset_0_2px_4px_rgba(255,255,255,0.08)]"
              aria-hidden="true" 
            />
          </>
        )}
        
        {/* Contenido principal (mantiene el flujo natural del DOM) */}
        {children}
      </Card>
    );
  }
);

GlassCard.displayName = 'GlassCard';

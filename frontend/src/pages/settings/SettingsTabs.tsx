/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { 
  Building2, 
  Receipt, 
  MessageCircle, 
  Palette, 
  UserCog, 
  CreditCard 
} from 'lucide-react';
import { cn } from '@shared/utils/cn';

export type SettingsTabId = 
  | 'identity' 
  | 'billing' 
  | 'communications' 
  | 'appearance' 
  | 'profile' 
  | 'subscription';

export interface TabConfig {
  id: SettingsTabId;
  index: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  description: string;
  badge?: string;
}

export const SETTINGS_TABS: TabConfig[] = [
  {
    id: 'identity',
    index: '01',
    label: 'Identidad Comercial',
    shortLabel: 'Identidad',
    icon: Building2,
    description: 'Razón social, NIT, teléfono, ubicación y datos fiscales',
  },
  {
    id: 'billing',
    index: '02',
    label: 'Facturación & Fiscal',
    shortLabel: 'Fiscal',
    icon: Receipt,
    description: 'Moneda, impuestos predeterminados y notas de recibo',
  },
  {
    id: 'communications',
    index: '03',
    label: 'WhatsApp & Canales',
    shortLabel: 'WhatsApp',
    icon: MessageCircle,
    description: 'WhatsApp Web Directo, notificaciones y plantillas',
    badge: 'Directo',
  },
  {
    id: 'appearance',
    index: '04',
    label: 'Apariencia & Visual',
    shortLabel: 'Apariencia',
    icon: Palette,
    description: 'Tema Dark Cinematic Editorial y contrastes',
  },
  {
    id: 'profile',
    index: '05',
    label: 'Mi Cuenta & Seguridad',
    shortLabel: 'Mi Cuenta',
    icon: UserCog,
    description: 'Datos del operador activo y restablecimiento de clave',
  },
  {
    id: 'subscription',
    index: '06',
    label: 'Licencia & Suscripción',
    shortLabel: 'Licencia',
    icon: CreditCard,
    description: 'Estado del plan de servicio Merwil ZonaFit SaaS',
  },
];

interface SettingsTabsProps {
  activeTab: SettingsTabId;
  onSelectTab: (tabId: SettingsTabId) => void;
  isGymDirty?: boolean;
}

export function SettingsTabs({
  activeTab,
  onSelectTab,
  isGymDirty = false,
}: SettingsTabsProps) {
  return (
    <nav 
      aria-label="Secciones de configuración"
      className="flex items-center gap-1.5 p-1.5 rounded-2xl border border-border-light bg-surface-base/50 backdrop-blur-md overflow-x-auto no-scrollbar scroll-smooth"
    >
      {SETTINGS_TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        const hasDirtyIndicator = isGymDirty && (tab.id === 'identity' || tab.id === 'billing');

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`settings-tabpanel-${tab.id}`}
            id={`settings-tab-${tab.id}`}
            onClick={() => onSelectTab(tab.id)}
            className={cn(
              'group relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl font-mono text-xs uppercase tracking-wider transition-all duration-200 shrink-0 select-none cursor-pointer',
              isActive
                ? 'bg-surface-raised text-text-primary border border-border-medium/80 shadow-subtle font-semibold'
                : 'text-text-muted hover:text-text-primary hover:bg-white/[0.03] border border-transparent'
            )}
          >
            {/* Index indicator */}
            <span
              className={cn(
                'text-[10px] transition-colors',
                isActive ? 'text-brand-primary font-bold' : 'text-text-muted/60 group-hover:text-text-muted'
              )}
            >
              {tab.index}
            </span>

            {/* Icon */}
            <Icon
              size={15}
              className={cn(
                'transition-transform duration-200 group-hover:scale-110',
                isActive ? 'text-brand-primary' : 'text-text-muted group-hover:text-text-secondary'
              )}
            />

            {/* Label */}
            <span className="hidden sm:inline whitespace-nowrap">{tab.label}</span>
            <span className="sm:hidden whitespace-nowrap">{tab.shortLabel}</span>

            {/* Optional badge */}
            {tab.badge && !hasDirtyIndicator && (
              <span className="hidden md:inline-block px-1.5 py-0.2 font-mono text-[9px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 rounded-full leading-tight">
                {tab.badge}
              </span>
            )}

            {/* Unsaved changes dot indicator */}
            {hasDirtyIndicator && (
              <span
                title="Cambios sin guardar en esta sección"
                className="size-2 rounded-full bg-amber-400 animate-pulse ml-0.5"
                aria-label="Cambios sin guardar"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

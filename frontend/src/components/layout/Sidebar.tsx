import { NavLink, useLocation } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  FileText,
  History,
  LayoutDashboard,
  MessageSquare,
  Settings,
  ShoppingCart,
  Users,
  UserCog,
  WalletCards,
  Banknote,
  BarChart3,
  X,
} from 'lucide-react';
import { cn } from '@shared/utils/cn';
import { useLicenseStatus } from '@shared/subscription/useLicenseStatus';

interface NavGroup {
  title?: string;
  items: Array<{
    path: string;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  }>;
}

const navGroups: NavGroup[] = [
  {
    title: 'Principal',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/clients', label: 'Clientes', icon: Users },
      { path: '/memberships', label: 'Membresías', icon: Dumbbell },
    ],
  },
  {
    title: 'Operaciones',
    items: [
      { path: '/sales', label: 'Ventas (POS)', icon: ShoppingCart },
      { path: '/cash-registers', label: 'Caja', icon: Banknote },
      { path: '/credits', label: 'Cuentas por cobrar', icon: WalletCards },
      { path: '/invoices', label: 'Comprobantes', icon: FileText },
      { path: '/reports', label: 'Reportes', icon: BarChart3 },
    ],
  },
  {
    title: 'Gestión',
    items: [
      { path: '/notifications', label: 'Notificaciones', icon: MessageSquare },
      { path: '/users', label: 'Personal', icon: UserCog },
      { path: '/audit', label: 'Auditoría', icon: History },
      { path: '/settings', label: 'Configuración', icon: Settings },
    ],
  },
];

interface SidebarProps {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onToggleCollapse: () => void;
}

export function Sidebar({
  isCollapsed,
  isMobileOpen,
  onCloseMobile,
  onToggleCollapse,
}: SidebarProps) {
  const location = useLocation();
  const isDemo = location.pathname.startsWith('/demo');
  const { data: subscription } = useLicenseStatus();

  const getPlanInfo = () => {
    if (!subscription) return null;
    if (subscription.is_lifetime) {
      return {
        title: 'Plan vitalicio',
        subtitle: 'Lifetime · Sin vencimiento',
        isActive: true,
      };
    }
    if (subscription.status === 'TRIAL') {
      return {
        title: 'Período de prueba',
        subtitle: 'Acceso completo',
        isActive: true,
      };
    }
    if (subscription.status === 'ACTIVE') {
      return {
        title: 'Plan activo',
        subtitle: subscription.plan?.name || 'Suscripción vigente',
        isActive: true,
      };
    }
    return {
      title: 'Plan suspendido',
      subtitle: 'Requiere renovación',
      isActive: false,
    };
  };

  const planInfo = getPlanInfo();

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[var(--z-drawer)] bg-black/60 backdrop-blur-sm md:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-label="Cerrar menú de navegación"
        />
      )}

      {/* Floating Spatial Sidebar (Reference 1:1) */}
      <aside
        className={cn(
          'liquid-glass fixed bottom-4 left-4 top-4 z-50 flex flex-col rounded-[32px] transition-[width,transform] duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)] select-none',
          isMobileOpen ? 'translate-x-0' : '-translate-x-[calc(100%+2rem)] md:translate-x-0',
          isCollapsed ? 'md:w-[84px]' : 'md:w-[252px]',
        )}
        aria-label="Navegación principal"
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-5 pb-5 pt-6">
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src="/logo.png"
              alt="Merwil ZonaFit"
              className="size-10 shrink-0 object-contain drop-shadow-md select-none"
            />
            <div className={cn('flex flex-col gap-1 transition-opacity', isCollapsed && 'md:hidden')}>
              <span className="text-sm font-semibold tracking-tight text-text-primary">MERWIL ZONAFIT</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">Control deportivo</span>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-full p-2 text-text-secondary hover:bg-white/10 hover:text-text-primary md:hidden"
            aria-label="Cerrar menú"
          >
            <X size={16} />
          </button>

          {/* Collapse toggle on desktop */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden rounded-full p-2 text-text-muted transition-colors hover:bg-white/10 hover:text-text-primary md:inline-flex"
            aria-label={isCollapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <div className="mx-5 h-px bg-white/10" />

        {/* Navigation List grouped */}
        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5 custom-scrollbar" aria-label="Navegación principal">
          {navGroups.map((group, groupIdx) => (
            <div key={group.title || groupIdx} className="flex flex-col gap-1">
              {group.title && !isCollapsed && (
                <p className="eyebrow px-3 pb-2 text-[10px] select-none">
                  {group.title}
                </p>
              )}
              {isCollapsed && groupIdx > 0 && (
                <div className="mx-2 my-1 h-px bg-white/10 md:block hidden" aria-hidden="true" />
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={isDemo ? `/demo${item.path}` : item.path}
                  onClick={onCloseMobile}
                  title={isCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors',
                      isCollapsed && 'md:justify-center md:px-2.5',
                      isActive
                        ? 'bg-white/10 text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                        : 'text-text-secondary hover:bg-white/5 hover:text-text-primary',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className="size-[18px] shrink-0" strokeWidth={1.6} />
                      <span className={cn('flex-1 truncate', isCollapsed && 'md:hidden')}>
                        {item.label}
                      </span>
                      {isActive && <span className="size-1.5 rounded-full bg-brand-primary shadow-glow-brand shrink-0" />}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer: Gym License / Subscription Status Pill */}
        {planInfo && (
          <div className="p-3">
            <div className="liquid-glass-soft flex items-center gap-3 rounded-2xl px-3 py-3">
              <span className="relative flex size-2 shrink-0">
                {planInfo.isActive && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />
                )}
                <span
                  className={cn(
                    'relative size-2 rounded-full',
                    planInfo.isActive ? 'bg-emerald-400' : 'bg-brand-primary'
                  )}
                />
              </span>
              {!isCollapsed && (
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-xs font-medium truncate">{planInfo.title}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted truncate">
                    {planInfo.subtitle}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

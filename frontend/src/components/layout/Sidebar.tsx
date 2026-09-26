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
  X,
} from 'lucide-react';
import { cn } from '@shared/utils/cn';

interface NavGroup {
  title?: string;
  items: Array<{
    path: string;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
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

  return (
    <>
      {isMobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[var(--z-drawer)] bg-black/60 backdrop-blur-md md:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-label="Cerrar menú de navegación"
        />
      )}

      <aside
        className={cn(
          'fixed z-[calc(var(--z-drawer)+10)] md:z-[var(--z-sidebar)] flex flex-col transition-[width,transform] duration-250 ease-out',
          // Mobile: Full height slide-over from left
          'inset-y-0 left-0 border-r border-border-light bg-surface-panel/95 backdrop-blur-xl md:bg-surface-glass-regular md:backdrop-blur-md md:border',
          // Desktop: Floating spatial sidebar with gentle margins
          isDemo ? 'md:top-[52px]' : 'md:top-3',
          'md:bottom-3 md:left-3 md:rounded-[var(--radius-2xl)] md:shadow-floating',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          isCollapsed ? 'w-[var(--sidebar-width)] md:w-[var(--sidebar-collapsed-width)]' : 'w-[var(--sidebar-width)]',
        )}
      >
        {/* Brand Header */}
        <div className="flex h-[var(--navbar-height)] shrink-0 items-center justify-between border-b border-border-light px-4">
          <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-brand-primary/10 border border-brand-primary/20">
              <img
                src="/logo.png"
                alt="Merwil ZonaFit"
                className="h-6 w-6 object-contain drop-shadow-xs"
              />
            </div>
            <div className={cn('min-w-0 whitespace-nowrap transition-opacity', isCollapsed && 'md:hidden')}>
              <p className="text-sm font-bold tracking-tight text-text-primary leading-tight">MERWIL ZONAFIT</p>
              <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-brand-primary/90 leading-tight mt-0.5">Control Deportivo</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-[var(--radius-sm)] p-1.5 text-text-muted transition-colors hover:bg-white/[0.06] hover:text-text-primary md:hidden"
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
          
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden rounded-[var(--radius-sm)] p-1.5 text-text-muted transition-colors hover:bg-white/[0.06] hover:text-text-primary md:inline-flex"
            aria-label={isCollapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation List grouped */}
        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4 custom-scrollbar" aria-label="Navegación principal">
          {navGroups.map((group, groupIdx) => (
            <div key={group.title || groupIdx} className="flex flex-col gap-1">
              {group.title && !isCollapsed && (
                <span className="px-3 pb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-text-muted/60 select-none">
                  {group.title}
                </span>
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={isDemo ? `/demo${item.path}` : item.path}
                  onClick={onCloseMobile}
                  title={isCollapsed ? item.label : undefined}
                  className={({ isActive }) => cn(
                    'group relative flex min-h-[2.5rem] items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm font-medium transition-all duration-150',
                    isCollapsed && 'md:justify-center md:px-2',
                    isActive
                      ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20 shadow-xs'
                      : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]',
                  )}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span 
                          className="absolute left-1 top-2 bottom-2 w-1 rounded-full bg-brand-primary" 
                          aria-hidden="true" 
                        />
                      )}
                      <item.icon 
                        size={18} 
                        className={cn(
                          'shrink-0 transition-colors duration-150',
                          isActive 
                            ? 'text-brand-primary' 
                            : 'text-text-muted group-hover:text-text-primary'
                        )} 
                        aria-hidden="true" 
                      />
                      <span className={cn('truncate', isCollapsed && 'md:hidden')}>
                        {item.label}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

import { NavLink } from 'react-router-dom';
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
import { cn } from '../../utils/cn';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/clients', label: 'Clientes', icon: Users },
  { path: '/memberships', label: 'Membresías', icon: Dumbbell },
  { path: '/sales', label: 'Ventas (POS)', icon: ShoppingCart },
  { path: '/cash-registers', label: 'Caja', icon: Banknote },
  { path: '/credits', label: 'Cuentas por cobrar', icon: WalletCards },
  { path: '/invoices', label: 'Comprobantes', icon: FileText },
  { path: '/notifications', label: 'Notificaciones', icon: MessageSquare },
  { path: '/users', label: 'Personal', icon: UserCog },
  { path: '/audit', label: 'Auditoría', icon: History },
  { path: '/settings', label: 'Configuración', icon: Settings },
] as const;

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
  return (
    <>
      {isMobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[var(--z-modal)] bg-text-primary/35 backdrop-blur-sm md:hidden"
          onClick={onCloseMobile}
          aria-label="Cerrar menú de navegación"
        />
      )}

      <aside
        className={cn(
          'zonafit-floating-surface fixed inset-y-0 left-0 z-[var(--z-sidebar)] flex h-screen flex-col border-r transition-[width,transform] duration-300',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          isCollapsed ? 'w-[var(--sidebar-width)] md:w-20' : 'w-[var(--sidebar-width)]',
        )}
      >
        <div className="flex h-[var(--navbar-height)] shrink-0 items-center border-b border-border-light px-4">
          <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
            <img
              src="/logo.png"
              alt="ZonaFit"
              className="h-8 w-8 shrink-0 object-contain drop-shadow-sm"
            />
            <div className={cn('min-w-0 whitespace-nowrap', isCollapsed && 'md:hidden')}>
              <p className="text-sm font-bold tracking-tight text-text-primary leading-tight">ZONAFIT</p>
              <p className="text-[0.65rem] font-medium uppercase tracking-wider text-text-muted leading-tight mt-0.5">Centro de operaciones</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-[var(--radius-sm)] p-2 text-text-muted transition-colors hover:bg-bg-surface-hover hover:text-text-primary md:hidden"
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden rounded-[var(--radius-sm)] p-2 text-text-muted transition-colors hover:bg-bg-surface-hover hover:text-text-primary md:inline-flex"
            aria-label={isCollapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-5" aria-label="Navegación principal">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onCloseMobile}
              title={isCollapsed ? item.label : undefined}
              className={({ isActive }) => cn(
                'group flex min-h-[2.75rem] items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm font-medium transition-all duration-300',
                isCollapsed && 'md:justify-center md:px-2',
                isActive
                  ? 'bg-brand-primary/10 border border-brand-primary/20 text-brand-primary shadow-sm hover:bg-brand-primary/15'
                  : 'bg-transparent border border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover hover:border-border-light',
              )}
            >
              {({ isActive }) => (
                <>
                  <item.icon 
                    size={20} 
                    className={cn(
                      "shrink-0 transition-all duration-300", 
                      isActive 
                        ? "text-brand-primary group-hover:brightness-110 group-hover:translate-x-[1px]" 
                        : "text-text-muted group-hover:text-text-secondary group-hover:brightness-110 group-hover:translate-x-[1px]"
                    )} 
                    aria-hidden="true" 
                  />
                  <span className={cn('truncate', isCollapsed && 'md:hidden')}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}

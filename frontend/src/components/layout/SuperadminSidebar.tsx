import { NavLink } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Building2,
  Users,
  History,
  Package,
  Receipt,
  X,
} from 'lucide-react';
import { cn } from '../../utils/cn';

const navItems = [
  { path: '/superadmin', label: 'Overview', icon: LayoutDashboard },
  { path: '/superadmin/plans', label: 'Planes Comerciales', icon: Package },
  { path: '/superadmin/gyms', label: 'Gimnasios', icon: Building2 },
  { path: '/superadmin/users', label: 'Usuarios', icon: Users },
  { path: '/superadmin/subscriptions', label: 'Suscripciones', icon: Receipt },
  { path: '/superadmin/audit', label: 'Auditoría Global', icon: History },
] as const;

interface SidebarProps {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onToggleCollapse: () => void;
}

export function SuperadminSidebar({
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
          className="fixed inset-0 z-overlay bg-text-primary/35 backdrop-blur-sm md:hidden"
          onClick={onCloseMobile}
          aria-label="Cerrar menú de navegación"
        />
      )}

      <aside
        className={cn(
          'zonafit-floating-surface fixed inset-y-0 left-0 z-fixed flex h-screen flex-col border-r transition-[width,transform] duration-300',
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
              <p className="text-[0.65rem] font-medium uppercase tracking-wider text-brand-primary leading-tight mt-0.5">PLATFORM ADMIN</p>
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
              end={item.path === '/superadmin'}
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

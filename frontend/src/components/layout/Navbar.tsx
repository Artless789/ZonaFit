import { LogOut, Menu, Sun, Moon } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Avatar } from '@shared/ui/Avatar';
import { Button } from '@shared/ui/Button';
import { useGymSettings } from '../../hooks/useGymSettings';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/clients': 'Clientes',
  '/memberships': 'Membresías',
  '/sales': 'Ventas e inventario',
  '/cash-registers': 'Caja',
  '/credits': 'Cuentas por cobrar',
  '/invoices': 'Comprobantes',
  '/notifications': 'Notificaciones',
  '/audit': 'Auditoría',
  '/settings': 'Configuración',
  '/superadmin': 'Overview',
  '/superadmin/gyms': 'Gimnasios',
  '/superadmin/users': 'Usuarios',
  '/superadmin/plans': 'Planes Comerciales',
  '/superadmin/subscriptions': 'Suscripciones',
  '/superadmin/audit': 'Auditoría Global',
};

interface NavbarProps {
  onOpenMobileMenu: () => void;
}

export function Navbar({ onOpenMobileMenu }: NavbarProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const { query } = useGymSettings();
  const title = pageTitles[location.pathname] ?? 'Centro de operaciones';
  const isSuperadmin = user?.role?.toUpperCase() === 'SUPERADMIN';
  const gymName = isSuperadmin ? 'PLATAFORMA' : (query.data?.trade_name || 'MERWIL ZONAFIT');

  return (
    <div className="sticky top-0 z-[var(--z-navbar)] w-full px-3 pt-3 sm:px-6 pointer-events-none">
      <header className="zonafit-navbar-surface pointer-events-auto flex h-[var(--navbar-height)] w-full items-center justify-between rounded-[var(--radius-xl)] px-4 sm:px-6 transition-all">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 mr-2 sm:mr-4">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="shrink-0 rounded-[var(--radius-sm)] p-2 text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary md:hidden"
            aria-label="Abrir menú de navegación"
          >
            <Menu size={20} />
          </button>
          
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm sm:text-base font-semibold tracking-tight text-text-primary">{title}</h1>
            <p className="truncate text-[0.625rem] font-semibold tracking-wider uppercase text-brand-primary mt-0.5">{`${gymName} SYSTEM`}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="group flex shrink-0 items-center gap-2 sm:gap-3 rounded-full border border-border-light bg-surface-raised/70 py-1 pl-1 sm:pl-3.5 pr-1 shadow-xs transition-all duration-150 hover:border-border-medium hover:bg-surface-panel-hover">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold leading-none text-text-primary mb-0.5">{user?.full_name || 'Administrador'}</p>
              <p className="text-[0.625rem] text-text-muted leading-none font-medium">{user?.role || 'Admin'}</p>
            </div>
            <Avatar fallback={user?.full_name?.substring(0, 2).toUpperCase() || 'AD'} className="h-7.5 w-7.5 border border-border-medium shadow-xs" />
          </div>

          <div className="hidden h-5 w-px bg-border-light sm:block" />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="shrink-0 text-text-muted hover:text-text-primary"
            title="Alternar tema"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="shrink-0 text-text-muted hover:text-danger hover:bg-danger/10"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut size={17} />
          </Button>
        </div>
      </header>
    </div>
  );
}

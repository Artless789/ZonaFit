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
    <div className="sticky top-0 z-[var(--z-navbar)] w-full px-4 pt-4 sm:px-6 pointer-events-none">
      <header className="zonafit-navbar-surface pointer-events-auto flex h-[var(--navbar-height)] w-full items-center justify-between rounded-[var(--radius-xl)] px-4 sm:px-6 transition-all">
        
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="rounded-[var(--radius-sm)] p-2 text-text-secondary transition-colors hover:bg-glass-overlay hover:text-text-primary md:hidden"
            aria-label="Abrir menú de navegación"
          >
            <Menu size={20} />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="hidden min-w-0 sm:block">
              <h1 className="truncate text-base font-bold tracking-tight text-text-primary drop-shadow-sm">{title}</h1>
              <p className="text-[0.65rem] font-medium tracking-wider uppercase text-brand-primary/80 mt-0.5">{`${gymName} SYSTEM`}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="group flex items-center gap-3 rounded-full border border-border-light bg-bg-surface/60 backdrop-blur-md py-1.5 pl-4 pr-1.5 shadow-xs transition-all duration-300 hover:bg-glass-overlay hover:border-border-medium hover:shadow-glass cursor-pointer">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-none text-text-primary mb-0.5 transition-colors">{user?.full_name || 'Administrador'}</p>
              <p className="text-xs text-text-muted leading-none">{user?.role || 'Admin'}</p>
            </div>
            <Avatar fallback={user?.full_name?.substring(0,2).toUpperCase() || 'AD'} className="h-8 w-8 border border-border-medium shadow-sm transition-transform duration-300 group-hover:scale-105" />
          </div>

          <div className="hidden h-6 w-px bg-border-light sm:block" />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-text-muted hover:text-text-primary transition-colors"
            title="Alternar tema"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="text-text-muted transition-all duration-300 hover:text-danger hover:bg-danger/10 hover:scale-105 active:scale-95"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut size={18} className="transition-transform duration-300" />
          </Button>
        </div>
        
      </header>
    </div>
  );
}

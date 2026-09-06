/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { User, authService, LoginCredentials } from '../services/authService';
import { sessionManager } from '../shared/session/sessionManager';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<User>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      // Bloque L: Si estamos offline en reload, no borramos la sesión automáticamente.
      // Dependeremos del caché de React Query para mostrar la UI. 
      // El access token real estará vacío, pero no hacemos logout forzado.
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (isMounted) setIsLoading(false);
        return;
      }

      // 1. Si ya tenemos un token en memoria válido (ej. login antes de navegación cliente), reutilizarlo
      const existingToken = sessionManager.getToken();
      if (existingToken) {
        try {
          if (!user) {
            const profile = await authService.getProfile();
            if (isMounted) setUser(profile);
          }
          if (isMounted) setIsLoading(false);
          return;
        } catch {
          sessionManager.clearToken();
        }
      }

      try {
        // 2. Intentar recuperar la sesión mediante httpOnly cookie
        const response = await authService.refresh();
        if (response.access_token && isMounted) {
          const profile = await authService.getProfile();
          if (isMounted) setUser(profile);
        }
      } catch {
        if (isMounted) {
          sessionManager.clearToken();
          setUser(null);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initAuth();

    const handleUnauthorized = () => {
      sessionManager.clearToken();
      if (isMounted) setUser(null);
      queryClient.clear();
    };
    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => {
      isMounted = false;
      window.removeEventListener('auth-unauthorized', handleUnauthorized);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);

  const login = async (credentials: LoginCredentials) => {
    const response = await authService.login(credentials);
    if (response.access_token) {
      sessionManager.setToken(response.access_token);
      // Immediately fetch profile
      const profile = await authService.getProfile();
      setUser(profile);
      return profile;
    }
    throw new Error('No access token received');
  };

  const logout = async () => {
    await authService.logout();
    sessionManager.clearToken();
    setUser(null);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

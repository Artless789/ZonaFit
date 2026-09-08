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

const USER_CACHE_KEY = 'zf_user_cache';

const getCachedUser = (): User | null => {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const data = window.sessionStorage.getItem(USER_CACHE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }
  return null;
};

const setCachedUser = (u: User | null): void => {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      if (u) {
        window.sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(u));
      } else {
        window.sessionStorage.removeItem(USER_CACHE_KEY);
      }
    } catch {
      // Ignorar fallos de almacenamiento
    }
  }
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getCachedUser());
  const [isLoading, setIsLoading] = useState(() => {
    // Si ya tenemos token y usuario en caché, no necesitamos bloquear con pantalla completa
    const token = sessionManager.getToken();
    const cached = getCachedUser();
    return !(token && cached);
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      // Si estamos offline, usamos la sesión y caché local sin forzar logout
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = getCachedUser();
        if (cached && isMounted) setUser(cached);
        if (isMounted) setIsLoading(false);
        return;
      }

      // 1. Si ya tenemos un token disponible (memoria o sessionStorage), usarlo de inmediato
      const existingToken = sessionManager.getToken();
      if (existingToken) {
        const cached = getCachedUser();
        if (cached && isMounted) {
          setUser(cached);
          setIsLoading(false);
        }

        // Validar / actualizar perfil en background sin congelar la UI
        try {
          const profile = await authService.getProfile();
          if (isMounted) {
            setUser(profile);
            setCachedUser(profile);
            setIsLoading(false);
          }
          return;
        } catch (err: any) {
          // Si el token es inválido (401), limpiarlo y continuar con el refresh de cookie abajo
          if (err.response?.status !== 401) {
            if (isMounted) setIsLoading(false);
            return;
          }
          sessionManager.clearToken();
          setCachedUser(null);
        }
      }

      try {
        // 2. Intentar recuperar la sesión mediante httpOnly cookie
        const response = await authService.refresh();
        if (response.access_token && isMounted) {
          const profile = await authService.getProfile();
          if (isMounted) {
            setUser(profile);
            setCachedUser(profile);
          }
        }
      } catch {
        if (isMounted) {
          sessionManager.clearToken();
          setCachedUser(null);
          setUser(null);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initAuth();

    const handleUnauthorized = () => {
      sessionManager.clearToken();
      setCachedUser(null);
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
    // Purgar caché de React Query para evitar mezclas o datos stale entre tenants/usuarios
    queryClient.clear();

    const response = await authService.login(credentials);
    if (response.access_token) {
      sessionManager.setToken(response.access_token);
      // Immediately fetch profile
      const profile = await authService.getProfile();
      setUser(profile);
      setCachedUser(profile);
      return profile;
    }
    throw new Error('No access token received');
  };

  const logout = async () => {
    await authService.logout();
    sessionManager.clearToken();
    setCachedUser(null);
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

// Gestor de sesión seguro
// Protege el access token utilizando memoria primaria con respaldo en sessionStorage
// para sincronización entre el bundle web y la PWA operativa en la misma pestaña.
// El refresh token de largo plazo se maneja exclusivamente vía HttpOnly cookies.

const TOKEN_STORAGE_KEY = 'zf_access_token';

let memoryToken: string | null = null;

function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const jsonPayload = decodeURIComponent(
      Array.prototype.map.call(raw, (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    const payload = JSON.parse(jsonPayload);
    if (!payload.exp) return false;
    // Buffer de 15 segundos para evitar usar tokens a punto de expirar
    return Date.now() >= (payload.exp * 1000) - 15000;
  } catch {
    return false;
  }
}

export const sessionManager = {
  getToken: (): string | null => {
    if (memoryToken && !isTokenExpired(memoryToken)) {
      return memoryToken;
    }

    if (typeof window !== 'undefined') {
      try {
        // 1. Intentar sessionStorage primero
        let storedToken = window.sessionStorage?.getItem(TOKEN_STORAGE_KEY);
        // 2. Si no está en sessionStorage, buscar en localStorage
        if (!storedToken) {
          storedToken = window.localStorage?.getItem(TOKEN_STORAGE_KEY);
        }

        if (storedToken) {
          if (isTokenExpired(storedToken)) {
            sessionManager.clearToken();
            return null;
          }
          memoryToken = storedToken;
          return storedToken;
        }
      } catch {
        // Ignorar errores de acceso a storage
      }
    }

    return null;
  },

  setToken: (token: string): void => {
    memoryToken = token;
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage?.setItem(TOKEN_STORAGE_KEY, token);
        window.localStorage?.setItem(TOKEN_STORAGE_KEY, token);
      } catch {
        // Ignorar fallos de almacenamiento
      }
    }
  },

  clearToken: (): void => {
    memoryToken = null;
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage?.removeItem(TOKEN_STORAGE_KEY);
        window.sessionStorage?.removeItem('zf_user_cache');
        window.sessionStorage?.removeItem('zf_user_cache_ts');
        window.localStorage?.removeItem(TOKEN_STORAGE_KEY);
        window.localStorage?.removeItem('zf_user_cache');
        window.localStorage?.removeItem('zf_user_cache_ts');
      } catch {
        // Ignorar fallos de almacenamiento
      }
    }
  }
} as const;


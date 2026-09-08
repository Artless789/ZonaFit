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
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    if (!payload.exp) return false;
    // Expira si el tiempo actual es mayor al tiempo de expiración
    return Date.now() >= payload.exp * 1000;
  } catch {
    return false;
  }
}

export const sessionManager = {
  getToken: (): string | null => {
    if (memoryToken && !isTokenExpired(memoryToken)) {
      return memoryToken;
    }

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const storedToken = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
        if (storedToken) {
          if (isTokenExpired(storedToken)) {
            window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
            memoryToken = null;
            return null;
          }
          memoryToken = storedToken;
          return storedToken;
        }
      } catch {
        // Ignorar errores de acceso a sessionStorage
      }
    }

    return null;
  },

  setToken: (token: string): void => {
    memoryToken = token;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      } catch {
        // Ignorar fallos de almacenamiento
      }
    }
  },

  clearToken: (): void => {
    memoryToken = null;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        window.sessionStorage.removeItem('zf_user_cache');
      } catch {
        // Ignorar fallos de almacenamiento
      }
    }
  }
} as const;


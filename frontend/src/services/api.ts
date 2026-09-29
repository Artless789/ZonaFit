import axios from 'axios';
import { sessionManager } from '../shared/session/sessionManager';
import { SyncManager } from '../shared/offline/syncManager';

// Get base URL from env, or default to relative path in production (same container) and localhost in development
const API_URL = import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : (import.meta.env.PROD ? '' : 'http://localhost:8000');

export const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface RefreshResponse {
  access_token: string;
  token_type: string;
  user?: any;
}

// Single-flight refresh token promise mutex to guarantee AT MOST ONE /auth/refresh HTTP request in flight at any time
let refreshPromise: Promise<RefreshResponse> | null = null;

export const performTokenRefresh = async (): Promise<RefreshResponse> => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await axios.post<RefreshResponse>(
        `${API_URL}/auth/refresh`,
        {},
        { withCredentials: true }
      );
      const data = res.data;
      const newToken = data?.access_token;
      if (!newToken) {
        throw new Error('No access token returned from refresh endpoint');
      }
      sessionManager.setToken(newToken);
      return data;
    } catch (err: any) {
      const status = err?.response?.status;
      // Discard session only on explicit auth failure (401/403), not on network offline or 500
      if (status === 401 || status === 403) {
        sessionManager.clearToken();
        window.dispatchEvent(new Event('auth-unauthorized'));
      }
      throw err;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

api.interceptors.request.use(
  (config) => {
    const token = sessionManager.getToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Evitar interceptor para endpoints de auth específicos
    if (!originalRequest || originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    let userMessage = 'Ha ocurrido un error inesperado. Por favor, inténtalo nuevamente.';
    
    if (!error.response) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        // Offline: intentar encolar si es una operación permitida
        const method = originalRequest.method?.toUpperCase() || '';
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          const url = originalRequest.url || '';
          if (SyncManager.isEndpointAllowed(url)) {
            let payload = originalRequest.data;
            if (typeof payload === 'string') {
                try { payload = JSON.parse(payload); } catch { /* Ignore non-JSON */ }
            }
            // Encolar y rechazar con mensaje amistoso
            await SyncManager.enqueue(url, method as 'POST' | 'PUT' | 'PATCH' | 'DELETE', payload);
            error.userMessage = 'Estás sin conexión. La operación fue guardada y se sincronizará automáticamente.';
            error.isOfflineQueued = true;
            return Promise.reject(error);
          }
        }
      }
      userMessage = 'Error de conexión. Verifica tu conexión a internet e inténtalo nuevamente.';
    } else {
      const status = error.response.status;
      const detail = error.response.data?.detail || error.response.data?.message;

      switch (status) {
        case 401:
          if (!originalRequest._retry) {
            originalRequest._retry = true;

            // Bloque H: NO intentar refresh sin conexión.
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
              userMessage = 'No hay conexión a Internet. La sesión no pudo validarse.';
              break;
            }

            try {
              const refreshData = await performTokenRefresh();
              const newToken = refreshData.access_token;
              if (!originalRequest.headers) {
                originalRequest.headers = {} as Record<string, string>;
              }
              originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
              return api(originalRequest);
            } catch (refreshError) {
              userMessage = 'Tu sesión ha expirado o es inválida.';
              error.userMessage = userMessage;
              return Promise.reject(refreshError);
            }
          } else {
            sessionManager.clearToken();
            window.dispatchEvent(new Event('auth-unauthorized'));
            userMessage = 'Tu sesión ha expirado o es inválida.';
          }
          break;
        case 403:
          if (detail === 'SUBSCRIPTION_REQUIRED') {
            userMessage = 'El acceso está restringido debido al estado comercial de tu gimnasio.';
            window.dispatchEvent(new Event('subscription-restricted'));
          } else {
            userMessage = 'No tienes permisos para realizar esta acción.';
          }
          break;
        case 404:
          userMessage = detail || 'El recurso solicitado no fue encontrado.';
          break;
        case 409:
          userMessage = detail || 'Existe un conflicto con los datos actuales.';
          break;
        case 422:
          userMessage = detail || 'Los datos proporcionados son inválidos. Verifica el formulario.';
          break;
        case 429:
          userMessage = 'Demasiadas solicitudes. Por favor, espera un momento antes de reintentar.';
          break;
        case 500:
          userMessage = 'Error interno del servidor. Nuestro equipo ha sido notificado.';
          break;
        default:
          userMessage = detail || userMessage;
      }
    }

    // Attach to the error object so components can read it easily
    error.userMessage = userMessage;

    return Promise.reject(error);
  }
);

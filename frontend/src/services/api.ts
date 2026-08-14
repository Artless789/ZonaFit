import axios from 'axios';

// Get base URL from env, or default to standard local API port
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Determine a user-friendly message based on status
    let userMessage = 'Ha ocurrido un error inesperado. Por favor, inténtalo nuevamente.';
    
    if (!error.response) {
      userMessage = 'Error de conexión. Verifica tu conexión a internet e inténtalo nuevamente.';
    } else {
      const status = error.response.status;
      const detail = error.response.data?.detail || error.response.data?.message;

      switch (status) {
        case 401:
          localStorage.removeItem('token');
          window.dispatchEvent(new Event('auth-unauthorized'));
          userMessage = 'Tu sesión ha expirado o es inválida.';
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

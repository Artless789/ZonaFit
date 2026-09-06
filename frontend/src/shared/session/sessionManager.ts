// Gestor de sesión en memoria
// Protege el access token evitando que resida en localStorage (XSS prevention)
// El refresh token se maneja automáticamente vía HttpOnly cookies.

let memoryToken: string | null = null;

export const sessionManager = {
  getToken: (): string | null => memoryToken,
  setToken: (token: string): void => {
    memoryToken = token;
  },
  clearToken: (): void => {
    memoryToken = null;
  }
} as const;

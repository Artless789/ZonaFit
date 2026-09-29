import { api, performTokenRefresh } from './api';

export interface LoginCredentials {
  email?: string;
  username?: string;
  password?: string;
}

export interface SubscriptionSummary {
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
  ends_at: string | null;
  starts_at: string | null;
  is_lifetime: boolean;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  gym_id?: string;
  onboarding_completed?: boolean;
  subscription?: SubscriptionSummary | null;
}

export const authService = {
  login: async (credentials: LoginCredentials) => {
    const formData = new URLSearchParams();
    const rawUsername = credentials.username || credentials.email || '';
    formData.append('username', rawUsername.trim().toLowerCase());
    if (credentials.password) formData.append('password', credentials.password);
    
    // Ensure demo mode is explicitly disabled on real login
    localStorage.removeItem('demo_mode');
    
    const { data } = await api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return data;
  },

  register: async (payload: any) => {
    // Ensure demo mode is explicitly disabled on real registration
    localStorage.removeItem('demo_mode');
    
    const normalizedPayload = {
      ...payload,
      owner_email: payload.owner_email ? payload.owner_email.trim().toLowerCase() : payload.owner_email,
    };
    const { data } = await api.post('/auth/register', normalizedPayload);
    return data;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      console.warn("Logout request failed or already logged out");
    }
  },

  refresh: async (): Promise<{ access_token: string; token_type: string; user?: User }> => {
    const data = await performTokenRefresh();
    return data;
  },
  
  getProfile: async (): Promise<User> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
    return response.data;
  },

  validateResetToken: async (token: string): Promise<{ valid: boolean, email: string }> => {
    const response = await api.get(`/auth/reset-password/validate?token=${token}`);
    return response.data;
  },

  resetPassword: async (token: string, new_password: string): Promise<{ message: string }> => {
    const response = await api.post('/auth/reset-password', { token, new_password });
    return response.data;
  }
};

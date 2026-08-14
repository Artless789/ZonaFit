import { api } from './api';

export interface LoginCredentials {
  email?: string;
  username?: string;
  password?: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  gym_id?: string;
  onboarding_completed?: boolean;
}

export const authService = {
  login: async (credentials: LoginCredentials) => {
    const formData = new URLSearchParams();
    if (credentials.email) formData.append('username', credentials.email);
    if (credentials.username) formData.append('username', credentials.username);
    if (credentials.password) formData.append('password', credentials.password);
    
    const { data } = await api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return data;
  },

  register: async (payload: any) => {
    const { data } = await api.post('/auth/register', payload);
    return data;
  },
  
  getProfile: async (): Promise<User> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await api.post('/auth/forgot-password', { email });
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

import { api } from './api';
import { CashRegister, CashMovement } from '../types/cash_register';

export const cashRegisterService = {
  getActive: async (): Promise<CashRegister | null> => {
    try {
      const response = await api.get('/cash-registers/active');
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  open: async (data: { opening_balance: number }): Promise<CashRegister> => {
    const response = await api.post('/cash-registers/open', data);
    return response.data;
  },

  close: async (registerId: number, data: { counted_balance: number; closing_notes?: string }): Promise<CashRegister> => {
    const response = await api.post(`/cash-registers/${registerId}/close`, data);
    return response.data;
  },

  createMovement: async (data: { amount: number; type: 'IN' | 'OUT'; category: string; description?: string }): Promise<CashMovement> => {
    const response = await api.post('/cash-registers/movements', data);
    return response.data;
  },

  getAll: async (): Promise<CashRegister[]> => {
    const response = await api.get('/cash-registers/');
    return response.data;
  },

  getMovements: async (registerId: number): Promise<CashMovement[]> => {
    const response = await api.get(`/cash-registers/${registerId}/movements`);
    return response.data;
  }
};

import { api } from './api';
import type { AccountsReceivable, PaymentRequest } from '../types/accountsReceivable';
import type { Payment } from '../types/payment';
import type { PaginationResponse } from '../types/pagination';

export const accountsReceivableService = {
  getAll: async (params?: { page?: number; limit?: number; status?: string }): Promise<PaginationResponse<AccountsReceivable>> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    
    const { data } = await api.get<PaginationResponse<AccountsReceivable>>(`/accounts-receivables/?${queryParams.toString()}`);
    return data;
  },

  getById: async (id: number): Promise<AccountsReceivable> => {
    const { data } = await api.get<AccountsReceivable>(`/accounts-receivables/${id}`);
    return data;
  },

  getPayments: async (id: number): Promise<Payment[]> => {
    const { data } = await api.get<Payment[]>(`/accounts-receivables/${id}/payments`);
    return data;
  },

  registerPayment: async (id: number, payload: PaymentRequest): Promise<AccountsReceivable> => {
    const { data } = await api.post<AccountsReceivable>(`/accounts-receivables/${id}/pay`, payload);
    return data;
  }
};

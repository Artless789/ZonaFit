import { api } from './api';
import type { Invoice, InvoiceCreate, InvoiceDetail } from '@shared/types/invoice';
import type { PaginationResponse } from '@shared/types/pagination';

export const invoiceService = {
  getAll: async (params?: { page?: number; limit?: number; search?: string; status?: string }): Promise<PaginationResponse<Invoice>> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('invoice_number', params.search); // Assuming search maps to invoice_number filter
    if (params?.status) queryParams.append('status', params.status);
    
    const { data } = await api.get<PaginationResponse<Invoice>>(`/invoices/?${queryParams.toString()}`);
    return data;
  },

  getById: async (id: number): Promise<Invoice> => {
    const { data } = await api.get<Invoice>(`/invoices/${id}`);
    return data;
  },

  getDetails: async (id: number): Promise<InvoiceDetail[]> => {
    const { data } = await api.get<InvoiceDetail[]>(`/invoice-details/${id}`);
    return data;
  },

  create: async (payload: InvoiceCreate): Promise<Invoice> => {
    const { data } = await api.post<Invoice>('/invoices/', payload);
    return data;
  },
  
  cancel: async (id: number): Promise<void> => {
    // We assume cancellation is a status update or delete.
    // Based on the router, DELETE /invoices/{id} soft deletes (is_active = False)
    // but the backend update might allow changing status to CANCELLED.
    await api.put(`/invoices/${id}`, { status: 'CANCELLED' });
  }
};

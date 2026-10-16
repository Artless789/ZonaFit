import { api } from './api';
import type { Client, ClientCreate, ClientUpdate, Client360Response, ClientMetrics } from '@shared/types/client';
import type { PaginationResponse } from '@shared/types/pagination';
import type { 
  ClientImportPreviewResponse, 
  ClientImportApplyRequest, 
  ClientImportApplyResponse 
} from '@shared/types/clientExcel';



export const clientService = {
  async getClients(page: number = 1, pageSize: number = 20, search: string = '', isActive?: boolean, filterType?: string): Promise<PaginationResponse<Client>> {
    const validPageSize = Math.min(Math.max(1, pageSize), 100);
    const { data } = await api.get<PaginationResponse<Client>>('/clients/', {
      params: {
        page,
        page_size: validPageSize,
        search: search || undefined,
        is_active: isActive,
        filter_type: filterType || undefined,
      }
    });
    return data;
  },

  async getClientMetrics(): Promise<ClientMetrics> {
    const res = await api.get<ClientMetrics>('/clients/metrics');
    return res.data;
  },

  async getClient(id: number): Promise<Client> {
    const { data } = await api.get<Client>(`/clients/${id}`);
    return data;
  },

  async getClient360(id: number): Promise<Client360Response> {
    const { data } = await api.get<Client360Response>(`/clients/${id}/360`);
    return data;
  },

  async createClient(clientData: ClientCreate): Promise<Client> {
    const { data } = await api.post<Client>('/clients/', clientData);
    return data;
  },

  async updateClient(id: number, clientData: ClientUpdate): Promise<Client> {
    const { data } = await api.put<Client>(`/clients/${id}`, clientData);
    return data;
  },

  async deleteClient(id: number): Promise<void> {
    await api.delete(`/clients/${id}`);
  },

  async uploadPhoto(clientId: number, file: File): Promise<Client> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post<Client>(`/clients/${clientId}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async deletePhoto(clientId: number): Promise<Client> {
    const { data } = await api.delete<Client>(`/clients/${clientId}/photo`);
    return data;
  },

  async exportClients(): Promise<void> {
    const response = await api.get('/clients/export', {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Extract filename from header if available, else default
    const contentDisposition = response.headers['content-disposition'];
    let filename = 'clientes_zonafit.xlsx';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) filename = match[1];
    }
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  async downloadTemplate(): Promise<void> {
    const response = await api.get('/clients/import/template', {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'plantilla_clientes_zonafit.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  async previewImport(file: File): Promise<ClientImportPreviewResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post<ClientImportPreviewResponse>('/clients/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async applyImport(payload: ClientImportApplyRequest): Promise<ClientImportApplyResponse> {
    const { data } = await api.post<ClientImportApplyResponse>('/clients/import/apply', payload);
    return data;
  },
};

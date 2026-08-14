import { api } from './api';
import type { Client, ClientCreate, ClientUpdate, Client360Response } from '../types/client';
import type { PaginationResponse } from '../types/pagination';



export const clientService = {
  async getClients(page: number = 1, pageSize: number = 20, search: string = '', isActive?: boolean): Promise<PaginationResponse<Client>> {
    const { data } = await api.get<PaginationResponse<Client>>('/clients/', {
      params: { page, page_size: pageSize, search: search || undefined, is_active: isActive }
    });
    return data;
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
};

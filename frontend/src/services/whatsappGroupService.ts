import { api } from './api';
import type {
  WhatsAppGroup,
  WhatsAppGroupCreate,
  WhatsAppGroupUpdate,
} from '../shared/types/whatsappGroup';

export const whatsappGroupService = {
  getAll: async (isActive?: boolean): Promise<WhatsAppGroup[]> => {
    const params = typeof isActive === 'boolean' ? { is_active: isActive } : {};
    const { data } = await api.get<WhatsAppGroup[]>('/whatsapp-groups/', { params });
    if (Array.isArray(data)) {
      return data;
    }
    if (data && typeof data === 'object' && Array.isArray((data as any).items)) {
      return (data as any).items;
    }
    return [];
  },

  getById: async (id: number): Promise<WhatsAppGroup> => {
    const { data } = await api.get<WhatsAppGroup>(`/whatsapp-groups/${id}`);
    return data;
  },

  create: async (payload: WhatsAppGroupCreate): Promise<WhatsAppGroup> => {
    const { data } = await api.post<WhatsAppGroup>('/whatsapp-groups/', payload);
    return data;
  },

  update: async (id: number, payload: WhatsAppGroupUpdate): Promise<WhatsAppGroup> => {
    const { data } = await api.put<WhatsAppGroup>(`/whatsapp-groups/${id}`, payload);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/whatsapp-groups/${id}`);
  },

  openGroup: (inviteUrl: string): void => {
    if (!inviteUrl) return;
    window.open(inviteUrl, '_blank', 'noopener,noreferrer');
  },

  copyAndOpenGroup: async (message: string, inviteUrl: string): Promise<boolean> => {
    try {
      if (message && navigator.clipboard) {
        await navigator.clipboard.writeText(message);
      }
    } catch {
      // Clipboard write fallback or silent catch
    }
    if (inviteUrl) {
      window.open(inviteUrl, '_blank', 'noopener,noreferrer');
    }
    return true;
  },
};

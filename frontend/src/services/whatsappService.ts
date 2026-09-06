import { api } from './api';

export interface WhatsAppIntegration {
  id: number;
  gym_id: number;
  phone_number_id: string;
  waba_id?: string | null;
  business_id?: string | null;
  display_phone_number?: string | null;
  verified_name?: string | null;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  quality_rating?: 'GREEN' | 'YELLOW' | 'RED' | 'NA' | 'UNKNOWN' | null;
  is_active: boolean;
  connected_at?: string | null;
  last_error?: string | null;
  updated_at?: string | null;
}

export interface WhatsAppMetaConfig {
  app_id: string | null;
  config_id: string | null;
  api_version: string;
  is_configured: boolean;
}

export interface WhatsAppEmbeddedSignupRequest {
  code: string;
  phone_number_id?: string;
  waba_id?: string;
  business_id?: string;
}

export interface WhatsAppConnectRequest {
  phone_number_id: string;
  access_token: string;
  waba_id?: string;
  business_id?: string;
  display_phone_number?: string;
  verified_name?: string;
}

export interface WhatsAppTestMessageRequest {
  to_phone: string;
  message?: string;
}

export const whatsappService = {
  getIntegration: async (): Promise<WhatsAppIntegration | null> => {
    try {
      const { data } = await api.get<WhatsAppIntegration>('/whatsapp/integrations');
      return data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        return null;
      }
      throw err;
    }
  },

  getMetaConfig: async (): Promise<WhatsAppMetaConfig> => {
    const { data } = await api.get<WhatsAppMetaConfig>('/whatsapp/integrations/meta-config');
    return data;
  },

  connectEmbeddedSignup: async (payload: WhatsAppEmbeddedSignupRequest): Promise<WhatsAppIntegration> => {
    const { data } = await api.post<WhatsAppIntegration>('/whatsapp/integrations/embedded-signup', payload);
    return data;
  },

  connectManual: async (payload: WhatsAppConnectRequest): Promise<WhatsAppIntegration> => {
    const { data } = await api.post<WhatsAppIntegration>('/whatsapp/integrations/connect', payload);
    return data;
  },

  disconnect: async (): Promise<{ message: string }> => {
    const { data } = await api.post<{ message: string }>('/whatsapp/integrations/disconnect');
    return data;
  },

  sendTestMessage: async (payload: WhatsAppTestMessageRequest): Promise<{ status: string; result: any }> => {
    const { data } = await api.post<{ status: string; result: any }>('/whatsapp/integrations/test', payload);
    return data;
  },
};

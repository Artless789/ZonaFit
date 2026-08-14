import { api } from './api';
import type { Notification, NotificationSendRequest, NotificationTemplate, NotificationTemplateCreate, NotificationTemplateUpdate } from '../types/notification';
import type { PaginatedResponse } from '../types/pagination';

export const notificationService = {
  // Notifications History & Send
  getNotifications: async (params?: { status?: string; event_type?: string; client_id?: number }): Promise<PaginatedResponse<Notification>> => {
    const queryParams = new URLSearchParams();
    queryParams.set('limit', '100');
    if (params?.status) queryParams.set('status', params.status);
    if (params?.event_type) queryParams.set('event_type', params.event_type);
    if (params?.client_id) queryParams.set('client_id', String(params.client_id));
    const { data } = await api.get<PaginatedResponse<Notification>>(`/notifications/?${queryParams.toString()}`);
    return data;
  },

  sendNotification: async (requestData: NotificationSendRequest): Promise<Notification> => {
    const { data } = await api.post<Notification>('/notifications/send', requestData);
    return data;
  },

  getWhatsAppStatus: async (): Promise<{ configured: boolean; channel: string; message: string }> => {
    const { data } = await api.get('/notifications/whatsapp-status');
    return data;
  },

  // Templates — correct endpoint: /notification-templates/ (no s, separate router)
  getTemplates: async (): Promise<PaginatedResponse<NotificationTemplate>> => {
    const { data } = await api.get<PaginatedResponse<NotificationTemplate>>('/notification-templates/?limit=50');
    return data;
  },

  createTemplate: async (templateData: NotificationTemplateCreate): Promise<NotificationTemplate> => {
    const { data } = await api.post<NotificationTemplate>('/notification-templates/', templateData);
    return data;
  },

  updateTemplate: async (id: number, templateData: NotificationTemplateUpdate): Promise<NotificationTemplate> => {
    const { data } = await api.put<NotificationTemplate>(`/notification-templates/${id}`, templateData);
    return data;
  },
};

// Catalog of supported event types and channels (mirrors backend constants)
export const EVENT_TYPE_OPTIONS = [
  { value: 'MEMBERSHIP_EXPIRY', label: 'Vencimiento de Membresía' },
  { value: 'MEMBERSHIP_SOLD', label: 'Nueva Membresía' },
  { value: 'MEMBERSHIP_EXPIRED', label: 'Membresía Vencida' },
  { value: 'PAYMENT_RECEIVED', label: 'Pago Recibido' },
  { value: 'PAYMENT_OVERDUE', label: 'Aviso de Mora' },
  { value: 'CREDIT_CREATED', label: 'Nuevo Crédito' },
  { value: 'CREDIT_PAYMENT_RECEIVED', label: 'Abono a Crédito' },
  { value: 'CREDIT_OVERDUE', label: 'Crédito Vencido' },
  { value: 'WELCOME', label: 'Bienvenida al Gimnasio' },
  { value: 'GENERAL', label: 'Aviso General' },
];

export const CHANNEL_OPTIONS = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
];

export const TEMPLATE_VARIABLES = [
  '{{client_name}}',
  '{{gym_name}}',
  '{{membership_name}}',
  '{{expiry_date}}',
  '{{days_left}}',
  '{{amount}}',
  '{{payment_method}}',
  '{{balance_due}}',
  '{{invoice_number}}',
  '{{plan_name}}',
];

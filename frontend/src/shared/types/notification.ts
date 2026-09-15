export interface Notification {
  id: number;
  gym_id: number;
  client_id?: number | null;
  event_type: string;
  channel: string;
  recipient: string;
  message_body: string;
  status: string;
  error_detail?: string | null;
  sent_at?: string | null;
  created_at: string;
}

export interface NotificationSendRequest {
  client_id?: number | null;
  event_type: string;
  channel: string;
  recipient: string;
  message_body: string;
}

export interface NotificationTemplate {
  id: number;
  gym_id: number;
  event_type: string;
  custom_event_name?: string | null;
  description?: string | null;
  channel: string;
  template_body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationTemplateCreate {
  event_type: string;
  custom_event_name?: string | null;
  description?: string | null;
  channel: string;
  template_body: string;
}

export interface NotificationTemplateUpdate {
  template_body?: string;
  custom_event_name?: string | null;
  description?: string | null;
  is_active?: boolean;
}


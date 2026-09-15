export type CommunicationEventType =
  | 'MEMBERSHIP_EXPIRY'
  | 'MEMBERSHIP_EXPIRED'
  | 'CREDIT_OVERDUE'
  | 'PAYMENT_RECEIVED'
  | 'WELCOME'
  | 'GENERAL';

export interface CommunicationPrepareRequest {
  client_id: number;
  event_type: string;
  context_data?: Record<string, any>;
}

export interface CommunicationPrepareResponse {
  client_id: number;
  client_name: string;
  phone: string;
  event_type: string;
  rendered_message: string;
  channel: string;
}

export interface CommunicationRecordOpenedRequest {
  client_id: number;
  event_type: string;
  phone: string;
  message_body: string;
}

export interface CommunicationRecordOpenedResponse {
  success: boolean;
  notification_id: number;
}

export interface ClientBasicInfo {
  id: number;
  full_name: string;
  phone?: string | null;
}

export interface OpenCommunicationOptions {
  client: ClientBasicInfo;
  eventType: string;
  contextData?: Record<string, any>;
  eventLabel?: string;
  defaultMessage?: string;
}

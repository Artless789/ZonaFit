export interface WhatsAppGroup {
  id: number;
  gym_id: number;
  name: string;
  description: string | null;
  invite_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppGroupCreate {
  name: string;
  description?: string | null;
  invite_url: string;
  is_active?: boolean;
}

export interface WhatsAppGroupUpdate {
  name?: string;
  description?: string | null;
  invite_url?: string;
  is_active?: boolean;
}

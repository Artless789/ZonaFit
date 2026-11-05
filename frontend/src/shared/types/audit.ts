export interface AuditLog {
  id: number;
  gym_id: number;
  user_id?: number | null;
  user_name?: string | null;
  action: string;
  module?: string | null;
  entity_type: string;
  entity_id?: number | null;
  entity_name?: string | null;
  description?: string | null;
  status?: string | null;
  old_values?: Record<string, any> | null;
  new_values?: Record<string, any> | null;
  ip_address?: string | null;
  created_at: string;
}

export interface AuditLogFilterParams {
  page?: number;
  page_size?: number;
  limit?: number;
  skip?: number;
  action?: string;
  module?: string;
  entity_type?: string;
  user_id?: number;
  search?: string;
  start_date?: string;
  end_date?: string;
}

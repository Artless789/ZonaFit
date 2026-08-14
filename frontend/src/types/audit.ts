export interface AuditLog {
  id: number;
  gym_id: number;
  user_id?: number | null;
  action: string;
  entity_type: string;
  entity_id?: number | null;
  old_values?: any;
  new_values?: any;
  ip_address?: string | null;
  created_at: string;
}

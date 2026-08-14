export interface Membership {
  id: number;
  gym_id: number;
  client_id: number;
  membership_plan_id: number;
  start_date: string; // ISO datetime
  end_date: string;
  price: number;
  status: string; // e.g. ACTIVE, EXPIRED, CANCELLED
  is_active: boolean;
  trainer_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MembershipCreate {
  client_id: number;
  membership_plan_id: number;
  trainer_name?: string;
}

export interface MembershipUpdate {
  status?: string;
  is_active?: boolean;
  trainer_name?: string;
}

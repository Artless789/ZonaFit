export interface ClientMembershipSummary {
  id: number;
  full_name: string;
  document_type: string;
  document: string;
  phone: string;
  email?: string | null;
  photo_url?: string | null;
  notes?: string | null;
}

export interface PlanMembershipSummary {
  id: number;
  name: string;
  description?: string | null;
  duration_days: number;
  price: number;
}

export interface PaymentMembershipSummary {
  id: number;
  amount: number;
  payment_method: string;
  reference?: string | null;
  status: string;
  created_at: string;
}

export interface Membership {
  id: number;
  gym_id: number;
  client_id: number;
  membership_plan_id: number;
  start_date: string; // ISO datetime
  end_date: string;
  base_price?: number;
  discount?: number;
  price: number;
  status: string; // e.g. ACTIVE, EXPIRED, CANCELLED
  is_active: boolean;
  trainer_name?: string | null;
  client?: ClientMembershipSummary | null;
  client_name?: string | null;
  membership_plan?: PlanMembershipSummary | null;
  plan_name?: string | null;
  payments?: PaymentMembershipSummary[];
  total_paid?: number;
  pending_balance?: number;
  created_at: string;
  updated_at: string;
}

export interface MembershipCreate {
  client_id: number;
  membership_plan_id: number;
  trainer_name?: string;
  start_date?: string;
  discount?: number;
  register_payment?: boolean;
  payment_method?: string;
  amount_paid?: number;
  reference?: string;
}

export interface MembershipUpdate {
  status?: string;
  is_active?: boolean;
  trainer_name?: string;
}


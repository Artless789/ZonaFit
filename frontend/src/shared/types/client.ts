export interface ClientInitialMembership {
  membership_plan_id: number;
  trainer_name?: string;
  start_date?: string;
  discount?: number;
  register_payment?: boolean;
  payment_method?: string;
  amount_paid?: number;
  reference?: string;
}

export interface Client {
  id: number;
  gym_id: number;
  full_name: string;
  document_type: string;
  document: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
  photo_url?: string | null;
  is_active: boolean;
  initial_membership?: any;
  created_at: string;
  updated_at: string;
}

export interface ClientMembershipSummary {
  id: number;
  plan_name: string;
  status: string;
  start_date: string;
  end_date: string;
  days_left: number;
  trainer_name?: string | null;
}

export interface ClientFinancialSummary {
  last_payment_date?: string | null;
  last_payment_amount?: number | null;
  total_paid: number;
  pending_balance: number;
  overdue_balance: number;
  active_credits_count: number;
  last_purchase_date?: string | null;
}

export interface Client360Response {
  client: Client;
  current_membership?: ClientMembershipSummary | null;
  financial: ClientFinancialSummary;
}
export type ClientCreate = Omit<Client, 'id' | 'gym_id' | 'is_active' | 'created_at' | 'updated_at'> & {
  initial_membership?: ClientInitialMembership;
};
export type ClientUpdate = Partial<ClientCreate> & { is_active?: boolean };

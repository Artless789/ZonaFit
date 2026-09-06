export interface Payment {
  id: number;
  gym_id: number;
  membership_id: number | null;
  sale_id: number | null;
  accounts_receivable_id: number | null;
  amount: number;
  payment_method: string;
  reference: string | null;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

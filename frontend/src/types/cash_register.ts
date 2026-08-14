export interface CashRegister {
  id: number;
  gym_id: number;
  opened_by: number;
  closed_by: number | null;
  opened_at: string;
  closed_at: string | null;
  opening_balance: number;
  expected_balance: number | null;
  counted_balance: number | null;
  difference: number | null;
  status: string;
  closing_notes: string | null;
}

export interface CashMovement {
  id: number;
  gym_id: number;
  cash_register_id: number;
  payment_id: number | null;
  amount: number;
  type: string;
  category: string;
  description: string | null;
  created_by: number;
  created_at: string;
}

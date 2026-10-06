export interface PaymentMethodReconciliation {
  method: string;
  registered_amount: number;
  verified_amount: number;
  difference: number;
  status?: string; // "CUADRADO" | "SOBRANTE" | "FALTANTE"
}

export interface PaymentMethodSummaryItem {
  method: string;
  label: string;
  registered_amount: number;
}

export interface CashRegisterSummaryResponse {
  register_id: number;
  status: string;
  opened_at: string;
  opening_balance: number;
  cash_incomes: number;
  cash_outcomes: number;
  expected_cash: number;
  payment_methods: PaymentMethodSummaryItem[];
  total_registered_income: number;
  pre_shift_payments_today?: number;
}

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
  reconciliation_data?: string | null;
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

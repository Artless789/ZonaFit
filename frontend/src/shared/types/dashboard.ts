export interface DashboardActivity {
  id: string;
  type: 'SALE' | 'MEMBERSHIP' | 'CLIENT' | 'PAYMENT';
  title: string;
  subtitle: string;
  amount: number | null;
  created_at: string;
}

export interface DashboardExpiringMembership {
  id: number;
  client_id?: number;
  client_name: string;
  client_phone?: string | null;
  plan_name: string;
  end_date: string;
  days_left: number;
}

export interface DashboardReceivable {
  id: number;
  client_id?: number;
  client_name: string;
  client_phone?: string | null;
  balance_due: number;
  due_date: string | null;
  days_overdue: number;
}

export interface DashboardData {
  sales_today: number;
  sales_today_amount: number;
  income_this_month: number;
  active_clients: number;
  expiring_memberships_count: number;
  total_receivables: number;
  overdue_receivables: number;
  recent_activity: DashboardActivity[];
  expiring_memberships: DashboardExpiringMembership[];
  receivables: DashboardReceivable[];
}

export interface DailyIncome {
  date: string;
  day: number;
  amount: number;
  transaction_count: number;
}

export interface ConceptIncome {
  concept: 'MEMBERSHIP' | 'SALE' | 'RECEIVABLE';
  label: string;
  amount: number;
  percentage: number;
  transaction_count: number;
}

export interface MethodIncome {
  method: string;
  label: string;
  amount: number;
  percentage: number;
  transaction_count: number;
}

export interface RecentPaymentItem {
  id: number;
  amount: number;
  payment_method: string;
  payment_method_label: string;
  concept: 'MEMBERSHIP' | 'SALE' | 'RECEIVABLE';
  concept_description: string;
  client_name: string | null;
  created_at: string;
  day: number;
}

export interface IncomeDetailsResponse {
  month_name: string;
  month: number;
  year: number;
  total_income: number;
  total_transactions: number;
  average_ticket: number;
  highest_day: DailyIncome | null;
  by_concept: ConceptIncome[];
  by_method: MethodIncome[];
  daily_history: DailyIncome[];
  recent_payments: RecentPaymentItem[];
}


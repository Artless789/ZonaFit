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
  client_name: string;
  plan_name: string;
  end_date: string;
  days_left: number;
}

export interface DashboardReceivable {
  id: number;
  client_name: string;
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

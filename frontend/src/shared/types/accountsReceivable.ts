export interface ClientAccountsReceivableSummary {
  id: number;
  full_name: string;
  document_type: string;
  document: string;
  phone: string;
  email?: string | null;
  photo_url?: string | null;
}

export interface AccountsReceivable {
  id: number;
  gym_id: number;
  client_id: number;
  sale_id: number;
  
  original_amount: number;
  paid_amount: number;
  balance_due: number;
  
  due_date: string;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  
  is_active: boolean;
  created_at: string;
  updated_at: string;

  client?: ClientAccountsReceivableSummary | null;
  client_name?: string | null;
}

export interface PaymentRequest {
  amount: number;
  payment_method: string;
}

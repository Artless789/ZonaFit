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
  
  // These relationships might be included depending on backend response,
  // but if not present, we will query client directly or rely on client list.
  // Actually, wait, does the backend include `client` and `sale` in the response?
  // Our schema AccountsReceivableResponse inherits AccountsReceivableInDBBase.
  // It does NOT include them right now unless we added them in AccountsReceivableResponse.
  // Let's not require them for now, we'll map them manually.
}

export interface PaymentRequest {
  amount: number;
  payment_method: string;
}

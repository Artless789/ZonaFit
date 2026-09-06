export interface Sale {
  id: number;
  gym_id: number;
  client_id: number | null;
  total: number;
  status: string;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SaleCreate {
  client_id?: number | null;
  notes?: string | null;
}

export interface SaleUpdate {
  notes?: string | null;
  status?: string | null;
  is_active?: boolean;
}

export interface SaleDetail {
  id: number;
  sale_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

export interface SaleDetailCreate {
  sale_id: number;
  product_id: number;
  quantity: number;
}

export interface SaleCompleteRequest {
  sale_type: 'CASH' | 'CREDIT';
  payment_method?: string | null;
  due_date?: string | null;
  initial_payment?: number;
}

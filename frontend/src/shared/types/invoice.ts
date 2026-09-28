export interface InvoiceDetail {
  id: number;
  invoice_id: number;
  product_id: number;
  product_name?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

export interface Invoice {
  id: number;
  gym_id: number;
  sale_id: number;
  client_id?: number | null;
  client_name?: string | null;
  client_document?: string | null;
  client_phone?: string | null;
  payment_method?: string;
  invoice_number: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: 'DRAFT' | 'ISSUED' | 'CANCELLED';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvoiceCreate {
  sale_id: number;
}

export interface LowStockProduct {
  product_id: number;
  product_name: string;
  stock: number;
  min_stock: number;
}

export interface MembershipExpiring {
  membership_id: number;
  client_id: number;
  client_name: string;
  end_date: string;
  days_remaining: number;
}

export interface SalesReport {
  total_sales: number;
  total_income: number;
}

export interface SalesByDateReport {
  start_date: string;
  end_date: string;
  total_sales: number;
  total_income: number;
}

export interface SalesByClient {
  client_id: number;
  client_name: string;
  total_sales: number;
  total_amount: number;
}

export interface TopProduct {
  product_id: number;
  product_name: string;
  total_quantity: number;
  total_amount: number;
}

export interface PaymentMethodReport {
  payment_method: string;
  total_payments: number;
  total_amount: number;
}

export interface Product {
  id: number;
  gym_id: number;
  category_id: number;
  name: string;
  description?: string | null;
  sku: string;
  purchase_price: number;
  sale_price: number;
  stock: number;
  minimum_stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ProductCreate = Omit<Product, 'id' | 'gym_id' | 'is_active' | 'created_at' | 'updated_at'>;
export type ProductUpdate = Partial<ProductCreate> & { is_active?: boolean };

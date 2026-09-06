import { api } from './api';
import type { Product, ProductCreate, ProductUpdate } from '@shared/types/product';
import type { Paginated } from './membershipPlanService';

export const productService = {
  getProducts: async (): Promise<Paginated<Product>> => {
    const { data } = await api.get<Paginated<Product>>('/products/?limit=500');
    return data;
  },

  getProduct: async (id: number): Promise<Product> => {
    const { data } = await api.get<Product>(`/products/${id}`);
    return data;
  },

  createProduct: async (productData: ProductCreate): Promise<Product> => {
    const { data } = await api.post<Product>('/products/', productData);
    return data;
  },

  updateProduct: async (id: number, productData: ProductUpdate): Promise<Product> => {
    const { data } = await api.put<Product>(`/products/${id}`, productData);
    return data;
  },

  deleteProduct: async (id: number): Promise<void> => {
    await api.delete(`/products/${id}`);
  },
};

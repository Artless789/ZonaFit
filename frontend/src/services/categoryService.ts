import { api } from './api';
import type { Category, CategoryCreate, CategoryUpdate } from '@shared/types/category';
import type { Paginated } from './membershipPlanService';

export const categoryService = {
  getCategories: async (): Promise<Paginated<Category>> => {
    const { data } = await api.get<Paginated<Category>>('/categories/?limit=100');
    return data;
  },

  getCategory: async (id: number): Promise<Category> => {
    const { data } = await api.get<Category>(`/categories/${id}`);
    return data;
  },

  createCategory: async (categoryData: CategoryCreate): Promise<Category> => {
    const { data } = await api.post<Category>('/categories/', categoryData);
    return data;
  },

  updateCategory: async (id: number, categoryData: CategoryUpdate): Promise<Category> => {
    const { data } = await api.put<Category>(`/categories/${id}`, categoryData);
    return data;
  },

  deleteCategory: async (id: number): Promise<void> => {
    await api.delete(`/categories/${id}`);
  },
};

export interface Category {
  id: number;
  gym_id: number;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CategoryCreate = Omit<Category, 'id' | 'gym_id' | 'is_active' | 'created_at' | 'updated_at'>;
export type CategoryUpdate = Partial<CategoryCreate> & { is_active?: boolean };

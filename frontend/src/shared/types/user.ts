export interface User {
  id: number;
  gym_id?: number | null;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  permissions?: Record<string, boolean> | null;
}

export interface UserCreate {
  full_name: string;
  email: string;
  password?: string;
  role: string;
  permissions?: Record<string, boolean> | null;
}

export interface UserUpdate {
  full_name?: string;
  email?: string;
  role?: string;
  is_active?: boolean;
  permissions?: Record<string, boolean> | null;
}

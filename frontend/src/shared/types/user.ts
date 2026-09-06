export interface User {
  id: number;
  gym_id?: number | null;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

export interface UserCreate {
  full_name: string;
  email: string;
  password?: string;
  role: string;
}

export interface UserUpdate {
  full_name?: string;
  email?: string;
  role?: string;
  is_active?: boolean;
}

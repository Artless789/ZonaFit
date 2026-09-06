export interface MembershipPlan {
  id: number;
  gym_id: number;
  name: string;
  description?: string | null;
  duration_days: number;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type MembershipPlanCreate = Omit<MembershipPlan, 'id' | 'gym_id' | 'is_active' | 'created_at' | 'updated_at'>;
export type MembershipPlanUpdate = Partial<MembershipPlanCreate> & { is_active?: boolean };

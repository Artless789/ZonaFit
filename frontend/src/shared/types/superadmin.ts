export interface SuperadminGym {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  onboarding_completed: boolean;
  owner_name: string | null;
  owner_email: string | null;
  current_plan_name: string | null;
  subscription_status: string | null;
  subscription_starts_at: string | null;
  subscription_ends_at: string | null;
  created_at: string | null;
}

export interface SuperadminUser {
  id: number;
  gym_id: number | null;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

export interface SuperadminAuditLog {
  id: number;
  gym_id: number;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  created_at: string;
  ip_address: string | null;
}

export interface SuperadminDashboardMetrics {
  total_gyms: number;
  active_gyms: number;
  inactive_gyms: number;
  pending_onboarding_gyms: number;
  total_users: number;
  total_superadmins: number;
  active_subscriptions: number;
  trial_subscriptions: number;
  expired_subscriptions: number;
  active_plans: number;
  total_revenue: number;
}

export interface SuperadminPlan {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  currency: string;
  billing_interval: 'MONTHLY' | 'YEARLY';
  is_active: boolean;
  created_at: string;
}

export interface SuperadminSubscription {
  id: number;
  gym_id: number;
  plan_id: number;
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
  starts_at: string;
  ends_at: string | null;
  is_lifetime: boolean;
  created_at: string;
  plan?: SuperadminPlan;
}

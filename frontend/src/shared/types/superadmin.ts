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

export interface GymDetailUser {
  id: number;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

export interface SuperadminPaymentItem {
  id: number;
  reference: string;
  amount_in_cents: number;
  currency: string;
  status: string;
  provider_transaction_id: string | null;
  refund_reason: string | null;
  refunded_at: string | null;
  created_at: string;
}

export interface SuperadminRefundRequest {
  reason: string;
  revoke_access_immediately?: boolean;
}

export interface SuperadminRefundResponse {
  success: boolean;
  message: string;
  status: string;
}

export interface SuperadminGymDetail {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  onboarding_completed: boolean;
  owner_id: number | null;
  owner_name: string | null;
  owner_email: string | null;
  subscription_id: number | null;
  current_plan_id: number | null;
  current_plan_name: string | null;
  subscription_status: string | null;
  subscription_starts_at: string | null;
  subscription_ends_at: string | null;
  is_lifetime: boolean;
  total_users: number;
  total_clients: number;
  users: GymDetailUser[];
  payments?: SuperadminPaymentItem[];
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

export type BillingIntervalType = 'MONTHLY' | 'BIMONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY';

export interface SuperadminPlan {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  currency: string;
  billing_interval: BillingIntervalType;
  is_active: boolean;
  is_popular?: boolean;
  features?: string[];
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

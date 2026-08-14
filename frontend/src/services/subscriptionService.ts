import { api } from './api';

export interface SubscriptionInfo {
  id: number;
  gym_id: number;
  plan_id: number;
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
  starts_at: string;
  ends_at: string | null;
  is_lifetime: boolean;
  created_at: string;
  plan?: {
    id: number;
    name: string;
    slug: string;
    price: number;
    currency: string;
    billing_interval: 'MONTHLY' | 'YEARLY';
  };
  cancellation_requested_at?: string | null;
  payment_source_id?: string | null;
  payment_method_last4?: string | null;
}

export interface PaymentHistory {
  id: number;
  reference: string;
  amount_in_cents: number;
  currency: string;
  status: string;
  created_at: string;
  provider_transaction_id: string | null;
}

export interface PlanInfo {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  currency: string;
  billing_interval: 'MONTHLY' | 'YEARLY';
  is_active: boolean;
}

export interface PaymentInitResponse {
  reference: string;
  amount_in_cents: number;
  currency: string;
  signature: string;
  public_key: string;
}

export const subscriptionService = {
  getMySubscription: async (): Promise<SubscriptionInfo | null> => {
    try {
      const { data } = await api.get<SubscriptionInfo>('/subscription/me');
      return data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },
  
  getPlans: async (): Promise<PlanInfo[]> => {
    const { data } = await api.get<PlanInfo[]>('/subscription/plans');
    return data;
  },
  
  startSubscription: async ({ intent }: { intent: 'TRIAL' | 'PURCHASE' }): Promise<SubscriptionInfo> => {
    const { data } = await api.post<SubscriptionInfo>('/subscription/start', { intent });
    return data;
  },
  
  initPayment: async ({ subscriptionId, planId }: { subscriptionId: number, planId: number }): Promise<PaymentInitResponse> => {
    const { data } = await api.post<PaymentInitResponse>(`/subscription/${subscriptionId}/payment`, { plan_id: planId });
    return data;
  },

  verifyPayment: async ({ subscriptionId, transactionId }: { subscriptionId: number, transactionId: string }): Promise<{ status: string }> => {
    const { data } = await api.post<{ status: string }>(`/subscription/${subscriptionId}/payment/verify`, { transaction_id: transactionId });
    return data;
  },

  getHistory: async (): Promise<PaymentHistory[]> => {
    const { data } = await api.get<PaymentHistory[]>('/subscription/history');
    return data;
  },

  cancelSubscription: async (): Promise<{ message: string }> => {
    const { data } = await api.post<{ message: string }>('/subscription/cancel');
    return data;
  },

  reactivateSubscription: async (): Promise<{ message: string }> => {
    const { data } = await api.post<{ message: string }>('/subscription/reactivate');
    return data;
  }
};

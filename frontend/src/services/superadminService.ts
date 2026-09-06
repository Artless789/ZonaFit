import { api } from './api';
import { 
  SuperadminDashboardMetrics, 
  SuperadminGym, 
  SuperadminGymDetail, 
  SuperadminUser, 
  SuperadminAuditLog, 
  SuperadminPlan, 
  SuperadminSubscription,
  SuperadminRefundRequest,
  SuperadminRefundResponse
} from '@shared/types/superadmin';
import { PaginationResponse } from '@shared/types/pagination';

export const superadminService = {
  getDashboardMetrics: async (): Promise<SuperadminDashboardMetrics> => {
    const { data } = await api.get<SuperadminDashboardMetrics>('/superadmin/dashboard');
    return data;
  },

  getGyms: async (page = 1, pageSize = 20, search?: string): Promise<PaginationResponse<SuperadminGym>> => {
    const { data } = await api.get<PaginationResponse<SuperadminGym>>('/superadmin/gyms', {
      params: { 
        page, 
        page_size: pageSize,
        ...(search && search.trim() ? { search: search.trim() } : {})
      },
    });
    return data;
  },

  getGymDetail: async (gymId: number): Promise<SuperadminGymDetail> => {
    const { data } = await api.get<SuperadminGymDetail>(`/superadmin/gyms/${gymId}`);
    return data;
  },

  getUsers: async (page = 1, pageSize = 20): Promise<PaginationResponse<SuperadminUser>> => {
    const { data } = await api.get<PaginationResponse<SuperadminUser>>('/superadmin/users', {
      params: { page, page_size: pageSize },
    });
    return data;
  },

  getAudit: async (page = 1, pageSize = 20): Promise<PaginationResponse<SuperadminAuditLog>> => {
    const { data } = await api.get<PaginationResponse<SuperadminAuditLog>>('/superadmin/audit', {
      params: { page, page_size: pageSize },
    });
    return data;
  },

  getPlans: async (page = 1, pageSize = 20): Promise<PaginationResponse<SuperadminPlan>> => {
    const { data } = await api.get<PaginationResponse<SuperadminPlan>>('/superadmin/plans', {
      params: { page, page_size: pageSize },
    });
    return data;
  },

  getSubscriptions: async (page = 1, pageSize = 20): Promise<PaginationResponse<SuperadminSubscription>> => {
    const { data } = await api.get<PaginationResponse<SuperadminSubscription>>('/superadmin/subscriptions', {
      params: { page, page_size: pageSize },
    });
    return data;
  },

  createPlan: async (planData: Partial<SuperadminPlan>): Promise<SuperadminPlan> => {
    const { data } = await api.post<SuperadminPlan>('/superadmin/plans', planData);
    return data;
  },

  updatePlan: async (planId: number, planData: Partial<SuperadminPlan>): Promise<SuperadminPlan> => {
    const { data } = await api.put<SuperadminPlan>(`/superadmin/plans/${planId}`, planData);
    return data;
  },

  assignSubscription: async (gymId: number, subscriptionData: Partial<SuperadminSubscription>): Promise<SuperadminSubscription> => {
    const { data } = await api.post<SuperadminSubscription>(`/superadmin/gyms/${gymId}/subscription`, subscriptionData);
    return data;
  },

  refundPayment: async (
    gymId: number, 
    paymentId: number, 
    payload: SuperadminRefundRequest
  ): Promise<SuperadminRefundResponse> => {
    const { data } = await api.post<SuperadminRefundResponse>(
      `/superadmin/gyms/${gymId}/subscription/payments/${paymentId}/refund`,
      payload
    );
    return data;
  }
};

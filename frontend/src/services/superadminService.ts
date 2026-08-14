import { api } from './api';
import { SuperadminDashboardMetrics, SuperadminGym, SuperadminUser, SuperadminAuditLog, SuperadminPlan, SuperadminSubscription } from '../types/superadmin';
import { PaginationResponse } from '../types/pagination';

export const superadminService = {
  getDashboardMetrics: async (): Promise<SuperadminDashboardMetrics> => {
    const { data } = await api.get<SuperadminDashboardMetrics>('/superadmin/dashboard');
    return data;
  },

  getGyms: async (page = 1, pageSize = 20): Promise<PaginationResponse<SuperadminGym>> => {
    const { data } = await api.get<PaginationResponse<SuperadminGym>>('/superadmin/gyms', {
      params: { page, page_size: pageSize },
    });
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
  }
};

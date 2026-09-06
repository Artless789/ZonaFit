import { api } from './api';
import type { MembershipPlan, MembershipPlanCreate, MembershipPlanUpdate } from '@shared/types/membershipPlan';


// Define PaginationResponse in a shared file or here for now
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export const membershipPlanService = {
  getPlans: async (): Promise<Paginated<MembershipPlan>> => {
    // For now, we fetch a large limit to avoid implementing full pagination UI in this iteration
    const { data } = await api.get<Paginated<MembershipPlan>>('/membership-plans/?limit=100');
    return data;
  },

  getPlan: async (id: number): Promise<MembershipPlan> => {
    const { data } = await api.get<MembershipPlan>(`/membership-plans/${id}`);
    return data;
  },

  createPlan: async (planData: MembershipPlanCreate): Promise<MembershipPlan> => {
    const { data } = await api.post<MembershipPlan>('/membership-plans/', planData);
    return data;
  },

  updatePlan: async (id: number, planData: MembershipPlanUpdate): Promise<MembershipPlan> => {
    const { data } = await api.put<MembershipPlan>(`/membership-plans/${id}`, planData);
    return data;
  },

  deletePlan: async (id: number): Promise<void> => {
    await api.delete(`/membership-plans/${id}`);
  },
};

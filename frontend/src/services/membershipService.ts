import { api } from './api';
import type { Membership, MembershipCreate, MembershipUpdate } from '@shared/types/membership';
import type { Paginated } from './membershipPlanService';

export const membershipService = {
  getMemberships: async (params?: { skip?: number; limit?: number }): Promise<Paginated<Membership>> => {
    const limit = params?.limit ?? 500;
    const skip = params?.skip ?? 0;
    const { data } = await api.get<Paginated<Membership>>(`/memberships/?skip=${skip}&limit=${limit}`);
    return data;
  },

  getMembership: async (id: number): Promise<Membership> => {
    const { data } = await api.get<Membership>(`/memberships/${id}`);
    return data;
  },

  createMembership: async (membershipData: MembershipCreate): Promise<Membership> => {
    const { data } = await api.post<Membership>('/memberships/', membershipData);
    return data;
  },

  updateMembership: async (id: number, membershipData: MembershipUpdate): Promise<Membership> => {
    const { data } = await api.put<Membership>(`/memberships/${id}`, membershipData);
    return data;
  },

  deleteMembership: async (id: number): Promise<void> => {
    await api.delete(`/memberships/${id}`);
  },
};

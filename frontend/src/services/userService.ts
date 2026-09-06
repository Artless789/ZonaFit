import { api } from './api';
import type { User, UserCreate, UserUpdate } from '@shared/types/user';
import type { PaginatedResponse } from '@shared/types/pagination';

export const userService = {
  getUsers: async (
    limit = 10,
    skip = 0,
    search?: string,
    status?: string,
    sortBy?: string,
    sortDesc?: boolean
  ): Promise<PaginatedResponse<User>> => {
    let url = `/users/?limit=${limit}&skip=${skip}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;
    if (sortBy) url += `&sort_by=${encodeURIComponent(sortBy)}`;
    if (sortDesc !== undefined) url += `&sort_desc=${sortDesc}`;

    const { data } = await api.get<PaginatedResponse<User>>(url);
    return data;
  },

  getUser: async (id: number): Promise<User> => {
    const { data } = await api.get<User>(`/users/${id}`);
    return data;
  },

  createUser: async (user: UserCreate): Promise<User> => {
    const { data } = await api.post<User>('/users/', user);
    return data;
  },

  updateUser: async (id: number, user: UserUpdate): Promise<User> => {
    const { data } = await api.put<User>(`/users/${id}`, user);
    return data;
  },

  deactivateUser: async (id: number): Promise<User> => {
    const { data } = await api.put<User>(`/users/${id}`, { is_active: false });
    return data;
  },

  activateUser: async (id: number): Promise<User> => {
    const { data } = await api.put<User>(`/users/${id}`, { is_active: true });
    return data;
  },
};

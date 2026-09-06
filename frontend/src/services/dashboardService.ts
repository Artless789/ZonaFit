import { api } from './api';
import type { DashboardData, IncomeDetailsResponse } from '@shared/types/dashboard';

export const dashboardService = {
  async getDashboard(): Promise<DashboardData> {
    const res = await api.get<DashboardData>('/dashboard/');
    return res.data;
  },

  async getIncomeDetails(month?: number, year?: number): Promise<IncomeDetailsResponse> {
    const params = new URLSearchParams();
    if (month) params.append('month', month.toString());
    if (year) params.append('year', year.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await api.get<IncomeDetailsResponse>(`/dashboard/income-details${query}`);
    return res.data;
  },
};


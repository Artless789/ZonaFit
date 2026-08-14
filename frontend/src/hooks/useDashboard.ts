import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboardService';
import type { DashboardData } from '../types/dashboard';

export function useDashboard() {
  return useQuery<DashboardData, Error>({
    queryKey: ['dashboard'],
    queryFn: dashboardService.getDashboard,
  });
}

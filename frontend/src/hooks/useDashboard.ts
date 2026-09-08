import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboardService';
import type { DashboardData } from '@shared/types/dashboard';

export function useDashboard() {
  return useQuery<DashboardData, Error>({
    queryKey: ['dashboard'],
    queryFn: dashboardService.getDashboard,
    refetchOnWindowFocus: true,
    staleTime: 1000 * 60 * 2,
  });
}

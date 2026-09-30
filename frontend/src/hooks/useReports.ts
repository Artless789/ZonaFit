import { useQuery } from '@tanstack/react-query';
import { reportService } from '../services/reportService';

export const useReports = (startDate?: string, endDate?: string, expiringDays: number = 7) => {
  const salesSummary = useQuery({
    queryKey: ['reports', 'sales'],
    queryFn: reportService.getSalesReport,
    staleTime: 1000 * 60 * 3,
  });

  const salesByDate = useQuery({
    queryKey: ['reports', 'sales-by-date', startDate, endDate],
    queryFn: () => (startDate && endDate ? reportService.getSalesByDate(startDate, endDate) : null),
    enabled: !!startDate && !!endDate,
    staleTime: 1000 * 60 * 3,
  });

  const salesByClient = useQuery({
    queryKey: ['reports', 'sales-by-client'],
    queryFn: reportService.getSalesByClient,
    staleTime: 1000 * 60 * 3,
  });

  const topProducts = useQuery({
    queryKey: ['reports', 'top-products'],
    queryFn: reportService.getTopProducts,
    staleTime: 1000 * 60 * 3,
  });

  const lowStock = useQuery({
    queryKey: ['reports', 'low-stock'],
    queryFn: reportService.getLowStock,
    staleTime: 1000 * 60 * 3,
  });

  const paymentsByMethod = useQuery({
    queryKey: ['reports', 'payments-by-method'],
    queryFn: reportService.getPaymentsByMethod,
    staleTime: 1000 * 60 * 3,
  });

  const membershipsExpiring = useQuery({
    queryKey: ['reports', 'memberships-expiring', expiringDays],
    queryFn: () => reportService.getMembershipsExpiring(expiringDays),
    staleTime: 1000 * 60 * 3,
  });

  return {
    salesSummary,
    salesByDate,
    salesByClient,
    topProducts,
    lowStock,
    paymentsByMethod,
    membershipsExpiring,
  };
};

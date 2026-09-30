import { api } from './api';
import type {
  LowStockProduct,
  MembershipExpiring,
  PaymentMethodReport,
  SalesByClient,
  SalesByDateReport,
  SalesReport,
  TopProduct,
} from '@shared/types/report';

export const reportService = {
  async getLowStock(): Promise<LowStockProduct[]> {
    const res = await api.get<LowStockProduct[]>('/reports/low-stock');
    return res.data;
  },

  async getMembershipsExpiring(days: number = 7): Promise<MembershipExpiring[]> {
    const res = await api.get<MembershipExpiring[]>(`/reports/memberships-expiring?days=${days}`);
    return res.data;
  },

  async getSalesReport(): Promise<SalesReport> {
    const res = await api.get<SalesReport>('/reports/sales');
    return res.data;
  },

  async getSalesByDate(startDate: string, endDate: string): Promise<SalesByDateReport> {
    const res = await api.get<SalesByDateReport>('/reports/sales-by-date', {
      params: {
        start_date: startDate,
        end_date: endDate,
      },
    });
    return res.data;
  },

  async getSalesByClient(): Promise<SalesByClient[]> {
    const res = await api.get<SalesByClient[]>('/reports/sales-by-client');
    return res.data;
  },

  async getTopProducts(): Promise<TopProduct[]> {
    const res = await api.get<TopProduct[]>('/reports/top-products');
    return res.data;
  },

  async getPaymentsByMethod(): Promise<PaymentMethodReport[]> {
    const res = await api.get<PaymentMethodReport[]>('/reports/payments-by-method');
    return res.data;
  },
};

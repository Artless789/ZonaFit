import { api } from './api';
import type { Sale, SaleCreate, SaleUpdate, SaleDetail, SaleDetailCreate } from '@shared/types/sale';
import type { Paginated } from './membershipPlanService';

export const saleService = {
  getSales: async (): Promise<Paginated<Sale>> => {
    const { data } = await api.get<Paginated<Sale>>('/sales/?limit=500');
    return data;
  },

  getSale: async (id: number): Promise<Sale> => {
    const { data } = await api.get<Sale>(`/sales/${id}`);
    return data;
  },

  createSale: async (saleData: SaleCreate): Promise<Sale> => {
    const { data } = await api.post<Sale>('/sales/', saleData);
    return data;
  },

  updateSale: async (id: number, saleData: SaleUpdate): Promise<Sale> => {
    const { data } = await api.put<Sale>(`/sales/${id}`, saleData);
    return data;
  },

  deleteSale: async (id: number): Promise<void> => {
    await api.delete(`/sales/${id}`);
  },

  // Sale Details Operations (Since they are closely tied)
  getSaleDetails: async (saleId: number): Promise<Paginated<SaleDetail>> => {
    // Assuming backend filter by sale_id is supported, or we just rely on standard limits for now
    const { data } = await api.get<Paginated<SaleDetail>>(`/sale-details/?sale_id=${saleId}&limit=100`);
    return data;
  },

  createSaleDetail: async (detailData: SaleDetailCreate): Promise<SaleDetail> => {
    const { data } = await api.post<SaleDetail>('/sale-details/', detailData);
    return data;
  },
};

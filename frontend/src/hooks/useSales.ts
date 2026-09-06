import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { saleService } from '../services/saleService';
import { SaleCreate, SaleUpdate, Sale, SaleDetailCreate, SaleDetail } from '@shared/types/sale';
import { Paginated } from '../services/membershipPlanService';

export const useSales = () => {
  const queryClient = useQueryClient();
  const queryKey = ['sales'];
  // Assuming a separate key for products so we can invalidate stock when a sale happens
  const productsQueryKey = ['products']; 

  const query = useQuery<Paginated<Sale>, Error>({
    queryKey,
    queryFn: saleService.getSales,
  });

  const createMutation = useMutation<Sale, Error, SaleCreate>({
    mutationFn: saleService.createSale,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateMutation = useMutation<Sale, Error, { id: number; data: SaleUpdate }>({
    mutationFn: ({ id, data }) => saleService.updateSale(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation<void, Error, number>({
    mutationFn: saleService.deleteSale,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const createDetailMutation = useMutation<SaleDetail, Error, SaleDetailCreate>({
    mutationFn: saleService.createSaleDetail,
    onSuccess: () => {
      // Need to invalidate products to reflect new stock
      queryClient.invalidateQueries({ queryKey: productsQueryKey });
    },
  });

  return {
    query,
    createMutation,
    updateMutation,
    deleteMutation,
    createDetailMutation,
  };
};

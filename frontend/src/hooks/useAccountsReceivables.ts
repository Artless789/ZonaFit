import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountsReceivableService } from '../services/accountsReceivableService';
import type { PaymentRequest } from '@shared/types/accountsReceivable';

export const ACCOUNTS_RECEIVABLES_KEYS = {
  all: ['accounts_receivables'] as const,
  list: (params: any) => [...ACCOUNTS_RECEIVABLES_KEYS.all, 'list', params] as const,
  detail: (id: number) => [...ACCOUNTS_RECEIVABLES_KEYS.all, 'detail', id] as const,
  payments: (id: number) => [...ACCOUNTS_RECEIVABLES_KEYS.all, 'payments', id] as const,
};

export function useAccountsReceivables(params?: { page?: number; limit?: number; status?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ACCOUNTS_RECEIVABLES_KEYS.list(params),
    queryFn: () => accountsReceivableService.getAll(params),
    placeholderData: (previousData) => previousData, // keep previous data while fetching new page
  });

  const registerPaymentMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: PaymentRequest }) => 
      accountsReceivableService.registerPayment(id, data),
    onSuccess: (data, variables) => {
      // Invalidate specific lists and details
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_RECEIVABLES_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ['cash-registers'] });
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
      queryClient.setQueryData(ACCOUNTS_RECEIVABLES_KEYS.detail(variables.id), data);
    },
  });

  return {
    query,
    registerPaymentMutation,
  };
}

export function useAccountsReceivableDetail(id: number) {
  return useQuery({
    queryKey: ACCOUNTS_RECEIVABLES_KEYS.detail(id),
    queryFn: () => accountsReceivableService.getById(id),
    enabled: !!id,
  });
}

export function useAccountsReceivablePayments(id: number) {
  return useQuery({
    queryKey: ACCOUNTS_RECEIVABLES_KEYS.payments(id),
    queryFn: () => accountsReceivableService.getPayments(id),
    enabled: !!id,
  });
}

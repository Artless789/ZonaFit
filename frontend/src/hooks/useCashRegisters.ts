import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cashRegisterService } from '../services/cashRegisterService';
import type { PaymentMethodReconciliation } from '@shared/types/cash_register';

export const useCashRegisters = () => {
  const queryClient = useQueryClient();

  const activeRegister = useQuery({
    queryKey: ['cash-registers', 'active'],
    queryFn: cashRegisterService.getActive,
  });

  const activeSummary = useQuery({
    queryKey: ['cash-registers', 'active', 'summary'],
    queryFn: cashRegisterService.getActiveSummary,
    enabled: !!activeRegister.data?.id,
  });

  const allRegisters = useQuery({
    queryKey: ['cash-registers'],
    queryFn: cashRegisterService.getAll,
  });

  const openRegister = useMutation({
    mutationFn: cashRegisterService.open,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-registers'] });
      queryClient.invalidateQueries({ queryKey: ['cash_registers'] });
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['cash_movements'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const closeRegister = useMutation({
    mutationFn: (params: {
      registerId: number;
      data: {
        counted_balance: number;
        closing_notes?: string;
        reconciliations?: PaymentMethodReconciliation[];
      };
    }) => cashRegisterService.close(params.registerId, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-registers'] });
      queryClient.invalidateQueries({ queryKey: ['cash_registers'] });
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['cash_movements'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const createMovement = useMutation({
    mutationFn: cashRegisterService.createMovement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-registers'] });
      queryClient.invalidateQueries({ queryKey: ['cash_registers'] });
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['cash_movements'] });
    },
  });

  return {
    activeRegister,
    activeSummary,
    allRegisters,
    openRegister,
    closeRegister,
    createMovement,
  };
};

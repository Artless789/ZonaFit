import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cashRegisterService } from '../services/cashRegisterService';

export const useCashRegisters = () => {
  const queryClient = useQueryClient();

  const activeRegister = useQuery({
    queryKey: ['cash-registers', 'active'],
    queryFn: cashRegisterService.getActive,
  });

  const allRegisters = useQuery({
    queryKey: ['cash-registers'],
    queryFn: cashRegisterService.getAll,
  });

  const openRegister = useMutation({
    mutationFn: cashRegisterService.open,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-registers'] });
    },
  });

  const closeRegister = useMutation({
    mutationFn: (params: { registerId: number; data: { counted_balance: number; closing_notes?: string } }) => 
      cashRegisterService.close(params.registerId, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-registers'] });
    },
  });

  const createMovement = useMutation({
    mutationFn: cashRegisterService.createMovement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-registers'] });
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
    },
  });

  return {
    activeRegister,
    allRegisters,
    openRegister,
    closeRegister,
    createMovement
  };
};

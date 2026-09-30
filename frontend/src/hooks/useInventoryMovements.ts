import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryMovementService } from '../services/inventoryMovementService';
import type { 
  InventoryMovement, 
  InventoryMovementCreate, 
  InventoryMovementPaginationResponse 
} from '@shared/types/inventory_movement';

export const INVENTORY_MOVEMENTS_KEY = ['inventory-movements'] as const;

export const useInventoryMovements = (params?: { 
  page?: number; 
  limit?: number; 
  product_id?: number;
  movement_type?: string;
}) => {
  const queryClient = useQueryClient();

  const query = useQuery<InventoryMovementPaginationResponse, Error>({
    queryKey: [...INVENTORY_MOVEMENTS_KEY, params],
    queryFn: () => inventoryMovementService.getAll(params),
  });

  const createMutation = useMutation<InventoryMovement, Error, InventoryMovementCreate>({
    mutationFn: inventoryMovementService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVENTORY_MOVEMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return {
    query,
    createMutation,
  };
};

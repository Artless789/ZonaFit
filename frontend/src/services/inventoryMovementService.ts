import { api } from './api';
import type { 
  InventoryMovement, 
  InventoryMovementCreate, 
  InventoryMovementPaginationResponse 
} from '@shared/types/inventory_movement';

export const inventoryMovementService = {
  create: async (data: InventoryMovementCreate): Promise<InventoryMovement> => {
    const response = await api.post<InventoryMovement>('/inventory-movements/', data);
    return response.data;
  },

  getAll: async (params?: { 
    page?: number; 
    limit?: number; 
    product_id?: number;
    movement_type?: string;
  }): Promise<InventoryMovementPaginationResponse> => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.product_id) query.append('product_id', params.product_id.toString());
    if (params?.movement_type) query.append('movement_type', params.movement_type);
    
    // Sort descending by created_at by default
    query.append('sort_by', 'created_at');
    query.append('order', 'desc');

    const queryString = query.toString();
    const endpoint = `/inventory-movements/${queryString ? `?${queryString}` : ''}`;
    const response = await api.get<InventoryMovementPaginationResponse>(endpoint);
    return response.data;
  },

  getById: async (id: number): Promise<InventoryMovement> => {
    const response = await api.get<InventoryMovement>(`/inventory-movements/${id}`);
    return response.data;
  },
};

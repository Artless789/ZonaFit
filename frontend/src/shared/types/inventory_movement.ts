export type InventoryMovementType = 'IN' | 'OUT' | 'ADJUSTMENT';

export interface InventoryMovement {
  id: number;
  gym_id: number;
  product_id: number;
  movement_type: InventoryMovementType;
  quantity: number;
  stock_before: number;
  stock_after: number;
  reason: string | null;
  created_at: string;
}

export interface InventoryMovementCreate {
  product_id: number;
  movement_type: InventoryMovementType;
  quantity: number;
  reason?: string | null;
}

export interface InventoryMovementPaginationResponse {
  items: InventoryMovement[];
  total_items: number;
  total_pages: number;
  page: number;
  limit: number;
}

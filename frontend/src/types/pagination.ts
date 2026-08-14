export interface PaginationResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Alias used across services
export type PaginatedResponse<T> = PaginationResponse<T>;

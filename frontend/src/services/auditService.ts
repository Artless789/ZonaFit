import { api } from './api';
import type { AuditLog, AuditLogFilterParams } from '@shared/types/audit';
import type { PaginationResponse } from '@shared/types/pagination';

export const auditService = {
  getAuditLogs: async (params?: AuditLogFilterParams): Promise<PaginationResponse<AuditLog>> => {
    const {
      page = 1,
      page_size = 20,
      limit,
      skip,
      action,
      module,
      entity_type,
      user_id,
      search,
      start_date,
      end_date,
    } = params || {};

    const queryParams = new URLSearchParams();

    if (page !== undefined) queryParams.append('page', String(page));
    if (page_size !== undefined) queryParams.append('page_size', String(page_size));
    if (limit !== undefined) queryParams.append('limit', String(limit));
    if (skip !== undefined) queryParams.append('skip', String(skip));
    if (action && action !== 'ALL') queryParams.append('action', action);
    if (module && module !== 'ALL') queryParams.append('module', module);
    if (entity_type && entity_type !== 'ALL') queryParams.append('entity_type', entity_type);
    if (user_id !== undefined && !isNaN(user_id)) queryParams.append('user_id', String(user_id));
    if (search && search.trim()) queryParams.append('search', search.trim());
    if (start_date) queryParams.append('start_date', start_date);
    if (end_date) queryParams.append('end_date', end_date);

    const queryString = queryParams.toString();
    const url = `/audit-logs/${queryString ? `?${queryString}` : ''}`;

    const { data } = await api.get<PaginationResponse<AuditLog>>(url);
    return data;
  },

  getAuditLogById: async (id: number): Promise<AuditLog> => {
    const { data } = await api.get<AuditLog>(`/audit-logs/${id}`);
    return data;
  },
};

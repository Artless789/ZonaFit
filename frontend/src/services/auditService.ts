import { api } from './api';
import type { AuditLog } from '@shared/types/audit';
import type { Paginated } from './membershipPlanService';

export const auditService = {
  getAuditLogs: async (
    limit = 100, 
    skip = 0,
    action?: string,
    entityType?: string,
    userId?: number
  ): Promise<Paginated<AuditLog>> => {
    let url = `/audit-logs/?limit=${limit}&skip=${skip}`;
    if (action) url += `&action=${encodeURIComponent(action)}`;
    if (entityType) url += `&entity_type=${encodeURIComponent(entityType)}`;
    if (userId) url += `&user_id=${userId}`;

    const { data } = await api.get<Paginated<AuditLog>>(url);
    return data;
  },
};

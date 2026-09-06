import { useQuery } from '@tanstack/react-query';
import { auditService } from '../services/auditService';
import { AuditLog } from '@shared/types/audit';
import { Paginated } from '../services/membershipPlanService';

export const useAuditLogs = (
  limit = 50,
  skip = 0,
  action?: string,
  entityType?: string,
  userId?: number
) => {
  const queryKey = ['audit-logs', limit, skip, action, entityType, userId];

  const query = useQuery<Paginated<AuditLog>, Error>({
    queryKey,
    queryFn: () => auditService.getAuditLogs(limit, skip, action, entityType, userId),
  });

  return {
    query,
  };
};

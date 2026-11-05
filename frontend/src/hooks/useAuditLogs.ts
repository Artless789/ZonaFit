import { useQuery } from '@tanstack/react-query';
import { auditService } from '../services/auditService';
import type { AuditLog, AuditLogFilterParams } from '@shared/types/audit';
import type { PaginationResponse } from '@shared/types/pagination';
import { useAuth } from '../context/AuthContext';

export const useAuditLogs = (params: AuditLogFilterParams = {}) => {
  const { user } = useAuth();
  const gymId = user?.gym_id ?? 'none';

  const queryKey = [
    'audit-logs',
    gymId,
    params.page ?? 1,
    params.page_size ?? 20,
    params.action ?? 'ALL',
    params.module ?? 'ALL',
    params.entity_type ?? 'ALL',
    params.user_id ?? 'ALL',
    params.search ?? '',
    params.start_date ?? '',
    params.end_date ?? '',
  ];

  const query = useQuery<PaginationResponse<AuditLog>, Error>({
    queryKey,
    queryFn: () => auditService.getAuditLogs(params),
    enabled: !!user,
    staleTime: 1000 * 30,
  });

  return {
    query,
  };
};

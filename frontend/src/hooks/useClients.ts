import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientService } from '../services/clientService';
import { ClientCreate, ClientUpdate, Client, Client360Response, ClientMetrics } from '@shared/types/client';
import { PaginationResponse } from '@shared/types/pagination';

export const useClients = (
  page: number = 1,
  pageSize: number = 20,
  search: string = '',
  isActive?: boolean,
  filterType?: string
) => {
  const queryClient = useQueryClient();
  const queryKey = ['clients', { page, pageSize, search, isActive, filterType }];

  const query = useQuery<PaginationResponse<Client>, Error>({
    queryKey,
    queryFn: () => clientService.getClients(page, pageSize, search, isActive, filterType),
    placeholderData: keepPreviousData, // Replaces keepPreviousData property in v5
  });

  const createMutation = useMutation<Client, Error, ClientCreate>({
    mutationFn: clientService.createClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const updateMutation = useMutation<Client, Error, { id: number; data: ClientUpdate }>({
    mutationFn: ({ id, data }) => clientService.updateClient(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const deleteMutation = useMutation<void, Error, number>({
    mutationFn: clientService.deleteClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return {
    query,
    createMutation,
    updateMutation,
    deleteMutation,
  };
};

export const useClient360 = (clientId?: number) => {
  return useQuery<Client360Response, Error>({
    queryKey: ['client360', clientId],
    queryFn: () => clientService.getClient360(clientId!),
    enabled: !!clientId,
  });
};

export const useClientMetrics = () => {
  return useQuery<ClientMetrics, Error>({
    queryKey: ['clients', 'metrics'],
    queryFn: clientService.getClientMetrics,
    staleTime: 1000 * 60 * 2,
  });
};


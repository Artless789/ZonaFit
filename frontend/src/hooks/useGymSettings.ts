import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gymSettingsService } from '../services/gymSettingsService';
import { GymSettingsCreate, GymSettingsUpdate, GymSettings } from '../types/gymSettings';
import { useAuth } from '../context/AuthContext';

export const useGymSettings = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['gymSettings'];

  const query = useQuery<GymSettings, Error>({
    queryKey,
    queryFn: gymSettingsService.getSettings,
    enabled: user?.role?.toUpperCase() !== 'SUPERADMIN',
    retry: (failureCount, error: any) => {
      // Don't retry if it's a 404 (needs setup) or 401/403
      if (error.response?.status === 404 || error.response?.status === 401 || error.response?.status === 403) {
        return false;
      }
      return failureCount < 2;
    },
  });

  const createMutation = useMutation<GymSettings, Error, GymSettingsCreate>({
    mutationFn: gymSettingsService.createSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
    },
  });

  const updateMutation = useMutation<GymSettings, Error, GymSettingsUpdate>({
    mutationFn: gymSettingsService.updateSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
    },
  });

  return {
    query,
    createMutation,
    updateMutation,
    // Convenience flags
    isNewRecord: query.error && (query.error as any).response?.status === 404,
  };
};

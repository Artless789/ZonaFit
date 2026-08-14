import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '../services/userService';
import type { UserCreate, UserUpdate } from '../types/user';

export const useUsers = (
  limit = 10,
  skip = 0,
  search?: string,
  status?: string,
  sortBy?: string,
  sortDesc?: boolean
) => {
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ['users', limit, skip, search, status, sortBy, sortDesc],
    queryFn: () => userService.getUsers(limit, skip, search, status, sortBy, sortDesc),
  });

  const createUser = useMutation({
    mutationFn: (user: UserCreate) => userService.createUser(user),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  const updateUser = useMutation({
    mutationFn: ({ id, user }: { id: number; user: UserUpdate }) => userService.updateUser(id, user),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  const deactivateUser = useMutation({
    mutationFn: (id: number) => userService.deactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  const activateUser = useMutation({
    mutationFn: (id: number) => userService.activateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  return {
    usersQuery,
    createUser,
    updateUser,
    deactivateUser,
    activateUser,
  };
};

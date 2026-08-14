import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoryService } from '../services/categoryService';
import { CategoryCreate, CategoryUpdate, Category } from '../types/category';
import { Paginated } from '../services/membershipPlanService';

export const useCategories = () => {
  const queryClient = useQueryClient();
  const queryKey = ['categories'];

  const query = useQuery<Paginated<Category>, Error>({
    queryKey,
    queryFn: categoryService.getCategories,
  });

  const createMutation = useMutation<Category, Error, CategoryCreate>({
    mutationFn: categoryService.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateMutation = useMutation<Category, Error, { id: number; data: CategoryUpdate }>({
    mutationFn: ({ id, data }) => categoryService.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation<void, Error, number>({
    mutationFn: categoryService.deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    query,
    createMutation,
    updateMutation,
    deleteMutation,
  };
};

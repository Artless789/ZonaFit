import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productService } from '../services/productService';
import { ProductCreate, ProductUpdate, Product } from '../types/product';
import { Paginated } from '../services/membershipPlanService';

export const useProducts = () => {
  const queryClient = useQueryClient();
  const queryKey = ['products'];

  const query = useQuery<Paginated<Product>, Error>({
    queryKey,
    queryFn: productService.getProducts,
  });

  const createMutation = useMutation<Product, Error, ProductCreate>({
    mutationFn: productService.createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateMutation = useMutation<Product, Error, { id: number; data: ProductUpdate }>({
    mutationFn: ({ id, data }) => productService.updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation<void, Error, number>({
    mutationFn: productService.deleteProduct,
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

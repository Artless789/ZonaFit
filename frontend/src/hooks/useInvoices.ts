import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoiceService } from '../services/invoiceService';
import { useToast } from '@shared/ui/Toast';

export function useInvoices(params?: { page?: number; limit?: number; search?: string; status?: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const queryKey = ['invoices', params?.page, params?.limit, params?.search, params?.status];

  const query = useQuery({
    queryKey,
    queryFn: () => invoiceService.getAll(params),
    placeholderData: (previousData) => previousData,
  });


  const createInvoiceMutation = useMutation({
    mutationFn: invoiceService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error: any) => {
      toast({
        type: 'error',
        title: 'Error al generar comprobante',
        message: error?.response?.data?.detail || 'Ocurrió un error al generar el comprobante.',
      });
    },
  });
  
  const cancelInvoiceMutation = useMutation({
    mutationFn: invoiceService.cancel,
    onSuccess: () => {
      toast({
        type: 'success',
        title: 'Comprobante Cancelado',
        message: 'El comprobante ha sido cancelado correctamente.',
      });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error: any) => {
      toast({
        type: 'error',
        title: 'Error',
        message: error?.response?.data?.detail || 'No se pudo cancelar el comprobante.',
      });
    },
  });

  return {
    query,
    createInvoiceMutation,
    cancelInvoiceMutation,
  };
}

export function useInvoiceDetails(id: number) {
  return useQuery({
    queryKey: ['invoiceDetails', id],
    queryFn: () => invoiceService.getDetails(id),
    enabled: !!id,
  });
}

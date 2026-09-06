import { z } from 'zod';

export const saleSchema = z.object({
  client_id: z.coerce.number().min(1, 'Debe seleccionar un cliente.'),
  notes: z.string().optional().nullable(),
});

export type SaleFormValues = z.infer<typeof saleSchema>;

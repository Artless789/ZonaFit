import { z } from 'zod';

export const categorySchema = z.object({
  name: z.string().min(3, 'El nombre de la categoría debe tener al menos 3 caracteres.'),
  description: z.string().optional().nullable(),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;

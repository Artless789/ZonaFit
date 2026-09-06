import { z } from 'zod';

export const clientSchema = z.object({
  full_name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  document_type: z.string().min(1, 'Selecciona un tipo de documento.'),
  document: z.string().min(5, 'El documento debe tener al menos 5 caracteres.'),
  phone: z.string().min(7, 'El teléfono debe tener al menos 7 caracteres.'),
  email: z.union([z.literal(''), z.string().email('Debe ser un correo válido.')]).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type ClientFormValues = z.infer<typeof clientSchema>;

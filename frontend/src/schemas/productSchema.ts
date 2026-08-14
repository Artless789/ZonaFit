import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(3, 'El nombre del producto debe tener al menos 3 caracteres.'),
  category_id: z.coerce.number().min(1, 'Debe seleccionar una categoría.'),
  sku: z.string().min(3, 'El código SKU debe tener al menos 3 caracteres.'),
  description: z.string().optional().nullable(),
  purchase_price: z.coerce.number().min(0, 'El precio de compra no puede ser negativo.'),
  sale_price: z.coerce.number().min(0, 'El precio de venta no puede ser negativo.'),
  stock: z.coerce.number().int().min(0, 'El stock no puede ser negativo.'),
  minimum_stock: z.coerce.number().int().min(0, 'El stock mínimo no puede ser negativo.'),
});

export type ProductFormValues = z.infer<typeof productSchema>;

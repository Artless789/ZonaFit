import { z } from 'zod';

export const notificationTemplateSchema = z.object({
  event_type: z.string().min(1, 'El tipo de evento es requerido'),
  channel: z.string().min(1, 'El canal es requerido'),
  template_body: z.string().min(5, 'La plantilla debe tener al menos 5 caracteres'),
});

export type NotificationTemplateFormValues = z.infer<typeof notificationTemplateSchema>;

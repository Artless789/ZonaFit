import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '../services/notificationService';
import type {
  Notification,
  NotificationSendRequest,
  NotificationTemplate,
  NotificationTemplateCreate,
  NotificationTemplateUpdate,
} from '@shared/types/notification';
import type { PaginatedResponse } from '@shared/types/pagination';

export const useNotifications = () => {
  const queryClient = useQueryClient();
  const historyKey = ['notifications', 'history'];
  const templatesKey = ['notifications', 'templates'];
  const waStatusKey = ['notifications', 'whatsapp-status'];

  const historyQuery = useQuery<PaginatedResponse<Notification>, Error>({
    queryKey: historyKey,
    queryFn: () => notificationService.getNotifications(),
  });

  const templatesQuery = useQuery<PaginatedResponse<NotificationTemplate>, Error>({
    queryKey: templatesKey,
    queryFn: notificationService.getTemplates,
  });

  const whatsAppStatusQuery = useQuery<{ configured: boolean; channel: string; message: string }, Error>({
    queryKey: waStatusKey,
    queryFn: notificationService.getWhatsAppStatus,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  const sendMutation = useMutation<Notification, Error, NotificationSendRequest>({
    mutationFn: notificationService.sendNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: historyKey });
    },
  });

  const createTemplateMutation = useMutation<NotificationTemplate, Error, NotificationTemplateCreate>({
    mutationFn: notificationService.createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templatesKey });
    },
  });

  const updateTemplateMutation = useMutation<NotificationTemplate, Error, { id: number; data: NotificationTemplateUpdate }>({
    mutationFn: ({ id, data }) => notificationService.updateTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templatesKey });
    },
  });

  return {
    historyQuery,
    templatesQuery,
    whatsAppStatusQuery,
    sendMutation,
    createTemplateMutation,
    updateTemplateMutation,
  };
};

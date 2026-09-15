import { useState, useCallback } from 'react';
import { WhatsAppMessageModal } from '../shared/ui/WhatsAppMessageModal';
import type { OpenCommunicationOptions, ClientBasicInfo } from '../shared/types/communication';

export function useWhatsAppWeb(onEditClient?: (clientId: number) => void) {
  const [isOpen, setIsOpen] = useState(false);
  const [client, setClient] = useState<ClientBasicInfo | null>(null);
  const [eventType, setEventType] = useState<string>('GENERAL');
  const [eventLabel, setEventLabel] = useState<string | undefined>(undefined);
  const [contextData, setContextData] = useState<Record<string, any> | undefined>(undefined);
  const [initialMessage, setInitialMessage] = useState<string | undefined>(undefined);

  const openWhatsAppModal = useCallback((options: OpenCommunicationOptions) => {
    setClient(options.client);
    setEventType(options.eventType);
    setEventLabel(options.eventLabel);
    setContextData(options.contextData);
    setInitialMessage(options.defaultMessage);
    setIsOpen(true);
  }, []);

  const closeWhatsAppModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const WhatsAppModalComponent = useCallback(() => {
    if (!isOpen) return null;
    return (
      <WhatsAppMessageModal
        isOpen={isOpen}
        onClose={closeWhatsAppModal}
        client={client}
        eventType={eventType}
        eventLabel={eventLabel}
        contextData={contextData}
        initialMessage={initialMessage}
        onEditClient={onEditClient}
      />
    );
  }, [isOpen, closeWhatsAppModal, client, eventType, eventLabel, contextData, initialMessage, onEditClient]);

  return {
    isOpen,
    openWhatsAppModal,
    closeWhatsAppModal,
    WhatsAppModalComponent,
  };
}

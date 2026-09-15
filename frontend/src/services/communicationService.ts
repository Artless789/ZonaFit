import { api } from './api';
import type {
  CommunicationPrepareRequest,
  CommunicationPrepareResponse,
  CommunicationRecordOpenedRequest,
  CommunicationRecordOpenedResponse,
} from '../shared/types/communication';

export const communicationService = {
  prepare: async (payload: CommunicationPrepareRequest): Promise<CommunicationPrepareResponse> => {
    const { data } = await api.post<CommunicationPrepareResponse>('/communications/prepare', payload);
    return data;
  },

  recordOpened: async (payload: CommunicationRecordOpenedRequest): Promise<CommunicationRecordOpenedResponse> => {
    const { data } = await api.post<CommunicationRecordOpenedResponse>('/communications/record-opened', payload);
    return data;
  },
};

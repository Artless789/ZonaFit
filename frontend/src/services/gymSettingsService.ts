import { api } from './api';
import type { GymSettings, GymSettingsCreate, GymSettingsUpdate } from '../types/gymSettings';

export const gymSettingsService = {
  getSettings: async (): Promise<GymSettings> => {
    const { data } = await api.get<GymSettings>('/gym-settings/');
    return data;
  },

  createSettings: async (settingsData: GymSettingsCreate): Promise<GymSettings> => {
    const { data } = await api.post<GymSettings>('/gym-settings/', settingsData);
    return data;
  },

  updateSettings: async (settingsData: GymSettingsUpdate): Promise<GymSettings> => {
    const { data } = await api.put<GymSettings>('/gym-settings/', settingsData);
    return data;
  },

  completeOnboarding: async (): Promise<{ success: boolean; message: string }> => {
    const { data } = await api.post<{ success: boolean; message: string }>('/gym-settings/complete-onboarding');
    return data;
  },
};

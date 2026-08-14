export interface GymSettings {
  id?: number;
  gym_id?: number;
  legal_name: string;
  trade_name: string;
  tax_id: string;
  tax_regime?: string;
  official_phone: string;
  official_email: string;
  physical_address: string;
  city: string;
  country: string;
  currency: string;
  timezone: string;
  default_tax_percentage: number | string;
  receipt_footer_notes?: string;
  created_at?: string;
  updated_at?: string;
}

export type GymSettingsCreate = Omit<GymSettings, 'id' | 'gym_id' | 'created_at' | 'updated_at'>;
export type GymSettingsUpdate = Partial<GymSettingsCreate>;

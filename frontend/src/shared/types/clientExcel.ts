export type ImportCategory = 
  | 'NO_CHANGE'
  | 'NEW'
  | 'MODIFIED'
  | 'MISSING'
  | 'CONFLICT'
  | 'NO_DOCUMENT'
  | 'DUPLICATE';

export interface ClientFieldDiff {
  old_value?: string | null;
  new_value?: string | null;
}

export interface ClientPreviewItem {
  row_number: number;
  category: ImportCategory;
  client_id?: number | null;
  document_type: string;
  document: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  is_active: boolean;
  diffs?: Record<string, ClientFieldDiff> | null;
  conflict_reason?: string | null;
  is_selected?: boolean;
}

export interface ClientImportSummary {
  total_rows: number;
  no_change_count: number;
  new_count: number;
  modified_count: number;
  missing_count: number;
  conflict_count: number;
  no_document_count: number;
  duplicate_count: number;
}

export interface ClientImportPreviewResponse {
  summary: ClientImportSummary;
  items: ClientPreviewItem[];
  missing_clients: ClientPreviewItem[];
}

export interface ClientImportNewItem {
  document_type: string;
  document: string;
  full_name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
}

export interface ClientImportUpdateItem {
  client_id: number;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface ClientImportApplyRequest {
  new_clients: ClientImportNewItem[];
  updated_clients: ClientImportUpdateItem[];
}

export interface ClientImportApplyResponse {
  success: boolean;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  message: string;
}

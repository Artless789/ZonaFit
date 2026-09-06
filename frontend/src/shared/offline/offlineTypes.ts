export interface OfflineOperation {
  id_local: string;
  type: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  payload: any;
  idempotency_key: string;
  created_at: string;
  attempts: number;
  status: 'pending' | 'syncing' | 'failed' | 'completed';
  last_error?: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success';

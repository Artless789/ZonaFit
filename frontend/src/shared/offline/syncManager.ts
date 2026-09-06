import { v4 as uuidv4 } from 'uuid';
import { offlineQueue } from './offlineQueue';
import { OfflineOperation, SyncStatus } from './offlineTypes';
import { api } from '../../services/api';
import { queryClient } from '@shared/queryClient';

// Eventos para la UI
type SyncListener = (pendingCount: number, status: SyncStatus) => void;
const listeners = new Set<SyncListener>();

let isSyncing = false;

// Rutas permitidas para offline
const ALLOWED_OFFLINE_ENDPOINTS = [
  '/clients',
  '/categories',
  '/products',
  '/sales',
  '/sale-details',
  '/cash-registers'
];

export const SyncManager = {
  subscribe(listener: SyncListener) {
    listeners.add(listener);
    this.notify();
    return () => listeners.delete(listener);
  },

  async notify(status: SyncStatus = 'idle') {
    const ops = await offlineQueue.getPendingOperations();
    listeners.forEach(l => l(ops.length, status));
  },

  isEndpointAllowed(endpoint: string): boolean {
    return ALLOWED_OFFLINE_ENDPOINTS.some(path => endpoint.includes(path));
  },

  async enqueue(
    endpoint: string,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    payload: any,
    type: string = 'mutation'
  ): Promise<OfflineOperation> {
    const operation: OfflineOperation = {
      id_local: uuidv4(),
      type,
      endpoint,
      method,
      payload,
      idempotency_key: uuidv4(),
      created_at: new Date().toISOString(),
      attempts: 0,
      status: 'pending'
    };
    
    await offlineQueue.addOperation(operation);
    await this.notify();
    return operation;
  },

  async sync(): Promise<void> {
    if (isSyncing || !navigator.onLine) return;
    
    const pendingOps = await offlineQueue.getPendingOperations();
    if (pendingOps.length === 0) return;

    isSyncing = true;
    await this.notify('syncing');

    let hasErrors = false;
    const invalidatedKeys = new Set<string>();

    for (const op of pendingOps) {
      if (op.attempts >= 3) {
        op.status = 'failed';
        op.last_error = 'Max retries reached';
        await offlineQueue.updateOperation(op);
        hasErrors = true;
        continue;
      }

      op.attempts += 1;
      op.status = 'syncing';
      await offlineQueue.updateOperation(op);

      try {
        // Enviar al backend real usando api.ts (que maneja JWT y refresh solos)
        await api.request({
          url: op.endpoint,
          method: op.method,
          data: op.payload,
          headers: {
            'Idempotency-Key': op.idempotency_key
          }
        });

        // Completado
        op.status = 'completed';
        await offlineQueue.removeOperation(op.id_local);

        // Record invalidation based on endpoint
        if (op.endpoint.includes('/clients')) invalidatedKeys.add('clients');
        if (op.endpoint.includes('/categories')) invalidatedKeys.add('categories');
        if (op.endpoint.includes('/products')) invalidatedKeys.add('products');
        if (op.endpoint.includes('/sales') || op.endpoint.includes('/sale-details')) invalidatedKeys.add('sales');
        if (op.endpoint.includes('/cash-registers')) invalidatedKeys.add('cash-registers');

      } catch (error: any) {
        // Si el error es 401, api.ts ya intentó el refresh en Single-Flight.
        // Si sigue fallando, es que se cerró sesión, por tanto detenemos la cola
        const status = error.response?.status;
        if (status === 401) {
          op.status = 'pending';
          await offlineQueue.updateOperation(op);
          hasErrors = true;
          break; // Detener sync hasta re-login
        }

        if (status >= 400 && status < 500 && status !== 408) {
          // Error de validación (ej. conflicto inventario)
          op.status = 'failed';
          op.last_error = error.response?.data?.detail || 'Validation error';
          await offlineQueue.updateOperation(op);
          hasErrors = true;
        } else {
          // Error 500 o de red, mantener en pending para reintentar luego
          op.status = 'pending';
          op.last_error = 'Network or server error';
          await offlineQueue.updateOperation(op);
          hasErrors = true;
        }
      }
    }

    // Invalidar caché selectivamente
    invalidatedKeys.forEach(key => {
      // Usar setTimeout para evitar dependencias circulares directas o bloquear el sync
      setTimeout(() => queryClient.invalidateQueries({ queryKey: [key] }), 100);
    });

    isSyncing = false;
    await this.notify(hasErrors ? 'error' : 'success');
  },
  
  async getPending() {
    return await offlineQueue.getPendingOperations();
  }
};

window.addEventListener('online', () => {
  SyncManager.sync();
});

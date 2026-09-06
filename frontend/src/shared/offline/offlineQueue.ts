import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { OfflineOperation } from './offlineTypes';

interface OfflineQueueDB extends DBSchema {
  operations: {
    key: string;
    value: OfflineOperation;
    indexes: {
      'by-status': string;
      'by-created': string;
    };
  };
}

const DB_NAME = 'zonafit-offline-queue';
const DB_VERSION = 1;
const STORE_NAME = 'operations';

let dbPromise: Promise<IDBPDatabase<OfflineQueueDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<OfflineQueueDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id_local' });
          store.createIndex('by-status', 'status');
          store.createIndex('by-created', 'created_at');
        }
      },
    });
  }
  return dbPromise;
}

export const offlineQueue = {
  async addOperation(op: OfflineOperation): Promise<void> {
    const db = await getDB();
    
    // CONSOLIDACIÓN DE OPERACIONES (Fase 8)
    // Evitar sincronizar repetidas actualizaciones al mismo registro.
    if (op.method === 'PUT' || op.method === 'PATCH') {
      const ops = await this.getPendingOperations();
      const existingOp = ops.find(o => 
        o.endpoint === op.endpoint && 
        o.method === op.method && 
        o.status === 'pending'
      );
      
      if (existingOp) {
        existingOp.payload = { ...existingOp.payload, ...op.payload };
        existingOp.created_at = op.created_at;
        existingOp.attempts = 0;
        await db.put(STORE_NAME, existingOp);
        return;
      }
    }

    await db.put(STORE_NAME, op);
  },

  async getPendingOperations(): Promise<OfflineOperation[]> {
    const db = await getDB();
    const ops = await db.getAllFromIndex(STORE_NAME, 'by-created');
    // Filtrar pending y failed (para reintento)
    return ops.filter(op => op.status === 'pending' || op.status === 'failed');
  },

  async updateOperation(op: OfflineOperation): Promise<void> {
    const db = await getDB();
    await db.put(STORE_NAME, op);
  },

  async removeOperation(id_local: string): Promise<void> {
    const db = await getDB();
    await db.delete(STORE_NAME, id_local);
  },

  async clearCompleted(): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const index = tx.store.index('by-status');
    let cursor = await index.openCursor('completed');
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }
};

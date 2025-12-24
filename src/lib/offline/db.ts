import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface OfflineDB extends DBSchema {
  cache: {
    key: string;
    value: {
      table: string;
      data: any;
      timestamp: number;
    };
    indexes: { 'by-table': string; 'by-timestamp': number };
  };
  queue: {
    key: number;
    value: {
      id: number;
      action: 'insert' | 'update' | 'delete';
      table: string;
      data: any;
      timestamp: number;
      retries: number;
    };
    indexes: { 'by-table': string; 'by-timestamp': number };
  };
  metadata: {
    key: string;
    value: {
      key: string;
      value: any;
      timestamp: number;
    };
  };
}

let dbInstance: IDBPDatabase<OfflineDB> | null = null;

export const getDB = async (): Promise<IDBPDatabase<OfflineDB>> => {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<OfflineDB>('beh-clients-offline', 1, {
    upgrade(db) {
      // Store pour le cache des données
      const cacheStore = db.createObjectStore('cache', {
        keyPath: 'key'
      });
      cacheStore.createIndex('by-table', 'table');
      cacheStore.createIndex('by-timestamp', 'timestamp');

      // Store pour la queue des actions offline
      const queueStore = db.createObjectStore('queue', {
        keyPath: 'id',
        autoIncrement: true
      });
      queueStore.createIndex('by-table', 'table');
      queueStore.createIndex('by-timestamp', 'timestamp');

      // Store pour les métadonnées
      db.createObjectStore('metadata', {
        keyPath: 'key'
      });
    }
  });

  return dbInstance;
};

// Fonctions pour le cache
export const cacheData = async (table: string, key: string, data: any) => {
  const db = await getDB();
  await db.put('cache', {
    key: `${table}:${key}`,
    table,
    data,
    timestamp: Date.now()
  });
};

export const getCachedData = async (table: string, key: string) => {
  const db = await getDB();
  const result = await db.get('cache', `${table}:${key}`);
  return result?.data;
};

export const getAllCachedData = async (table: string) => {
  const db = await getDB();
  const index = db.transaction('cache').store.index('by-table');
  const results = await index.getAll(table);
  return results.map(r => r.data);
};

export const clearCache = async (table?: string) => {
  const db = await getDB();
  if (table) {
    const index = db.transaction('cache').store.index('by-table');
    const keys = await index.getAllKeys(table);
    await Promise.all(keys.map(key => db.delete('cache', key)));
  } else {
    await db.clear('cache');
  }
};

// Fonctions pour la queue
export const addToQueue = async (
  action: 'insert' | 'update' | 'delete',
  table: string,
  data: any
) => {
  const db = await getDB();
  const id = await db.add('queue', {
    action,
    table,
    data,
    timestamp: Date.now(),
    retries: 0
  });
  return id;
};

export const getQueue = async (table?: string) => {
  const db = await getDB();
  if (table) {
    const index = db.transaction('queue').store.index('by-table');
    return await index.getAll(table);
  }
  return await db.getAll('queue');
};

export const removeFromQueue = async (id: number) => {
  const db = await getDB();
  await db.delete('queue', id);
};

export const incrementQueueRetries = async (id: number) => {
  const db = await getDB();
  const item = await db.get('queue', id);
  if (item) {
    item.retries += 1;
    await db.put('queue', item);
  }
};

// Fonctions pour les métadonnées
export const setMetadata = async (key: string, value: any) => {
  const db = await getDB();
  await db.put('metadata', {
    key,
    value,
    timestamp: Date.now()
  });
};

export const getMetadata = async (key: string) => {
  const db = await getDB();
  const result = await db.get('metadata', key);
  return result?.value;
};


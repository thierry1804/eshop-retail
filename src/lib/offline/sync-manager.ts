import { syncQueue, syncTable } from './sync';
import { devLog } from '../devLog';
import { getQueue } from './db';

export class SyncManager {
  private static instance: SyncManager;
  private syncInterval: number | null = null;
  private isSyncing: boolean = false;
  private listeners: Array<(isSyncing: boolean) => void> = [];

  private constructor() {
    // Écouter les changements de connexion
    window.addEventListener('online', () => {
      devLog('🌐 Connexion rétablie, démarrage de la synchronisation...');
      this.startAutoSync();
      this.sync();
    });

    window.addEventListener('offline', () => {
      devLog('📴 Mode offline, arrêt de la synchronisation automatique');
      this.stopAutoSync();
    });

    // Démarrer la synchronisation automatique si on est en ligne
    if (navigator.onLine) {
      this.startAutoSync();
    }
  }

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  public onSyncStateChange(listener: (isSyncing: boolean) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(isSyncing: boolean) {
    this.listeners.forEach(listener => listener(isSyncing));
  }

  public async sync(): Promise<void> {
    if (this.isSyncing || !navigator.onLine) {
      return;
    }

    this.isSyncing = true;
    this.notifyListeners(true);

    try {
      devLog('🔄 SyncManager: Démarrage de la synchronisation...');
      
      // Synchroniser la queue d'abord
      const queueResult = await syncQueue();
      devLog(`✅ SyncManager: Queue synchronisée - ${queueResult.success} réussies, ${queueResult.failed} échouées`);

      // Synchroniser les tables principales si la queue est vide ou presque
      if (queueResult.success > 0 || queueResult.failed === 0) {
        const tablesToSync = ['clients', 'sales', 'payments', 'products', 'expenses'];
        
        for (const table of tablesToSync) {
          try {
            await syncTable(table);
          } catch (error) {
            console.error(`❌ SyncManager: Erreur lors de la synchronisation de ${table}:`, error);
          }
        }
      }

      devLog('✅ SyncManager: Synchronisation terminée');
    } catch (error) {
      console.error('❌ SyncManager: Erreur lors de la synchronisation:', error);
    } finally {
      this.isSyncing = false;
      this.notifyListeners(false);
    }
  }

  public startAutoSync(intervalMs: number = 30000) {
    if (this.syncInterval) {
      return;
    }

    // Synchroniser immédiatement
    this.sync();

    // Puis synchroniser périodiquement
    this.syncInterval = window.setInterval(() => {
      if (navigator.onLine) {
        this.sync();
      }
    }, intervalMs);

    devLog(`🔄 SyncManager: Synchronisation automatique démarrée (toutes les ${intervalMs / 1000}s)`);
  }

  public stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      devLog('⏸️ SyncManager: Synchronisation automatique arrêtée');
    }
  }

  public async getQueueStatus() {
    const queue = await getQueue();
    return {
      count: queue.length,
      items: queue
    };
  }

  public isCurrentlySyncing(): boolean {
    return this.isSyncing;
  }
}

export const syncManager = SyncManager.getInstance();


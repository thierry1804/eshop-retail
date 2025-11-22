import { useState, useEffect } from 'react';
import { syncManager } from '../lib/offline/sync-manager';

export const useSyncStatus = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    // Écouter les changements d'état de synchronisation
    const unsubscribe = syncManager.onSyncStateChange((syncing) => {
      setIsSyncing(syncing);
    });

    // Mettre à jour le nombre d'éléments en queue
    const updateQueueCount = async () => {
      const status = await syncManager.getQueueStatus();
      setQueueCount(status.count);
    };

    updateQueueCount();
    const interval = setInterval(updateQueueCount, 2000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return { isSyncing, queueCount };
};


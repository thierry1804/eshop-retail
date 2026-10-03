import { supabase } from '../supabase';
import { devLog, devWarn } from '../devLog';
import { getQueue, removeFromQueue, incrementQueueRetries, clearCache, cacheData } from './db';

export interface SyncResult {
  success: number;
  failed: number;
  errors: Array<{ id: number; error: string }>;
}

export const syncQueue = async (): Promise<SyncResult> => {
  const queue = await getQueue();
  const result: SyncResult = {
    success: 0,
    failed: 0,
    errors: []
  };

  devLog(`🔄 Sync: ${queue.length} actions en attente de synchronisation`);

  for (const item of queue) {
    try {
      let response: any;

      switch (item.action) {
        case 'insert':
          response = await supabase
            .from(item.table)
            .insert(item.data)
            .select()
            .single();
          break;

        case 'update':
          response = await supabase
            .from(item.table)
            .update(item.data)
            .eq('id', item.data.id)
            .select()
            .single();
          break;

        case 'delete':
          response = await supabase
            .from(item.table)
            .delete()
            .eq('id', item.data.id);
          break;
      }

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Si c'est un insert, on peut mettre à jour le cache avec le nouvel ID
      if (item.action === 'insert' && response.data) {
        await cacheData(item.table, response.data.id, response.data);
      }

      await removeFromQueue(item.id);
      result.success++;
      devLog(`✅ Sync: Action ${item.action} sur ${item.table} synchronisée`);
    } catch (error: any) {
      console.error(`❌ Sync: Erreur lors de la synchronisation de l'action ${item.id}:`, error);
      
      // Incrémenter les tentatives
      await incrementQueueRetries(item.id);

      // Si trop de tentatives, on retire de la queue
      const updatedItem = await getQueue().then(q => q.find(i => i.id === item.id));
      if (updatedItem && updatedItem.retries >= 5) {
        await removeFromQueue(item.id);
        devWarn(`⚠️ Sync: Action ${item.id} retirée après 5 tentatives`);
      }

      result.failed++;
      result.errors.push({
        id: item.id,
        error: error.message || 'Erreur inconnue'
      });
    }
  }

  devLog(`✅ Sync: Synchronisation terminée - ${result.success} réussies, ${result.failed} échouées`);
  return result;
};

export const syncTable = async (table: string): Promise<void> => {
  devLog(`🔄 Sync: Synchronisation de la table ${table}...`);
  
  try {
    // Récupérer les données depuis Supabase
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000); // Limiter pour éviter de surcharger

    if (error) {
      throw error;
    }

    // Mettre à jour le cache
    await clearCache(table);
    for (const item of data || []) {
      await cacheData(table, item.id, item);
    }

    devLog(`✅ Sync: Table ${table} synchronisée (${data?.length || 0} enregistrements)`);
  } catch (error) {
    console.error(`❌ Sync: Erreur lors de la synchronisation de ${table}:`, error);
    throw error;
  }
};


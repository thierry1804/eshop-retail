import { supabase } from '../supabase';
import { 
  addToQueue, 
  getCachedData, 
  getAllCachedData, 
  cacheData,
  getMetadata,
  setMetadata
} from './db';

// Wrapper pour les requêtes Supabase avec support offline
export class SupabaseOffline {
  private static instance: SupabaseOffline;
  private isOnline: boolean = navigator.onLine;

  private constructor() {
    // Écouter les changements de connexion
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('🌐 Mode online activé');
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('📴 Mode offline activé');
    });
  }

  public static getInstance(): SupabaseOffline {
    if (!SupabaseOffline.instance) {
      SupabaseOffline.instance = new SupabaseOffline();
    }
    return SupabaseOffline.instance;
  }

  public getOnlineStatus(): boolean {
    return this.isOnline;
  }

  // Wrapper pour les SELECT
  public async select<T = any>(
    table: string,
    query?: (q: any) => any
  ): Promise<{ data: T[] | null; error: any }> {
    if (this.isOnline) {
      try {
        let queryBuilder = supabase.from(table).select('*');
        
        if (query) {
          queryBuilder = query(queryBuilder);
        }

        const { data, error } = await queryBuilder;

        if (!error && data) {
          // Mettre en cache les données
          for (const item of data) {
            await cacheData(table, item.id, item);
          }
          
          // Sauvegarder le timestamp de dernière synchronisation
          await setMetadata(`last_sync:${table}`, Date.now());
        }

        return { data, error };
      } catch (error) {
        console.warn(`⚠️ Erreur réseau, utilisation du cache pour ${table}`);
        // En cas d'erreur réseau, essayer le cache
        return this.selectFromCache<T>(table);
      }
    } else {
      // Mode offline : utiliser le cache
      return this.selectFromCache<T>(table);
    }
  }

  private async selectFromCache<T>(table: string): Promise<{ data: T[] | null; error: any }> {
    try {
      const cachedData = await getAllCachedData(table);
      console.log(`📦 Utilisation du cache pour ${table}: ${cachedData.length} enregistrements`);
      return { data: cachedData as T[], error: null };
    } catch (error) {
      console.error(`❌ Erreur lors de la lecture du cache pour ${table}:`, error);
      return { data: null, error };
    }
  }

  // Wrapper pour les INSERT
  public async insert<T = any>(
    table: string,
    data: any
  ): Promise<{ data: T | null; error: any }> {
    if (this.isOnline) {
      try {
        const { data: result, error } = await supabase
          .from(table)
          .insert(data)
          .select()
          .single();

        if (!error && result) {
          await cacheData(table, result.id, result);
        }

        return { data: result, error };
      } catch (error) {
        console.warn(`⚠️ Erreur réseau lors de l'insertion, ajout à la queue`);
        // En cas d'erreur, ajouter à la queue
        return this.insertToQueue(table, data);
      }
    } else {
      // Mode offline : ajouter à la queue
      return this.insertToQueue(table, data);
    }
  }

  private async insertToQueue<T>(table: string, data: any): Promise<{ data: T | null; error: any }> {
    try {
      // Générer un ID temporaire
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const dataWithTempId = { ...data, id: tempId, _isOffline: true };

      await addToQueue('insert', table, data);
      await cacheData(table, tempId, dataWithTempId);

      console.log(`📝 Action d'insertion ajoutée à la queue pour ${table}`);
      return { data: dataWithTempId as T, error: null };
    } catch (error) {
      console.error(`❌ Erreur lors de l'ajout à la queue:`, error);
      return { data: null, error };
    }
  }

  // Wrapper pour les UPDATE
  public async update<T = any>(
    table: string,
    id: string | number,
    data: any
  ): Promise<{ data: T | null; error: any }> {
    if (this.isOnline) {
      try {
        const { data: result, error } = await supabase
          .from(table)
          .update(data)
          .eq('id', id)
          .select()
          .single();

        if (!error && result) {
          await cacheData(table, id.toString(), result);
        }

        return { data: result, error };
      } catch (error) {
        console.warn(`⚠️ Erreur réseau lors de la mise à jour, ajout à la queue`);
        return this.updateToQueue(table, id, data);
      }
    } else {
      // Mode offline : ajouter à la queue
      return this.updateToQueue(table, id, data);
    }
  }

  private async updateToQueue<T>(table: string, id: string | number, data: any): Promise<{ data: T | null; error: any }> {
    try {
      // Mettre à jour le cache localement
      const cached = await getCachedData(table, id.toString());
      const updatedData = { ...cached, ...data, _isOffline: true };

      await addToQueue('update', table, { id, ...data });
      await cacheData(table, id.toString(), updatedData);

      console.log(`📝 Action de mise à jour ajoutée à la queue pour ${table}:${id}`);
      return { data: updatedData as T, error: null };
    } catch (error) {
      console.error(`❌ Erreur lors de l'ajout à la queue:`, error);
      return { data: null, error };
    }
  }

  // Wrapper pour les DELETE
  public async delete(
    table: string,
    id: string | number
  ): Promise<{ error: any }> {
    if (this.isOnline) {
      try {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('id', id);

        if (!error) {
          // Ne pas supprimer du cache immédiatement, on laisse la synchronisation le faire
        }

        return { error };
      } catch (error) {
        console.warn(`⚠️ Erreur réseau lors de la suppression, ajout à la queue`);
        return this.deleteToQueue(table, id);
      }
    } else {
      // Mode offline : ajouter à la queue
      return this.deleteToQueue(table, id);
    }
  }

  private async deleteToQueue(table: string, id: string | number): Promise<{ error: any }> {
    try {
      await addToQueue('delete', table, { id });
      console.log(`📝 Action de suppression ajoutée à la queue pour ${table}:${id}`);
      return { error: null };
    } catch (error) {
      console.error(`❌ Erreur lors de l'ajout à la queue:`, error);
      return { error };
    }
  }
}

// Export d'une instance singleton
export const supabaseOffline = SupabaseOffline.getInstance();


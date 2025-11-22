# Système de Gestion Offline

Ce système permet à l'application de fonctionner en mode hors ligne et de synchroniser automatiquement les données lorsque la connexion est rétablie.

## Architecture

### 1. IndexedDB (`db.ts`)
Stockage local des données et queue des actions en attente :
- **Cache** : Stocke les données récupérées depuis Supabase
- **Queue** : Stocke les actions (insert, update, delete) à synchroniser
- **Metadata** : Stocke les métadonnées (timestamps de synchronisation, etc.)

### 2. Wrapper Supabase Offline (`supabase-offline.ts`)
Wrapper qui intercepte les requêtes Supabase et :
- Utilise le cache en mode offline
- Ajoute les mutations à la queue en mode offline
- Synchronise automatiquement quand la connexion revient

### 3. Service de Synchronisation (`sync.ts`)
Gère la synchronisation des données :
- Synchronise la queue des actions en attente
- Synchronise les tables principales

### 4. Gestionnaire de Synchronisation (`sync-manager.ts`)
Gère la synchronisation automatique :
- Détecte les changements de connexion
- Synchronise périodiquement (toutes les 30 secondes par défaut)
- Notifie les composants de l'état de synchronisation

## Utilisation

### Utiliser le wrapper offline dans un composant

```typescript
import { supabaseOffline } from '../lib/offline/supabase-offline';

// Au lieu de :
const { data, error } = await supabase.from('clients').select('*');

// Utiliser :
const { data, error } = await supabaseOffline.select('clients');
```

### Détecter l'état de connexion

```typescript
import { useOnline } from '../hooks/useOnline';

const MyComponent = () => {
  const isOnline = useOnline();
  
  return (
    <div>
      {isOnline ? 'En ligne' : 'Hors ligne'}
    </div>
  );
};
```

### Détecter l'état de synchronisation

```typescript
import { useSyncStatus } from '../hooks/useSyncStatus';

const MyComponent = () => {
  const { isSyncing, queueCount } = useSyncStatus();
  
  return (
    <div>
      {isSyncing && <p>Synchronisation en cours...</p>}
      {queueCount > 0 && <p>{queueCount} actions en attente</p>}
    </div>
  );
};
```

### Forcer une synchronisation manuelle

```typescript
import { syncManager } from '../lib/offline/sync-manager';

// Synchroniser maintenant
await syncManager.sync();

// Obtenir le statut de la queue
const status = await syncManager.getQueueStatus();
console.log(`${status.count} actions en attente`);
```

## Migration progressive

Pour migrer progressivement vers le système offline :

1. **Nouveaux composants** : Utiliser directement `supabaseOffline`
2. **Composants existants** : Remplacer progressivement `supabase` par `supabaseOffline`
3. **Tests** : Tester en mode offline (DevTools > Network > Offline)

## Notes importantes

- Les données sont mises en cache automatiquement lors des requêtes en ligne
- Les actions offline sont synchronisées dans l'ordre d'ajout à la queue
- En cas d'erreur de synchronisation, l'action est réessayée jusqu'à 5 fois
- Le cache est limité à 1000 enregistrements par table pour éviter la surcharge


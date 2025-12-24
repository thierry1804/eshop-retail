# Configuration PWA - Mode Offline

L'application est maintenant configurée comme Progressive Web App (PWA) avec support complet du mode offline et synchronisation automatique.

## Fonctionnalités

### ✅ Mode Offline
- L'application fonctionne sans connexion internet
- Les données sont mises en cache automatiquement
- Les actions (création, modification, suppression) sont mises en queue et synchronisées automatiquement

### ✅ Synchronisation Automatique
- Détection automatique de la reconnexion
- Synchronisation périodique (toutes les 30 secondes)
- Indicateur visuel de l'état de connexion et de synchronisation

### ✅ Installation PWA
- L'application peut être installée sur l'écran d'accueil
- Fonctionne comme une application native
- Mise à jour automatique via service worker

## Installation

### 1. Créer les icônes PWA

Créez les icônes suivantes dans le dossier `public/` :
- `pwa-192x192.png` (192x192 pixels)
- `pwa-512x512.png` (512x512 pixels)
- `favicon.ico`
- `apple-touch-icon.png` (180x180 pixels)

Vous pouvez utiliser :
- https://realfavicongenerator.net/
- https://www.pwabuilder.com/imageGenerator

### 2. Build et déploiement

```bash
npm run build
```

Le build génère automatiquement :
- Le manifest PWA (`manifest.webmanifest`)
- Le service worker avec stratégies de cache
- Les fichiers optimisés pour le PWA

### 3. Tester le PWA

1. **En développement** :
   ```bash
   npm run dev
   ```
   Le service worker est activé en mode développement.

2. **En production** :
   - Déployez les fichiers du dossier `dist/`
   - Ouvrez l'application dans Chrome/Edge
   - Cliquez sur "Installer" dans la barre d'adresse
   - Ou utilisez le menu > "Installer l'application"

3. **Tester le mode offline** :
   - Ouvrez les DevTools (F12)
   - Allez dans l'onglet "Network"
   - Cochez "Offline"
   - L'application devrait continuer à fonctionner avec les données en cache

## Utilisation

### Indicateur Offline

Un indicateur apparaît en bas à droite de l'écran pour afficher :
- 🟡 **Mode hors ligne** : Pas de connexion internet
- 🔵 **Synchronisation en cours** : Données en cours de synchronisation
- 🟠 **Actions en attente** : Nombre d'actions en attente de synchronisation

### Synchronisation Manuelle

La synchronisation se fait automatiquement, mais vous pouvez aussi la forcer :

```typescript
import { syncManager } from './lib/offline/sync-manager';

// Synchroniser maintenant
await syncManager.sync();
```

### Utiliser le système offline dans vos composants

Voir `src/lib/offline/README.md` pour la documentation complète.

## Architecture Technique

### Service Worker
- Géré par `vite-plugin-pwa`
- Cache les assets statiques
- Cache les requêtes API Supabase (NetworkFirst)
- Cache les fichiers de stockage Supabase (CacheFirst)

### IndexedDB
- **Cache** : Stocke les données récupérées
- **Queue** : Stocke les actions à synchroniser
- **Metadata** : Timestamps et métadonnées

### Synchronisation
- Détection automatique de la reconnexion
- Synchronisation de la queue (insert, update, delete)
- Synchronisation des tables principales
- Gestion des erreurs et retry automatique

## Configuration

### Modifier l'intervalle de synchronisation

Dans `src/lib/offline/sync-manager.ts` :

```typescript
syncManager.startAutoSync(60000); // 60 secondes au lieu de 30
```

### Modifier les stratégies de cache

Dans `vite.config.ts`, section `workbox.runtimeCaching`.

## Dépannage

### Le service worker ne se charge pas
- Vérifiez que vous êtes en HTTPS (ou localhost)
- Videz le cache du navigateur
- Vérifiez la console pour les erreurs

### Les données ne se synchronisent pas
- Vérifiez la connexion internet
- Vérifiez la console pour les erreurs de synchronisation
- Vérifiez que l'utilisateur est bien authentifié

### L'application ne fonctionne pas en offline
- Vérifiez que le service worker est actif (DevTools > Application > Service Workers)
- Vérifiez que les données ont été mises en cache avant de passer en offline
- Vérifiez IndexedDB (DevTools > Application > IndexedDB)

## Support

Pour plus de détails sur l'utilisation du système offline, consultez :
- `src/lib/offline/README.md` - Documentation technique
- `src/hooks/useOnline.ts` - Hook de détection de connexion
- `src/hooks/useSyncStatus.ts` - Hook de statut de synchronisation


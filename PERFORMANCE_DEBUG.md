# 🔍 Guide de Debug des Performances

Ce guide explique comment utiliser les logs de performance ajoutés à l'application pour identifier les goulots d'étranglement.

## 📊 Logs Ajoutés

### 🚀 Application Principale (App.tsx)
- **Initialisation** : Temps de démarrage de l'application
- **Authentification** : Vérification de session et récupération du profil
- **Profil utilisateur** : Création/récupération du profil

### 📊 Dashboard
- **Récupération des données** : Ventes, paiements, clients
- **Traitement des données** : Calcul des statistiques
- **Meilleurs clients** : Tri et filtrage

### 👥 Liste des Clients
- **Récupération** : Temps de chargement de la liste
- **Filtrage** : Recherche en temps réel

### 🔐 Authentification
- **Connexion Supabase** : Temps de réponse de l'API
- **Validation** : Vérification des identifiants

## 🎯 Moniteur de Performance

Un bouton ⚡ apparaît en bas à droite de l'écran. Cliquez dessus pour afficher :

- **Moyenne des temps** : Performance générale
- **Plus lent** : Opération la plus lente
- **Historique** : 10 dernières opérations avec codes couleur :
  - 🟢 < 500ms : Bon
  - 🟡 500-1000ms : Moyen
  - 🔴 > 1000ms : Lent

## 🔍 Comment Identifier les Problèmes

### 1. **Temps de Connexion > 2s**
- Problème réseau ou Supabase
- Vérifier la latence de votre connexion

### 2. **Dashboard > 3s**
- Trop de données à traiter
- Considérer la pagination ou le cache

### 3. **Création de Profil > 1s**
- Problème avec les politiques RLS
- Vérifier la migration `20250901190400_fix_user_profiles_rls.sql`

### 4. **Liste des Clients > 2s**
- Trop de clients dans la base
- Ajouter une pagination

## 🛠️ Optimisations Possibles

### 1. **Cache des Données**
```typescript
// Exemple de cache simple
const [cachedData, setCachedData] = useState(null);
const [lastFetch, setLastFetch] = useState(0);

const fetchWithCache = async () => {
  const now = Date.now();
  if (cachedData && (now - lastFetch) < 30000) { // 30s cache
    return cachedData;
  }
  // ... fetch data
};
```

### 2. **Pagination**
```typescript
const { data } = await supabase
  .from('clients')
  .select('*')
  .range(0, 19) // 20 premiers
  .order('created_at', { ascending: false });
```

### 3. **Requêtes Optimisées**
```typescript
// Au lieu de récupérer tout et filtrer côté client
const { data } = await supabase
  .from('clients')
  .select('*')
  .ilike('first_name', `%${searchTerm}%`)
  .limit(50);
```

## 📱 Console Browser

Ouvrez la console (F12) pour voir tous les logs en temps réel :

```
🚀 App: Initialisation de l'application
🔍 App: Vérification de l'authentification...
✅ App: Session trouvée, récupération du profil utilisateur...
👤 App: Récupération du profil utilisateur...
📡 App: Requête pour récupérer le profil existant...
✅ App: Profil utilisateur trouvé: John Doe
⏱️ App: Récupération profil terminée en 245.67ms
```

## 🚨 Alertes de Performance

- **Rouge** : > 1000ms - Action requise
- **Orange** : 500-1000ms - À surveiller
- **Vert** : < 500ms - Bonne performance

## 🔧 Désactiver les Logs

Pour désactiver les logs en production, commentez les lignes `console.log` ou utilisez :

```typescript
const DEBUG = import.meta.env.DEV;
if (DEBUG) {
  console.log('Debug info');
}
```

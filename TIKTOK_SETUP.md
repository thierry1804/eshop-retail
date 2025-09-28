# Configuration TikTok Live

Ce guide explique comment configurer et utiliser le système de suivi des lives TikTok intégré à l'application.

## 🚀 Démarrage rapide

### 1. Configuration automatique

Le système configure automatiquement tout ce dont il a besoin ! Il suffit de :

```bash
npm run dev
```

Cette commande va :
- ✅ Vérifier et installer les dépendances du serveur TikTok
- ✅ Créer automatiquement le fichier `.env` si nécessaire
- ✅ Démarrer le serveur TikTok en mode développement
- ✅ Démarrer l'application React
- ✅ Afficher les logs des deux processus avec des couleurs différentes

### 2. Configuration manuelle (optionnelle)

Si vous voulez configurer manuellement :

```bash
# Installation des dépendances
npm run server:install

# Configuration
cd server
cp env.example .env
# Éditer .env avec votre username TikTok
```

### 3. Démarrage séparé (optionnel)

Si vous préférez démarrer les services séparément :

```bash
# Terminal 1 - Serveur TikTok
npm run server

# Terminal 2 - Application React
npm run dev:app-only
```

## 📋 Scripts disponibles

| Script | Description |
|--------|-------------|
| `npm run dev` | **Démarrage complet** - Serveur TikTok + App React |
| `npm run dev:app-only` | Application React uniquement |
| `npm run server` | Serveur TikTok en mode production |
| `npm run server:dev` | Serveur TikTok en mode développement |
| `npm run server:install` | Installation des dépendances du serveur |

## 🎯 Fonctionnalités

### Chat en temps réel
- Affichage du chat TikTok en direct
- Messages cliquables pour les commandes "JP"
- Filtre pour afficher seulement les messages "JP"
- Interface minimisable en bas à droite

### Création de ventes depuis TikTok
- Clic sur un message "JP" → ouverture du formulaire de vente
- Création automatique de client avec infos TikTok
- Association du message TikTok à la vente

### Reconnexion automatique
- Le serveur se reconnecte automatiquement en cas de déconnexion
- Gestion des erreurs et des timeouts
- Logs détaillés pour le débogage

## 🔧 Configuration avancée

### Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|---------|
| `TIKTOK_USERNAME` | Nom d'utilisateur TikTok (sans @) | - |
| `PORT` | Port du serveur HTTP | 3001 |
| `WS_PORT` | Port du serveur WebSocket | 3002 |

### Base de données

Les messages TikTok sont stockés en base de données (optionnel) :
- `tiktok_live_messages` - Messages du chat
- `tiktok_live_gifts` - Cadeaux reçus
- `tiktok_live_likes` - Likes reçus
- `tiktok_live_viewers` - Statistiques de spectateurs

## 🎮 Utilisation

### Interface utilisateur

1. **Chat TikTok** : Fenêtre flottante en bas à droite
2. **Statut de connexion** : Indicateur visuel (vert/rouge)
3. **Messages JP** : Surlignés en jaune et cliquables
4. **Filtre JP** : Case à cocher pour afficher seulement les commandes

### Création de vente

1. Cliquez sur un message "JP" dans le chat
2. Le formulaire de vente s'ouvre avec :
   - Informations du client TikTok pré-remplies
   - Possibilité de créer un nouveau client
   - Champs pour la description et le montant
3. Cliquez sur "Créer la vente"

## 🔍 Dépannage

### Le serveur ne se connecte pas
- Vérifiez que le compte TikTok est en live
- Vérifiez le nom d'utilisateur dans `.env`
- Consultez les logs du serveur

### Messages non reçus
- Vérifiez la connexion WebSocket (indicateur dans l'interface)
- Redémarrez le serveur si nécessaire
- Vérifiez que le live est actif

### Erreurs de connexion
- Le serveur tente de se reconnecter automatiquement
- Maximum 5 tentatives avec délai progressif
- Consultez les logs pour plus de détails

## 📊 API du serveur

### Endpoints HTTP
- `GET /status` - Statut de la connexion
- `POST /connect` - Forcer une connexion
- `POST /disconnect` - Déconnecter

### WebSocket
- Port : 3002 (configurable)
- Messages diffusés : chat, cadeaux, likes, spectateurs, statut

## ⚠️ Important

- Cette solution utilise une bibliothèque non-officielle
- Utilisez uniquement pour votre propre compte TikTok
- Respectez les conditions d'utilisation de TikTok
- Vérifiez la conformité légale avant utilisation en production

## 🛠️ Développement

### Structure des fichiers
```
server/
├── index.js          # Serveur principal
├── package.json      # Dépendances du serveur
├── .env             # Configuration (à créer)
└── README.md        # Documentation du serveur

src/components/TikTok/
├── TikTokLive.tsx        # Composant principal
├── TikTokLiveChat.tsx    # Interface du chat
└── TikTokSaleForm.tsx    # Formulaire de vente
```

### Logs
- Le serveur affiche des logs détaillés dans la console
- L'application affiche les erreurs dans l'interface
- Utilisez les outils de développement pour déboguer

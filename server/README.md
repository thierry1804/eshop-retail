# Serveur TikTok Live

Ce serveur permet de suivre en temps réel les lives TikTok et d'intégrer le chat avec le système de gestion des ventes.

## Installation

1. Installer les dépendances :
```bash
cd server
npm install
```

2. Configurer les variables d'environnement :
```bash
cp env.example .env
```

Éditer le fichier `.env` et configurer :
- `TIKTOK_USERNAME` : Votre nom d'utilisateur TikTok (sans le @)
- `PORT` : Port du serveur HTTP (défaut: 3001)
- `WS_PORT` : Port du serveur WebSocket (défaut: 3002)

## Utilisation

### Démarrage du serveur

```bash
# Mode développement (avec rechargement automatique)
npm run dev

# Mode production
npm start
```

### Connexion au live TikTok

Le serveur se connecte automatiquement au live TikTok quand :
1. Le serveur est démarré
2. Le compte TikTok spécifié est en live
3. La connexion est établie via WebSocket

### API Endpoints

- `GET /status` - Statut de la connexion TikTok
- `POST /connect` - Forcer une nouvelle connexion
- `POST /disconnect` - Déconnecter du live

### WebSocket

Le serveur expose un WebSocket sur le port configuré qui diffuse :
- Messages du chat
- Cadeaux reçus
- Likes
- Nombre de spectateurs
- Statut de connexion

## Intégration avec l'application

L'application React se connecte automatiquement au WebSocket et affiche :
- Chat en temps réel
- Messages "JP" cliquables pour créer des ventes
- Statut de connexion
- Nombre de spectateurs

## Fonctionnalités

### Détection des commandes "JP"
- Tous les messages commençant par "JP" sont automatiquement détectés
- Ces messages deviennent cliquables dans l'interface
- Permet de créer rapidement une vente depuis le chat

### Reconnexion automatique
- Le serveur tente de se reconnecter automatiquement en cas de déconnexion
- Délai progressif entre les tentatives (5s, 10s, 15s, etc.)
- Maximum 5 tentatives avant arrêt

### Stockage des données
- Les messages sont stockés en base de données (optionnel)
- Historique des messages, cadeaux, likes
- Statistiques de spectateurs

## Sécurité

⚠️ **Important** : Cette solution utilise une bibliothèque non-officielle pour accéder au chat TikTok. 

- Vérifiez les conditions d'utilisation de TikTok
- Utilisez uniquement pour votre propre compte
- Respectez les limites de taux et les bonnes pratiques

## Dépannage

### Le serveur ne se connecte pas
1. Vérifiez que le compte TikTok est en live
2. Vérifiez le nom d'utilisateur dans `.env`
3. Consultez les logs du serveur

### Messages non reçus
1. Vérifiez la connexion WebSocket
2. Vérifiez que le live est actif
3. Redémarrez le serveur si nécessaire

### Performance
- Le serveur garde en mémoire les 100 derniers messages
- Les anciens messages sont automatiquement supprimés
- Utilisez la base de données pour un historique complet

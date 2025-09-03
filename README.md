# FriperieManager - Application de Gestion Clientèle

Application web complète pour la gestion d'une boutique de vêtements de seconde main, développée avec React, TypeScript et Supabase.

## 🚀 Fonctionnalités

### 👥 Gestion des Utilisateurs
- Authentification sécurisée avec Supabase Auth
- Rôles : Administrateur et Employé
- Gestion des sessions et sécurité des données

### 👤 Gestion des Clients
- CRUD complet des clients
- Système de notation de confiance (bon/moyen/mauvais payeur)
- Recherche instantanée par nom et téléphone
- Historique complet des transactions

### 🛒 Gestion des Ventes
- Création de ventes avec description détaillée
- Support ventes au comptant et à crédit
- Calcul automatique des soldes
- Statuts automatiques (en cours/réglée)

### 💰 Suivi des Paiements
- Enregistrement des paiements par différents moyens
- Mise à jour automatique des soldes
- Historique chronologique détaillé

### 📊 Tableau de Bord
- Statistiques en temps réel
- Indicateurs de performance
- Vue d'ensemble des créances
- Top clients

### 📄 Livre de Compte Client
- Historique complet par client
- Export PDF des relevés
- Résumé financier détaillé

## 🛠️ Technologies

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **Build Tool**: Vite
- **Icônes**: Lucide React
- **Export PDF**: jsPDF

## 📋 Prérequis

1. Node.js 18+ 
2. Compte Supabase
3. Navigateur moderne

## 🚀 Installation

1. **Cloner le projet**
```bash
git clone <repository-url>
cd friperie-manager
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configuration Supabase**
   - Créer un nouveau projet sur [Supabase](https://supabase.com)
   - Copier `.env.example` vers `.env`
   - Remplir les variables avec vos clés Supabase

4. **Initialiser la base de données**
   - Les migrations se trouvent dans `/supabase/migrations/`
   - Exécuter les migrations dans l'ordre dans l'éditeur SQL Supabase

5. **Lancer l'application**
```bash
npm run dev
```

## 🔐 Configuration de l'Authentification

1. Dans le dashboard Supabase, aller dans Authentication > Settings
2. Désactiver "Enable email confirmations" pour simplifier les tests
3. Créer les premiers utilisateurs via l'interface Supabase Auth

## 📁 Structure du Projet

```
src/
├── components/
│   ├── Auth/           # Composants d'authentification
│   ├── Dashboard/      # Tableau de bord et statistiques
│   ├── Clients/        # Gestion des clients
│   ├── Sales/          # Gestion des ventes
│   ├── Payments/       # Gestion des paiements
│   └── Layout/         # Composants de mise en page
├── lib/                # Configuration et utilitaires
├── types/              # Définitions TypeScript
└── App.tsx            # Composant principal

supabase/
└── migrations/         # Scripts de migration de base de données
```

## 🎯 Utilisation

### Premier Démarrage
1. Créer un utilisateur admin via l'interface Supabase
2. Se connecter avec ces identifiants
3. Commencer par ajouter des clients
4. Créer des ventes et enregistrer des paiements

### Workflow Typique
1. **Nouveau Client**: Ajouter les informations client avec évaluation de confiance
2. **Nouvelle Vente**: Créer une vente avec description détaillée et acompte éventuel
3. **Suivi Paiements**: Enregistrer les paiements au fur et à mesure
4. **Tableau de Bord**: Surveiller les indicateurs clés et créances

## 🔒 Sécurité

- Row Level Security (RLS) activé sur toutes les tables
- Authentification requise pour toutes les opérations
- Validation des données côté client et serveur
- Contrôles d'intégrité des montants

## 📱 Responsive Design

L'application est entièrement responsive avec des breakpoints optimisés pour :
- Mobile (< 768px)
- Tablette (768px - 1024px)  
- Desktop (> 1024px)

## 🚀 Déploiement

L'application peut être déployée sur Vercel, Netlify ou tout autre service supportant les applications React.

## 🆘 Support

En cas de problème, vérifier :
1. La configuration des variables d'environnement
2. L'exécution des migrations de base de données
3. Les paramètres d'authentification Supabase
4. Les logs de la console navigateur

## 📄 Licence

Ce projet est développé pour usage commercial dans le cadre de la gestion d'une boutique de friperie.
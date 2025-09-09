# 🚀 Guide de Configuration - FriperieManager

## ❌ Problème : Page blanche avec spinner

Si vous voyez une page blanche avec un spinner de chargement, c'est probablement dû à une configuration manquante.

## ✅ Solution : Configuration Supabase

### 1. **Créer le fichier `.env`**

À la racine du projet, créez un fichier `.env` avec le contenu suivant :

```env
VITE_SUPABASE_URL=votre_url_supabase
VITE_SUPABASE_ANON_KEY=votre_clé_anon_supabase
```

### 2. **Récupérer vos clés Supabase**

1. Allez sur [supabase.com](https://supabase.com)
2. Connectez-vous à votre compte
3. Sélectionnez votre projet
4. Allez dans **Settings** → **API**
5. Copiez :
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** → `VITE_SUPABASE_ANON_KEY`

### 3. **Exemple de fichier `.env`**

```env
VITE_SUPABASE_URL=https://gobzmzpfgqcfvsoakvrn.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvYnptenBmZ3FjZnZzb2FrdnJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU2NzI5NzEsImV4cCI6MjA1MTI0ODk3MX0.example
```

### 4. **Redémarrer le serveur**

```bash
# Arrêtez le serveur (Ctrl+C)
# Puis redémarrez
npm run dev
```

## 🔧 Vérification

Après avoir créé le fichier `.env`, vous devriez voir :

1. **Plus de page blanche** ✅
2. **Formulaire de connexion** ✅
3. **Logs dans la console** ✅

## 🚨 Erreurs courantes

### "Variables d'environnement manquantes"
- Vérifiez que le fichier `.env` est à la racine du projet
- Vérifiez que les noms des variables commencent par `VITE_`

### "Invalid API key"
- Vérifiez que vous avez copié la bonne clé (anon public)
- Vérifiez qu'il n'y a pas d'espaces en trop

### "Project not found"
- Vérifiez que l'URL du projet est correcte
- Vérifiez que votre projet Supabase est actif

## 📋 Checklist

- [ ] Fichier `.env` créé à la racine
- [ ] `VITE_SUPABASE_URL` défini
- [ ] `VITE_SUPABASE_ANON_KEY` défini
- [ ] Serveur redémarré
- [ ] Page se charge correctement

## 🆘 Aide supplémentaire

Si le problème persiste :

1. **Vérifiez la console** (F12) pour les erreurs
2. **Vérifiez les logs** de performance
3. **Vérifiez votre connexion internet**
4. **Vérifiez que Supabase est accessible**

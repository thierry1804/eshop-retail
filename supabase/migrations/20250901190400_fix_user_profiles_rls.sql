/*
  # Correction de la politique RLS pour user_profiles
  
  Problème: La politique d'insertion était manquante pour la table user_profiles,
  ce qui causait l'erreur "new row violates row-level security policy"
  
  Solution: Ajouter la politique d'insertion pour permettre aux utilisateurs
  authentifiés de créer leur propre profil
*/

-- Ajouter la politique d'insertion manquante pour user_profiles
CREATE POLICY "Users can insert their own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

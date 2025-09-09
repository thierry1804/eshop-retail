-- Migration pour restreindre l'accès aux logs uniquement à thierry1804@gmail.com

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "Users can view their own logs" ON user_logs;
DROP POLICY IF EXISTS "Admins can view all logs" ON user_logs;

-- Créer une nouvelle politique restrictive pour les logs
-- Seul thierry1804@gmail.com peut voir tous les logs
CREATE POLICY "Only thierry1804 can view all logs" ON user_logs
  FOR SELECT USING (
    auth.jwt() ->> 'email' = 'thierry1804@gmail.com'
  );

-- Politique : tous les utilisateurs connectés peuvent insérer des logs (inchangée)
-- Cette politique existe déjà, on la garde pour permettre l'enregistrement des logs

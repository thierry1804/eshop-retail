-- Créer la table user_logs pour tracer toutes les actions des utilisateurs
CREATE TABLE IF NOT EXISTS user_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  page TEXT NOT NULL,
  url TEXT NOT NULL,
  component TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_user_logs_user_id ON user_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_logs_timestamp ON user_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_logs_action ON user_logs(action);
CREATE INDEX IF NOT EXISTS idx_user_logs_page ON user_logs(page);
CREATE INDEX IF NOT EXISTS idx_user_logs_component ON user_logs(component);

-- RLS (Row Level Security)
ALTER TABLE user_logs ENABLE ROW LEVEL SECURITY;

-- Politique : les utilisateurs peuvent voir leurs propres logs
CREATE POLICY "Users can view their own logs" ON user_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Politique : les admins peuvent voir tous les logs
CREATE POLICY "Admins can view all logs" ON user_logs
  FOR SELECT USING (
    auth.jwt() ->> 'email' IN (
      'laoban@eshopbyvalsue.mg',
      'admin@eshopbyvalsue.mg',
      'thierry1804@gmail.com'
    )
  );

-- Politique : tous les utilisateurs connectés peuvent insérer des logs
CREATE POLICY "Authenticated users can insert logs" ON user_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Fonction pour nettoyer les anciens logs (garder seulement 30 jours)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM user_logs 
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Créer un job pour nettoyer automatiquement les anciens logs (à exécuter manuellement ou via cron)
-- SELECT cron.schedule('cleanup-logs', '0 2 * * *', 'SELECT cleanup_old_logs();');

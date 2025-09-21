/*
  # Ajout des champs TikTok aux clients

  Cette migration ajoute deux nouveaux champs facultatifs à la table clients :
  - tiktok_id : Identifiant TikTok du client (optionnel)
  - tiktok_nick_name : Nom d'utilisateur TikTok du client (optionnel)

  Ces champs permettront de lier les clients à leurs profils TikTok pour un meilleur suivi.
*/

-- Ajouter les nouveaux champs à la table clients
ALTER TABLE clients 
ADD COLUMN tiktok_id text,
ADD COLUMN tiktok_nick_name text;

-- Ajouter des commentaires pour documenter les nouveaux champs
COMMENT ON COLUMN clients.tiktok_id IS 'Identifiant TikTok du client (optionnel)';
COMMENT ON COLUMN clients.tiktok_nick_name IS 'Nom d''utilisateur TikTok du client (optionnel)';

-- Créer un index sur tiktok_id pour les recherches rapides (si nécessaire)
CREATE INDEX IF NOT EXISTS idx_clients_tiktok_id ON clients(tiktok_id) WHERE tiktok_id IS NOT NULL;


-- Création des tables pour TikTok Live
-- Table pour stocker les messages du chat TikTok
CREATE TABLE IF NOT EXISTS tiktok_live_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    unique_id TEXT NOT NULL,
    nickname TEXT NOT NULL,
    comment TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    is_jp BOOLEAN DEFAULT FALSE,
    user_id TEXT,
    profile_picture_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table pour stocker les cadeaux TikTok
CREATE TABLE IF NOT EXISTS tiktok_live_gifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    unique_id TEXT NOT NULL,
    nickname TEXT NOT NULL,
    gift_name TEXT NOT NULL,
    repeat_count INTEGER DEFAULT 1,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table pour stocker les likes TikTok
CREATE TABLE IF NOT EXISTS tiktok_live_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    unique_id TEXT NOT NULL,
    nickname TEXT NOT NULL,
    like_count INTEGER DEFAULT 1,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table pour stocker les statistiques de spectateurs
CREATE TABLE IF NOT EXISTS tiktok_live_viewers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    viewer_count INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table pour stocker l'état de connexion TikTok
CREATE TABLE IF NOT EXISTS tiktok_live_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('connected', 'disconnected', 'connecting')),
    room_id TEXT,
    username TEXT,
    reconnect_attempts INTEGER DEFAULT 0,
    last_connected TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_tiktok_messages_timestamp ON tiktok_live_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tiktok_messages_is_jp ON tiktok_live_messages(is_jp) WHERE is_jp = TRUE;
CREATE INDEX IF NOT EXISTS idx_tiktok_messages_unique_id ON tiktok_live_messages(unique_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_gifts_timestamp ON tiktok_live_gifts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tiktok_likes_timestamp ON tiktok_live_likes(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tiktok_viewers_timestamp ON tiktok_live_viewers(timestamp DESC);

-- RLS (Row Level Security) - permettre l'accès à tous les utilisateurs authentifiés
ALTER TABLE tiktok_live_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiktok_live_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiktok_live_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiktok_live_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiktok_live_connections ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour permettre la lecture et écriture à tous les utilisateurs authentifiés
CREATE POLICY "Allow authenticated users to read tiktok messages" ON tiktok_live_messages
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert tiktok messages" ON tiktok_live_messages
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read tiktok gifts" ON tiktok_live_gifts
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert tiktok gifts" ON tiktok_live_gifts
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read tiktok likes" ON tiktok_live_likes
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert tiktok likes" ON tiktok_live_likes
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read tiktok viewers" ON tiktok_live_viewers
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert tiktok viewers" ON tiktok_live_viewers
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read tiktok connections" ON tiktok_live_connections
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert tiktok connections" ON tiktok_live_connections
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update tiktok connections" ON tiktok_live_connections
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_tiktok_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour automatiquement updated_at
CREATE TRIGGER trigger_update_tiktok_connections_updated_at
    BEFORE UPDATE ON tiktok_live_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_tiktok_connections_updated_at();

-- Commentaires pour la documentation
COMMENT ON TABLE tiktok_live_messages IS 'Messages du chat TikTok Live';
COMMENT ON TABLE tiktok_live_gifts IS 'Cadeaux reçus pendant les lives TikTok';
COMMENT ON TABLE tiktok_live_likes IS 'Likes reçus pendant les lives TikTok';
COMMENT ON TABLE tiktok_live_viewers IS 'Statistiques de spectateurs TikTok Live';
COMMENT ON TABLE tiktok_live_connections IS 'État des connexions TikTok Live';

COMMENT ON COLUMN tiktok_live_messages.is_jp IS 'Indique si le message commence par "JP" (commande)';
COMMENT ON COLUMN tiktok_live_messages.unique_id IS 'Identifiant unique TikTok de l\'utilisateur';
COMMENT ON COLUMN tiktok_live_messages.user_id IS 'ID utilisateur TikTok';
COMMENT ON COLUMN tiktok_live_messages.profile_picture_url IS 'URL de la photo de profil TikTok';

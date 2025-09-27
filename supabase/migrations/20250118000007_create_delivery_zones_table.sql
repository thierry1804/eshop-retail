-- Migration pour créer la table des zones de livraison
CREATE TABLE IF NOT EXISTS delivery_zones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    estimated_delivery_time INTEGER NOT NULL DEFAULT 24, -- en heures
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_delivery_zones_active ON delivery_zones(is_active);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_name ON delivery_zones(name);

-- RLS (Row Level Security)
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre la lecture à tous les utilisateurs authentifiés
CREATE POLICY "Allow read access to authenticated users" ON delivery_zones
    FOR SELECT USING (auth.role() = 'authenticated');

-- Politique pour permettre l'insertion aux utilisateurs authentifiés
CREATE POLICY "Allow insert to authenticated users" ON delivery_zones
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Politique pour permettre la mise à jour aux utilisateurs authentifiés
CREATE POLICY "Allow update to authenticated users" ON delivery_zones
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Politique pour permettre la suppression aux utilisateurs authentifiés
CREATE POLICY "Allow delete to authenticated users" ON delivery_zones
    FOR DELETE USING (auth.role() = 'authenticated');

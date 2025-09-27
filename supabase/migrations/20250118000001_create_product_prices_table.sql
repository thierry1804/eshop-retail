-- Migration pour créer la table des prix des produits
CREATE TABLE IF NOT EXISTS product_prices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price_type VARCHAR(20) NOT NULL CHECK (price_type IN ('retail', 'wholesale', 'distributor', 'reseller')),
    price DECIMAL(12,2) NOT NULL CHECK (price >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'MGA',
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_product_prices_product ON product_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_type ON product_prices(price_type);
CREATE INDEX IF NOT EXISTS idx_product_prices_active ON product_prices(is_active);
CREATE INDEX IF NOT EXISTS idx_product_prices_valid_from ON product_prices(valid_from);
CREATE INDEX IF NOT EXISTS idx_product_prices_valid_to ON product_prices(valid_to);

-- RLS (Row Level Security)
ALTER TABLE product_prices ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre la lecture à tous les utilisateurs authentifiés
CREATE POLICY "Allow read access to authenticated users" ON product_prices
    FOR SELECT USING (auth.role() = 'authenticated');

-- Politique pour permettre l'insertion aux utilisateurs authentifiés
CREATE POLICY "Allow insert to authenticated users" ON product_prices
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Politique pour permettre la mise à jour aux utilisateurs authentifiés
CREATE POLICY "Allow update to authenticated users" ON product_prices
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Politique pour permettre la suppression aux utilisateurs authentifiés
CREATE POLICY "Allow delete to authenticated users" ON product_prices
    FOR DELETE USING (auth.role() = 'authenticated');

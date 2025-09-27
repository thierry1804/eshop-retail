-- Migration pour créer la table des articles de livraison
CREATE TABLE IF NOT EXISTS delivery_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
    total_price DECIMAL(12,2) NOT NULL CHECK (total_price >= 0),
    weight DECIMAL(10,3),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery ON delivery_items(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_product ON delivery_items(product_id);

-- RLS (Row Level Security)
ALTER TABLE delivery_items ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre la lecture à tous les utilisateurs authentifiés
CREATE POLICY "Allow read access to authenticated users" ON delivery_items
    FOR SELECT USING (auth.role() = 'authenticated');

-- Politique pour permettre l'insertion aux utilisateurs authentifiés
CREATE POLICY "Allow insert to authenticated users" ON delivery_items
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Politique pour permettre la mise à jour aux utilisateurs authentifiés
CREATE POLICY "Allow update to authenticated users" ON delivery_items
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Politique pour permettre la suppression aux utilisateurs authentifiés
CREATE POLICY "Allow delete to authenticated users" ON delivery_items
    FOR DELETE USING (auth.role() = 'authenticated');

-- Migration pour créer la table des mouvements de stock
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment', 'transfer')),
    quantity INTEGER NOT NULL,
    reference_type VARCHAR(20) CHECK (reference_type IN ('purchase', 'sale', 'adjustment', 'transfer', 'return')),
    reference_id UUID,
    reason VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);

-- RLS (Row Level Security)
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre la lecture à tous les utilisateurs authentifiés
CREATE POLICY "Allow read access to authenticated users" ON stock_movements
    FOR SELECT USING (auth.role() = 'authenticated');

-- Politique pour permettre l'insertion aux utilisateurs authentifiés
CREATE POLICY "Allow insert to authenticated users" ON stock_movements
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Politique pour permettre la mise à jour aux utilisateurs authentifiés
CREATE POLICY "Allow update to authenticated users" ON stock_movements
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Politique pour permettre la suppression aux utilisateurs authentifiés
CREATE POLICY "Allow delete to authenticated users" ON stock_movements
    FOR DELETE USING (auth.role() = 'authenticated');

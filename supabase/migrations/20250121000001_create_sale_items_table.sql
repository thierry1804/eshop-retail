-- Création de la table sale_items pour les articles de vente
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    product_sku TEXT,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_created_at ON sale_items(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour permettre la lecture et écriture à tous les utilisateurs authentifiés
CREATE POLICY "Allow authenticated users to read sale items" ON sale_items
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert sale items" ON sale_items
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update sale items" ON sale_items
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete sale items" ON sale_items
    FOR DELETE USING (auth.role() = 'authenticated');

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_sale_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour automatiquement updated_at
CREATE TRIGGER trigger_update_sale_items_updated_at
    BEFORE UPDATE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_sale_items_updated_at();

-- Commentaires pour la documentation
COMMENT ON TABLE sale_items IS 'Articles individuels dans une vente';
COMMENT ON COLUMN sale_items.product_name IS 'Nom du produit (peut inclure des codes comme JP202501211430 - Nom du produit)';
COMMENT ON COLUMN sale_items.product_sku IS 'Code SKU du produit (optionnel)';
COMMENT ON COLUMN sale_items.quantity IS 'Quantité vendue';
COMMENT ON COLUMN sale_items.unit_price IS 'Prix unitaire';
COMMENT ON COLUMN sale_items.total_price IS 'Prix total pour cette ligne (quantity * unit_price)';

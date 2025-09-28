-- Création de la table des réceptions
CREATE TABLE receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
    supplier_id UUID REFERENCES suppliers(id),
    supplier_name VARCHAR(255),
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'partial', 'complete')),
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'MGA',
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX idx_receipts_purchase_order ON receipts(purchase_order_id);
CREATE INDEX idx_receipts_supplier ON receipts(supplier_id);
CREATE INDEX idx_receipts_date ON receipts(receipt_date);
CREATE INDEX idx_receipts_status ON receipts(status);
CREATE INDEX idx_receipts_created_by ON receipts(created_by);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_receipts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_receipts_updated_at
    BEFORE UPDATE ON receipts
    FOR EACH ROW
    EXECUTE FUNCTION update_receipts_updated_at();

-- RLS (Row Level Security)
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre la lecture à tous les utilisateurs authentifiés
CREATE POLICY "Users can view receipts" ON receipts
    FOR SELECT USING (auth.role() = 'authenticated');

-- Politique pour permettre l'insertion aux utilisateurs authentifiés
CREATE POLICY "Users can insert receipts" ON receipts
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Politique pour permettre la mise à jour aux utilisateurs authentifiés
CREATE POLICY "Users can update receipts" ON receipts
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Politique pour permettre la suppression aux utilisateurs authentifiés
CREATE POLICY "Users can delete receipts" ON receipts
    FOR DELETE USING (auth.role() = 'authenticated');

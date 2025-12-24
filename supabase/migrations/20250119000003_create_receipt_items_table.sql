-- Création de la table des articles de réception
CREATE TABLE receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    purchase_order_item_id UUID NOT NULL REFERENCES purchase_order_items(id),
    product_id UUID NOT NULL REFERENCES products(id),
    quantity_received INTEGER NOT NULL CHECK (quantity_received > 0),
    unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
    total_price DECIMAL(15,2) NOT NULL CHECK (total_price >= 0),
    batch_number VARCHAR(100),
    expiry_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX idx_receipt_items_receipt ON receipt_items(receipt_id);
CREATE INDEX idx_receipt_items_purchase_order_item ON receipt_items(purchase_order_item_id);
CREATE INDEX idx_receipt_items_product ON receipt_items(product_id);
CREATE INDEX idx_receipt_items_batch ON receipt_items(batch_number);

-- Trigger pour calculer automatiquement le total_price
CREATE OR REPLACE FUNCTION calculate_receipt_item_total()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_price = NEW.quantity_received * NEW.unit_price;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_receipt_item_total
    BEFORE INSERT OR UPDATE ON receipt_items
    FOR EACH ROW
    EXECUTE FUNCTION calculate_receipt_item_total();

-- Trigger pour mettre à jour le montant total de la réception
CREATE OR REPLACE FUNCTION update_receipt_total()
RETURNS TRIGGER AS $$
BEGIN
    -- Mettre à jour le montant total de la réception
    UPDATE receipts 
    SET total_amount = (
        SELECT COALESCE(SUM(total_price), 0)
        FROM receipt_items 
        WHERE receipt_id = COALESCE(NEW.receipt_id, OLD.receipt_id)
    ),
    updated_at = NOW()
    WHERE id = COALESCE(NEW.receipt_id, OLD.receipt_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_receipt_total
    AFTER INSERT OR UPDATE OR DELETE ON receipt_items
    FOR EACH ROW
    EXECUTE FUNCTION update_receipt_total();

-- Trigger pour mettre à jour les quantités reçues dans purchase_order_items
CREATE OR REPLACE FUNCTION update_purchase_order_quantities()
RETURNS TRIGGER AS $$
BEGIN
    -- Mettre à jour la quantité reçue dans purchase_order_items
    UPDATE purchase_order_items 
    SET quantity_received = (
        SELECT COALESCE(SUM(quantity_received), 0)
        FROM receipt_items 
        WHERE purchase_order_item_id = COALESCE(NEW.purchase_order_item_id, OLD.purchase_order_item_id)
    ),
    updated_at = NOW()
    WHERE id = COALESCE(NEW.purchase_order_item_id, OLD.purchase_order_item_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_purchase_order_quantities
    AFTER INSERT OR UPDATE OR DELETE ON receipt_items
    FOR EACH ROW
    EXECUTE FUNCTION update_purchase_order_quantities();

-- RLS (Row Level Security)
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre la lecture à tous les utilisateurs authentifiés
CREATE POLICY "Users can view receipt items" ON receipt_items
    FOR SELECT USING (auth.role() = 'authenticated');

-- Politique pour permettre l'insertion aux utilisateurs authentifiés
CREATE POLICY "Users can insert receipt items" ON receipt_items
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Politique pour permettre la mise à jour aux utilisateurs authentifiés
CREATE POLICY "Users can update receipt items" ON receipt_items
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Politique pour permettre la suppression aux utilisateurs authentifiés
CREATE POLICY "Users can delete receipt items" ON receipt_items
    FOR DELETE USING (auth.role() = 'authenticated');

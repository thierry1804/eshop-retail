-- Triggers pour l'approvisionnement et la mise à jour automatique du stock

-- Fonction pour générer automatiquement les numéros de commande
CREATE OR REPLACE FUNCTION generate_purchase_order_number()
RETURNS TRIGGER AS $$
DECLARE
    next_number INTEGER;
    order_prefix VARCHAR(10);
    generated_order_number VARCHAR(50);
BEGIN
    -- Préfixe basé sur l'année
    order_prefix := 'PO-' || TO_CHAR(NEW.order_date, 'YYYY');
    
    -- Récupérer le prochain numéro de séquence
    SELECT COALESCE(MAX(CAST(SUBSTRING(purchase_orders.order_number FROM LENGTH(order_prefix) + 2) AS INTEGER)), 0) + 1
    INTO next_number
    FROM purchase_orders
    WHERE purchase_orders.order_number LIKE order_prefix || '-%';
    
    -- Générer le numéro de commande
    generated_order_number := order_prefix || '-' || LPAD(next_number::TEXT, 4, '0');
    
    NEW.order_number := generated_order_number;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_purchase_order_number
    BEFORE INSERT ON purchase_orders
    FOR EACH ROW
    WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
    EXECUTE FUNCTION generate_purchase_order_number();

-- Fonction pour générer automatiquement les numéros de réception
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TRIGGER AS $$
DECLARE
    next_number INTEGER;
    receipt_prefix VARCHAR(10);
    generated_receipt_number VARCHAR(50);
BEGIN
    -- Préfixe basé sur l'année
    receipt_prefix := 'RC-' || TO_CHAR(NEW.receipt_date, 'YYYY');
    
    -- Récupérer le prochain numéro de séquence
    SELECT COALESCE(MAX(CAST(SUBSTRING(receipts.receipt_number FROM LENGTH(receipt_prefix) + 2) AS INTEGER)), 0) + 1
    INTO next_number
    FROM receipts
    WHERE receipts.receipt_number LIKE receipt_prefix || '-%';
    
    -- Générer le numéro de réception
    generated_receipt_number := receipt_prefix || '-' || LPAD(next_number::TEXT, 4, '0');
    
    NEW.receipt_number := generated_receipt_number;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_receipt_number
    BEFORE INSERT ON receipts
    FOR EACH ROW
    WHEN (NEW.receipt_number IS NULL OR NEW.receipt_number = '')
    EXECUTE FUNCTION generate_receipt_number();

-- Fonction pour mettre à jour automatiquement le statut des commandes d'achat
CREATE OR REPLACE FUNCTION update_purchase_order_status()
RETURNS TRIGGER AS $$
DECLARE
    total_ordered INTEGER;
    total_received INTEGER;
    new_status VARCHAR(20);
BEGIN
    -- Calculer les quantités totales pour la commande
    SELECT 
        COALESCE(SUM(quantity_ordered), 0),
        COALESCE(SUM(quantity_received), 0)
    INTO total_ordered, total_received
    FROM purchase_order_items
    WHERE purchase_order_id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);
    
    -- Déterminer le nouveau statut
    IF total_received = 0 THEN
        new_status := 'ordered';
    ELSIF total_received < total_ordered THEN
        new_status := 'partial';
    ELSE
        new_status := 'received';
    END IF;
    
    -- Mettre à jour le statut de la commande
    UPDATE purchase_orders 
    SET status = new_status, updated_at = NOW()
    WHERE id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_purchase_order_status
    AFTER INSERT OR UPDATE OR DELETE ON purchase_order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_purchase_order_status();

-- Fonction pour créer automatiquement les mouvements de stock lors de la réception
CREATE OR REPLACE FUNCTION create_stock_movement_on_receipt()
RETURNS TRIGGER AS $$
DECLARE
    receipt_created_by UUID;
BEGIN
    -- Récupérer l'utilisateur qui a créé la réception
    SELECT created_by INTO receipt_created_by
    FROM receipts
    WHERE id = NEW.receipt_id;
    
    -- Créer un mouvement de stock pour l'entrée
    INSERT INTO stock_movements (
        product_id,
        movement_type,
        quantity,
        reason,
        reference_type,
        reference_id,
        notes,
        created_by
    ) VALUES (
        NEW.product_id,
        'in',
        NEW.quantity_received,
        'Réception de marchandise',
        'purchase',
        NEW.receipt_id,
        COALESCE(NEW.notes, 'Réception automatique'),
        receipt_created_by
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_stock_movement_on_receipt
    AFTER INSERT ON receipt_items
    FOR EACH ROW
    EXECUTE FUNCTION create_stock_movement_on_receipt();

-- Migration pour corriger les triggers d'approvisionnement
-- Résoudre le conflit de noms dans les fonctions de génération de numéros

-- Supprimer les anciens triggers
DROP TRIGGER IF EXISTS trigger_generate_purchase_order_number ON purchase_orders;
DROP TRIGGER IF EXISTS trigger_generate_receipt_number ON receipts;
DROP TRIGGER IF EXISTS trigger_create_stock_movement_on_receipt ON receipt_items;

-- Supprimer les anciennes fonctions
DROP FUNCTION IF EXISTS generate_purchase_order_number();
DROP FUNCTION IF EXISTS generate_receipt_number();
DROP FUNCTION IF EXISTS create_stock_movement_on_receipt();

-- Recréer la fonction pour générer automatiquement les numéros de commande
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

-- Recréer la fonction pour générer automatiquement les numéros de réception
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

-- Recréer les triggers
CREATE TRIGGER trigger_generate_purchase_order_number
    BEFORE INSERT ON purchase_orders
    FOR EACH ROW
    WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
    EXECUTE FUNCTION generate_purchase_order_number();

CREATE TRIGGER trigger_generate_receipt_number
    BEFORE INSERT ON receipts
    FOR EACH ROW
    WHEN (NEW.receipt_number IS NULL OR NEW.receipt_number = '')
    EXECUTE FUNCTION generate_receipt_number();

-- Recréer la fonction pour créer automatiquement les mouvements de stock lors de la réception
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

-- Recréer le trigger pour les mouvements de stock
CREATE TRIGGER trigger_create_stock_movement_on_receipt
    AFTER INSERT ON receipt_items
    FOR EACH ROW
    EXECUTE FUNCTION create_stock_movement_on_receipt();

-- Migration pour créer les triggers de gestion automatique du stock

-- Fonction pour mettre à jour le stock disponible
CREATE OR REPLACE FUNCTION update_available_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- Mettre à jour le stock disponible (current_stock - reserved_stock)
    UPDATE products 
    SET available_stock = current_stock - reserved_stock
    WHERE id = NEW.product_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour le stock disponible après modification du stock
CREATE TRIGGER trigger_update_available_stock
    AFTER UPDATE OF current_stock, reserved_stock ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_available_stock();

-- Fonction pour créer automatiquement des alertes de stock
CREATE OR REPLACE FUNCTION check_stock_alerts()
RETURNS TRIGGER AS $$
DECLARE
    product_record RECORD;
BEGIN
    -- Récupérer les informations du produit
    SELECT * INTO product_record FROM products WHERE id = NEW.product_id;
    
    -- Vérifier les alertes de stock bas
    IF product_record.current_stock <= product_record.min_stock_level THEN
        INSERT INTO stock_alerts (product_id, alert_type, threshold_value, current_value)
        VALUES (product_record.id, 'low_stock', product_record.min_stock_level, product_record.current_stock)
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- Vérifier les alertes de stock épuisé
    IF product_record.current_stock = 0 THEN
        INSERT INTO stock_alerts (product_id, alert_type, threshold_value, current_value)
        VALUES (product_record.id, 'out_of_stock', 0, product_record.current_stock)
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- Vérifier les alertes de surstock
    IF product_record.max_stock_level IS NOT NULL AND product_record.current_stock > product_record.max_stock_level THEN
        INSERT INTO stock_alerts (product_id, alert_type, threshold_value, current_value)
        VALUES (product_record.id, 'overstock', product_record.max_stock_level, product_record.current_stock)
        ON CONFLICT DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour vérifier les alertes après mise à jour du stock
CREATE TRIGGER trigger_check_stock_alerts
    AFTER UPDATE OF current_stock ON products
    FOR EACH ROW
    EXECUTE FUNCTION check_stock_alerts();

-- Fonction pour générer automatiquement le numéro de livraison
CREATE OR REPLACE FUNCTION generate_delivery_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.delivery_number IS NULL OR NEW.delivery_number = '' THEN
        NEW.delivery_number := 'DEL-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('delivery_sequence')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer une séquence pour les numéros de livraison
CREATE SEQUENCE IF NOT EXISTS delivery_sequence START 1;

-- Trigger pour générer automatiquement le numéro de livraison
CREATE TRIGGER trigger_generate_delivery_number
    BEFORE INSERT ON deliveries
    FOR EACH ROW
    EXECUTE FUNCTION generate_delivery_number();

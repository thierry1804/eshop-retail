-- Migration pour ajouter le champ transit_cost (frais de transit) aux receipt_items
-- Ce coût est calculé automatiquement à partir du tracking number

-- Ajouter la colonne transit_cost
ALTER TABLE receipt_items
ADD COLUMN IF NOT EXISTS transit_cost DECIMAL(15,2) DEFAULT 0 CHECK (transit_cost >= 0);

-- Fonction pour calculer automatiquement le transit_cost
CREATE OR REPLACE FUNCTION calculate_transit_cost()
RETURNS TRIGGER AS $$
DECLARE
    order_tracking_number VARCHAR(100);
    tracking_cost_mga DECIMAL(15,2);
    total_products_count INTEGER;
    calculated_transit_cost DECIMAL(15,2);
BEGIN
    -- Récupérer le tracking_number de la commande d'achat
    SELECT po.tracking_number INTO order_tracking_number
    FROM purchase_orders po
    JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
    WHERE poi.id = NEW.purchase_order_item_id;
    
    -- Si pas de tracking_number, transit_cost = 0
    IF order_tracking_number IS NULL OR order_tracking_number = '' THEN
        NEW.transit_cost := 0;
        RETURN NEW;
    END IF;
    
    -- Récupérer le coût total du tracking number (en MGA)
    SELECT total_cost_mga INTO tracking_cost_mga
    FROM tracking_numbers
    WHERE tracking_number = order_tracking_number
    LIMIT 1;
    
    -- Si pas de coût trouvé, transit_cost = 0
    IF tracking_cost_mga IS NULL OR tracking_cost_mga = 0 THEN
        NEW.transit_cost := 0;
        RETURN NEW;
    END IF;
    
    -- Compter le nombre total de produits dans toutes les commandes ayant ce tracking_number
    -- On compte les lignes d'articles (purchase_order_items) de toutes les commandes
    SELECT COUNT(*) INTO total_products_count
    FROM purchase_order_items poi
    JOIN purchase_orders po ON po.id = poi.purchase_order_id
    WHERE po.tracking_number = order_tracking_number;
    
    -- Si pas de produits, transit_cost = 0
    IF total_products_count IS NULL OR total_products_count = 0 THEN
        NEW.transit_cost := 0;
        RETURN NEW;
    END IF;
    
    -- Calculer le frais de transit par produit : coût total / nombre de produits
    calculated_transit_cost := tracking_cost_mga / total_products_count;
    
    -- Arrondir à 2 décimales
    NEW.transit_cost := ROUND(calculated_transit_cost, 2);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour calculer automatiquement transit_cost avant insertion ou mise à jour
CREATE TRIGGER trigger_calculate_transit_cost
    BEFORE INSERT OR UPDATE ON receipt_items
    FOR EACH ROW
    EXECUTE FUNCTION calculate_transit_cost();

-- Commentaire pour documenter la colonne
COMMENT ON COLUMN receipt_items.transit_cost IS 'Frais de transit calculé automatiquement : coût total du tracking number divisé par le nombre total de produits dans toutes les commandes liées à ce tracking number';



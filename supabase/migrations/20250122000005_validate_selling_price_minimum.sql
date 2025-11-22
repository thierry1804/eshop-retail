-- Migration pour valider que le prix de vente ne peut pas être inférieur à (prix d'achat + frais de transit)

-- Fonction pour calculer le coût minimum (prix d'achat + frais de transit) pour un produit
-- Cette fonction est accessible via RPC pour être appelée depuis le frontend
CREATE OR REPLACE FUNCTION get_product_minimum_cost(product_uuid UUID)
RETURNS DECIMAL(15,2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    avg_purchase_price DECIMAL(15,2);
    avg_transit_cost DECIMAL(15,2);
    min_cost DECIMAL(15,2);
BEGIN
    -- Calculer le prix d'achat moyen à partir des réceptions
    SELECT COALESCE(AVG(ri.unit_price), 0) INTO avg_purchase_price
    FROM receipt_items ri
    WHERE ri.product_id = product_uuid
    AND ri.unit_price > 0;
    
    -- Calculer le frais de transit moyen
    SELECT COALESCE(AVG(ri.transit_cost), 0) INTO avg_transit_cost
    FROM receipt_items ri
    WHERE ri.product_id = product_uuid
    AND ri.transit_cost > 0;
    
    -- Coût minimum = prix d'achat moyen + frais de transit moyen
    min_cost := COALESCE(avg_purchase_price, 0) + COALESCE(avg_transit_cost, 0);
    
    RETURN COALESCE(min_cost, 0);
END;
$$;

-- Fonction pour valider le prix de vente
CREATE OR REPLACE FUNCTION validate_selling_price()
RETURNS TRIGGER AS $$
DECLARE
    min_cost DECIMAL(15,2);
BEGIN
    -- Récupérer le coût minimum (prix d'achat + transit)
    min_cost := get_product_minimum_cost(NEW.product_id);
    
    -- Si le coût minimum est > 0 et que le prix de vente est inférieur, lever une erreur
    IF min_cost > 0 AND NEW.price < min_cost THEN
        RAISE EXCEPTION 'Le prix de vente (%) ne peut pas être inférieur au coût minimum (prix d''achat + frais de transit = %)', 
            NEW.price, min_cost;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour valider le prix de vente avant insertion ou mise à jour
CREATE TRIGGER trigger_validate_selling_price
    BEFORE INSERT OR UPDATE ON product_prices
    FOR EACH ROW
    EXECUTE FUNCTION validate_selling_price();

-- Commentaire pour documenter
COMMENT ON FUNCTION get_product_minimum_cost IS 'Calcule le coût minimum d''un produit (prix d''achat moyen + frais de transit moyen)';
COMMENT ON FUNCTION validate_selling_price IS 'Valide que le prix de vente ne peut pas être inférieur au coût minimum (prix d''achat + frais de transit)';


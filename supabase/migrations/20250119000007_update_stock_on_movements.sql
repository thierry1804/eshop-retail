-- Migration pour mettre à jour automatiquement le stock des produits lors des mouvements

-- Fonction pour mettre à jour le stock actuel d'un produit
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- Mettre à jour le stock actuel du produit
    UPDATE products 
    SET 
        current_stock = (
            SELECT COALESCE(SUM(
                CASE 
                    WHEN movement_type = 'in' THEN quantity
                    WHEN movement_type = 'out' THEN -quantity
                    WHEN movement_type = 'adjustment' THEN quantity
                    WHEN movement_type = 'transfer' THEN 
                        CASE 
                            WHEN reference_type = 'transfer' AND reference_id IS NOT NULL THEN -quantity
                            ELSE quantity
                        END
                    ELSE 0
                END
            ), 0)
            FROM stock_movements 
            WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
        ),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.product_id, OLD.product_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour le stock lors des mouvements
CREATE TRIGGER trigger_update_product_stock
    AFTER INSERT OR UPDATE OR DELETE ON stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION update_product_stock();

-- Fonction pour initialiser le stock actuel pour tous les produits existants
CREATE OR REPLACE FUNCTION initialize_product_stock()
RETURNS VOID AS $$
BEGIN
    -- Mettre à jour le stock actuel pour tous les produits basé sur leurs mouvements
    UPDATE products 
    SET 
        current_stock = COALESCE((
            SELECT SUM(
                CASE 
                    WHEN movement_type = 'in' THEN quantity
                    WHEN movement_type = 'out' THEN -quantity
                    WHEN movement_type = 'adjustment' THEN quantity
                    WHEN movement_type = 'transfer' THEN 
                        CASE 
                            WHEN reference_type = 'transfer' AND reference_id IS NOT NULL THEN -quantity
                            ELSE quantity
                        END
                    ELSE 0
                END
            )
            FROM stock_movements 
            WHERE product_id = products.id
        ), 0),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Initialiser le stock pour tous les produits existants
SELECT initialize_product_stock();

-- Supprimer la fonction d'initialisation car elle n'est plus nécessaire
DROP FUNCTION initialize_product_stock();

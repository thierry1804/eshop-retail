-- Migration pour permettre à un tracking number d'être associé à plusieurs commandes
-- Supprimer la contrainte UNIQUE sur purchase_order_id

-- Supprimer la contrainte UNIQUE si elle existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'tracking_numbers_purchase_order_id_key'
        AND table_name = 'tracking_numbers'
    ) THEN
        ALTER TABLE tracking_numbers 
        DROP CONSTRAINT tracking_numbers_purchase_order_id_key;
    END IF;
END $$;

-- Ajouter un index composite pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_tracking_numbers_tracking_and_order 
ON tracking_numbers(tracking_number, purchase_order_id);

-- Ajouter un commentaire pour clarifier la relation
COMMENT ON TABLE tracking_numbers IS 'Un tracking number peut être associé à une ou plusieurs commandes d''achat';


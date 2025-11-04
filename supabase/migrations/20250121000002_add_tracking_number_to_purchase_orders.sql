-- Migration pour ajouter la colonne tracking_number à la table purchase_orders si elle n'existe pas

-- Ajouter la colonne tracking_number si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'purchase_orders' 
        AND column_name = 'tracking_number'
    ) THEN
        ALTER TABLE purchase_orders 
        ADD COLUMN tracking_number VARCHAR(100);
        
        -- Index pour améliorer les performances
        CREATE INDEX IF NOT EXISTS idx_purchase_orders_tracking ON purchase_orders(tracking_number);
    END IF;
END $$;


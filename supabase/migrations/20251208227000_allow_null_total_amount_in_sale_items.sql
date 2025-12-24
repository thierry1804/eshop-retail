-- Migration pour permettre les valeurs NULL dans la colonne "total_amount" de sale_items
-- La colonne "total_amount" peut être NULL selon les besoins métier

-- Vérifier si la colonne existe et modifier sa contrainte
DO $$ 
BEGIN
    -- Vérifier si la colonne "total_amount" existe dans sale_items
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'sale_items' 
        AND column_name = 'total_amount'
    ) THEN
        -- Retirer la contrainte NOT NULL si elle existe
        ALTER TABLE sale_items 
        ALTER COLUMN total_amount DROP NOT NULL;
        
        RAISE NOTICE 'Colonne "total_amount" modifiée pour permettre NULL';
    ELSE
        RAISE NOTICE 'Colonne "total_amount" n''existe pas dans sale_items';
    END IF;
END $$;



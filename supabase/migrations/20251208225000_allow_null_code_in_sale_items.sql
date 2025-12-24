-- Migration pour permettre les valeurs NULL dans la colonne "code" de sale_items
-- La colonne "code" peut être NULL selon les besoins métier

-- Vérifier si la colonne existe et modifier sa contrainte
DO $$ 
BEGIN
    -- Vérifier si la colonne "code" existe dans sale_items
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'sale_items' 
        AND column_name = 'code'
    ) THEN
        -- Retirer la contrainte NOT NULL si elle existe
        ALTER TABLE sale_items 
        ALTER COLUMN code DROP NOT NULL;
        
        RAISE NOTICE 'Colonne "code" modifiée pour permettre NULL';
    ELSE
        RAISE NOTICE 'Colonne "code" n''existe pas dans sale_items';
    END IF;
END $$;



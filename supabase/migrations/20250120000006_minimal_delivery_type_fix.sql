-- Migration minimale pour delivery_type

-- Vérifier si la colonne delivery_type existe, sinon la créer
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' 
        AND column_name = 'delivery_type'
    ) THEN
        -- Créer la colonne avec une valeur par défaut simple
        ALTER TABLE deliveries ADD COLUMN delivery_type VARCHAR(20) DEFAULT 'delivery';
    END IF;
END $$;

-- S'assurer que la colonne n'est pas NULL
ALTER TABLE deliveries ALTER COLUMN delivery_type SET NOT NULL;

-- S'assurer que la colonne a une valeur par défaut
ALTER TABLE deliveries ALTER COLUMN delivery_type SET DEFAULT 'delivery';

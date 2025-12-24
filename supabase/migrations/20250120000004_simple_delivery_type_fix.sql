-- Migration simple pour corriger delivery_type

-- S'assurer que la colonne delivery_type existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' 
        AND column_name = 'delivery_type'
    ) THEN
        ALTER TABLE deliveries ADD COLUMN delivery_type VARCHAR(20) DEFAULT 'home_delivery';
    END IF;
END $$;

-- Mettre à jour les valeurs NULL vers une valeur par défaut
UPDATE deliveries SET delivery_type = 'home_delivery' WHERE delivery_type IS NULL;

-- S'assurer que la colonne n'est pas NULL
ALTER TABLE deliveries ALTER COLUMN delivery_type SET NOT NULL;

-- S'assurer que la colonne a une valeur par défaut
ALTER TABLE deliveries ALTER COLUMN delivery_type SET DEFAULT 'home_delivery';

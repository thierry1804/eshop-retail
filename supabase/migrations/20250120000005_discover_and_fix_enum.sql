-- Migration pour découvrir et corriger l'enum delivery_type

-- D'abord, vérifier si la colonne delivery_type existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' 
        AND column_name = 'delivery_type'
    ) THEN
        -- Si la colonne n'existe pas, la créer avec une valeur par défaut simple
        ALTER TABLE deliveries ADD COLUMN delivery_type VARCHAR(20) DEFAULT 'delivery';
        ALTER TABLE deliveries ALTER COLUMN delivery_type SET NOT NULL;
    END IF;
END $$;

-- Supprimer toute contrainte CHECK existante pour éviter les conflits
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'deliveries_delivery_type_check'
    ) THEN
        ALTER TABLE deliveries DROP CONSTRAINT deliveries_delivery_type_check;
    END IF;
END $$;

-- Mettre à jour seulement les valeurs NULL avec une valeur simple
UPDATE deliveries SET delivery_type = 'delivery' WHERE delivery_type IS NULL;

-- S'assurer que la colonne a une valeur par défaut
ALTER TABLE deliveries ALTER COLUMN delivery_type SET DEFAULT 'delivery';

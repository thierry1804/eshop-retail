-- Migration pour ajouter la colonne delivery_type manquante

-- Vérifier si la colonne delivery_type existe, sinon l'ajouter
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' 
        AND column_name = 'delivery_type'
    ) THEN
        ALTER TABLE deliveries ADD COLUMN delivery_type VARCHAR(20) NOT NULL DEFAULT 'standard';
    END IF;
END $$;

-- Ajouter la contrainte CHECK sur delivery_type si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'deliveries_delivery_type_check'
    ) THEN
        ALTER TABLE deliveries ADD CONSTRAINT deliveries_delivery_type_check 
        CHECK (delivery_type IN ('pickup', 'home_delivery', 'express', 'standard'));
    END IF;
END $$;

-- Mettre à jour les enregistrements existants pour avoir une valeur par défaut
UPDATE deliveries SET delivery_type = 'standard' WHERE delivery_type IS NULL;

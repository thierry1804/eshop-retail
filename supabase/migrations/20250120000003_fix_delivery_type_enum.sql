-- Migration pour corriger l'enum delivery_type

-- Supprimer la contrainte CHECK existante si elle existe
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'deliveries_delivery_type_check'
    ) THEN
        ALTER TABLE deliveries DROP CONSTRAINT deliveries_delivery_type_check;
    END IF;
END $$;

-- Mettre à jour seulement les enregistrements NULL vers une valeur par défaut valide
UPDATE deliveries SET delivery_type = 'home_delivery' WHERE delivery_type IS NULL;

-- Ajouter la nouvelle contrainte CHECK avec les valeurs valides
-- (Nous ne savons pas encore quelles sont les valeurs valides, donc on commence simple)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'deliveries_delivery_type_check'
    ) THEN
        ALTER TABLE deliveries ADD CONSTRAINT deliveries_delivery_type_check 
        CHECK (delivery_type IN ('pickup', 'home_delivery', 'express'));
    END IF;
END $$;

-- S'assurer que la colonne a une valeur par défaut valide
ALTER TABLE deliveries ALTER COLUMN delivery_type SET DEFAULT 'home_delivery';

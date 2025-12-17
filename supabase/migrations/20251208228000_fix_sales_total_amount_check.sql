-- Migration pour corriger la contrainte CHECK sur total_amount dans la table sales
-- La contrainte actuelle CHECK (total_amount > 0) est trop restrictive
-- On la modifie pour permettre total_amount >= 0 ou NULL

-- Supprimer toutes les contraintes CHECK existantes sur total_amount
DO $$ 
DECLARE
    constraint_rec RECORD;
BEGIN
    -- Trouver et supprimer toutes les contraintes CHECK sur total_amount
    FOR constraint_rec IN
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu 
            ON tc.constraint_name = ccu.constraint_name
            AND tc.table_schema = ccu.table_schema
        WHERE tc.table_name = 'sales' 
        AND tc.constraint_type = 'CHECK'
        AND ccu.column_name = 'total_amount'
    LOOP
        EXECUTE format('ALTER TABLE sales DROP CONSTRAINT IF EXISTS %I', constraint_rec.constraint_name);
        RAISE NOTICE 'Contrainte "%" supprimée', constraint_rec.constraint_name;
    END LOOP;
END $$;

-- Modifier la colonne pour permettre NULL si nécessaire
ALTER TABLE sales 
ALTER COLUMN total_amount DROP NOT NULL;

-- Ajouter une nouvelle contrainte plus permissive (>= 0 au lieu de > 0)
ALTER TABLE sales 
ADD CONSTRAINT sales_total_amount_check 
CHECK (total_amount IS NULL OR total_amount >= 0);


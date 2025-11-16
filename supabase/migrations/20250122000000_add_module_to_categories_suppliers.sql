-- Migration pour ajouter le champ modules (array) aux tables categories et suppliers
-- Ce champ permet de définir sur quels modules les référentiels apparaissent (expenses, stock, etc.)
-- Une catégorie/fournisseur peut apparaître dans plusieurs modules

-- Ajouter la colonne modules (array) à la table categories
DO $$
BEGIN
    -- Supprimer l'ancienne colonne module si elle existe (migration précédente)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'categories' 
        AND column_name = 'module'
    ) THEN
        ALTER TABLE categories DROP COLUMN module;
    END IF;
    
    -- Ajouter la nouvelle colonne modules (array)
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'categories' 
        AND column_name = 'modules'
    ) THEN
        ALTER TABLE categories 
        ADD COLUMN modules TEXT[] DEFAULT ARRAY['expenses'];
        
        -- Mettre à jour les catégories existantes pour qu'elles soient associées au module expenses par défaut
        UPDATE categories SET modules = ARRAY['expenses'] WHERE modules IS NULL;
        
        -- Ajouter une contrainte pour s'assurer que le tableau n'est pas vide
        ALTER TABLE categories 
        ADD CONSTRAINT categories_modules_not_empty CHECK (array_length(modules, 1) > 0);
    END IF;
END $$;

-- Ajouter la colonne modules (array) à la table suppliers
DO $$
BEGIN
    -- Supprimer l'ancienne colonne module si elle existe (migration précédente)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'suppliers' 
        AND column_name = 'module'
    ) THEN
        ALTER TABLE suppliers DROP COLUMN module;
    END IF;
    
    -- Ajouter la nouvelle colonne modules (array)
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'suppliers' 
        AND column_name = 'modules'
    ) THEN
        ALTER TABLE suppliers 
        ADD COLUMN modules TEXT[] DEFAULT ARRAY['expenses'];
        
        -- Mettre à jour les fournisseurs existants pour qu'ils soient associés au module expenses par défaut
        UPDATE suppliers SET modules = ARRAY['expenses'] WHERE modules IS NULL;
        
        -- Ajouter une contrainte pour s'assurer que le tableau n'est pas vide
        ALTER TABLE suppliers 
        ADD CONSTRAINT suppliers_modules_not_empty CHECK (array_length(modules, 1) > 0);
    END IF;
END $$;

-- Créer des index GIN pour améliorer les performances des requêtes filtrées par module
CREATE INDEX IF NOT EXISTS idx_categories_modules ON categories USING GIN(modules);
CREATE INDEX IF NOT EXISTS idx_suppliers_modules ON suppliers USING GIN(modules);


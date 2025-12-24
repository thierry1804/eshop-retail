-- Migration pour ajouter les colonnes product_name et total_price à sale_items
-- Ces colonnes devraient exister selon la migration initiale, mais peuvent manquer dans certaines bases de données

-- Ajouter product_name si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'sale_items' 
        AND column_name = 'product_name'
    ) THEN
        ALTER TABLE sale_items 
        ADD COLUMN product_name VARCHAR(255);
        
        -- Remplir product_name avec les noms depuis la table products pour les enregistrements existants
        UPDATE sale_items si
        SET product_name = COALESCE(p.name, 'Article sans nom')
        FROM products p
        WHERE si.article_id = p.id;
        
        -- Pour les articles sans article_id, mettre une valeur par défaut
        UPDATE sale_items
        SET product_name = 'Article sans nom'
        WHERE product_name IS NULL;
        
        -- Maintenant rendre la colonne NOT NULL
        ALTER TABLE sale_items
        ALTER COLUMN product_name SET NOT NULL;
    END IF;
END $$;

-- Ajouter total_price si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'sale_items' 
        AND column_name = 'total_price'
    ) THEN
        ALTER TABLE sale_items 
        ADD COLUMN total_price DECIMAL(12,2);
        
        -- Calculer total_price pour les enregistrements existants
        UPDATE sale_items
        SET total_price = quantity * unit_price
        WHERE total_price IS NULL;
        
        -- Ajouter la contrainte CHECK
        ALTER TABLE sale_items
        ADD CONSTRAINT sale_items_total_price_check 
        CHECK (total_price >= 0);
        
        -- Maintenant rendre la colonne NOT NULL
        ALTER TABLE sale_items
        ALTER COLUMN total_price SET NOT NULL;
    END IF;
END $$;



-- Migration pour ajouter la colonne description à la table categories si elle n'existe pas

-- Ajouter la colonne description si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'categories' 
        AND column_name = 'description'
    ) THEN
        ALTER TABLE categories 
        ADD COLUMN description TEXT;
    END IF;
END $$;


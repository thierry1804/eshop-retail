-- Migration pour créer la table suppliers si elle n'existe pas
-- et ajouter la colonne contact_info si elle n'existe pas

-- Créer la table suppliers si elle n'existe pas
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ajouter la colonne contact_info si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'suppliers' 
        AND column_name = 'contact_info'
    ) THEN
        ALTER TABLE suppliers 
        ADD COLUMN contact_info TEXT;
    END IF;
END $$;

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- RLS (Row Level Security) - activer si pas déjà activé
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Politiques RLS (créer seulement si elles n'existent pas)
DO $$
BEGIN
    -- Politique pour permettre la lecture à tous les utilisateurs authentifiés
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'suppliers' 
        AND policyname = 'Authenticated users can view suppliers'
    ) THEN
        CREATE POLICY "Authenticated users can view suppliers"
            ON suppliers
            FOR SELECT
            TO authenticated
            USING (true);
    END IF;
    
    -- Politique pour permettre l'insertion aux utilisateurs authentifiés
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'suppliers' 
        AND policyname = 'Authenticated users can create suppliers'
    ) THEN
        CREATE POLICY "Authenticated users can create suppliers"
            ON suppliers
            FOR INSERT
            TO authenticated
            WITH CHECK (true);
    END IF;
    
    -- Politique pour permettre la mise à jour aux utilisateurs authentifiés
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'suppliers' 
        AND policyname = 'Authenticated users can update suppliers'
    ) THEN
        CREATE POLICY "Authenticated users can update suppliers"
            ON suppliers
            FOR UPDATE
            TO authenticated
            USING (true);
    END IF;
    
    -- Politique pour permettre la suppression aux utilisateurs authentifiés
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'suppliers' 
        AND policyname = 'Authenticated users can delete suppliers'
    ) THEN
        CREATE POLICY "Authenticated users can delete suppliers"
            ON suppliers
            FOR DELETE
            TO authenticated
            USING (true);
    END IF;
END $$;


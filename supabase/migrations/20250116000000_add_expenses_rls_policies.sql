-- Migration pour ajouter les politiques RLS pour la table expenses
-- Cette migration permet aux utilisateurs authentifiés de gérer les dépenses

-- Activer RLS sur la table expenses si ce n'est pas déjà fait
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre aux utilisateurs authentifiés de voir toutes les dépenses
CREATE POLICY "Authenticated users can view expenses"
  ON expenses
  FOR SELECT
  TO authenticated
  USING (true);

-- Politique pour permettre aux utilisateurs authentifiés de créer des dépenses
CREATE POLICY "Authenticated users can create expenses"
  ON expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Politique pour permettre aux utilisateurs authentifiés de modifier les dépenses
CREATE POLICY "Authenticated users can update expenses"
  ON expenses
  FOR UPDATE
  TO authenticated
  USING (true);

-- Politique pour permettre aux utilisateurs authentifiés de supprimer les dépenses
CREATE POLICY "Authenticated users can delete expenses"
  ON expenses
  FOR DELETE
  TO authenticated
  USING (true);

-- Activer RLS sur les tables categories et suppliers si elles existent
-- (Ces tables sont référencées par expenses)
DO $$
BEGIN
  -- Vérifier si la table categories existe et activer RLS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories') THEN
    ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
    
    -- Politiques pour categories
    CREATE POLICY "Authenticated users can view categories"
      ON categories
      FOR SELECT
      TO authenticated
      USING (true);
      
    CREATE POLICY "Authenticated users can create categories"
      ON categories
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
      
    CREATE POLICY "Authenticated users can update categories"
      ON categories
      FOR UPDATE
      TO authenticated
      USING (true);
      
    CREATE POLICY "Authenticated users can delete categories"
      ON categories
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;

  -- Vérifier si la table suppliers existe et activer RLS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') THEN
    ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
    
    -- Politiques pour suppliers
    CREATE POLICY "Authenticated users can view suppliers"
      ON suppliers
      FOR SELECT
      TO authenticated
      USING (true);
      
    CREATE POLICY "Authenticated users can create suppliers"
      ON suppliers
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
      
    CREATE POLICY "Authenticated users can update suppliers"
      ON suppliers
      FOR UPDATE
      TO authenticated
      USING (true);
      
    CREATE POLICY "Authenticated users can delete suppliers"
      ON suppliers
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

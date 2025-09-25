/*
  # Amélioration du système de dépenses avec audit trail et soft delete

  1. Ajout des champs d'audit trail
     - `created_by` - Utilisateur qui a créé la dépense
     - `updated_by` - Utilisateur qui a modifié la dépense
     - `updated_at` - Date de dernière modification
     - `deleted_by` - Utilisateur qui a supprimé la dépense
     - `deleted_at` - Date de suppression (soft delete)

  2. Modification des politiques RLS
     - Ajout de filtres pour exclure les dépenses supprimées
     - Mise à jour des politiques pour gérer le soft delete

  3. Triggers pour l'audit trail
     - Trigger pour mettre à jour `updated_by` et `updated_at` automatiquement
     - Trigger pour gérer le soft delete
*/

-- Ajouter les colonnes d'audit trail à la table expenses
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Créer un index sur deleted_at pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_expenses_deleted_at ON expenses(deleted_at);

-- Créer un index sur created_by pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);

-- Fonction pour mettre à jour updated_by et updated_at automatiquement
CREATE OR REPLACE FUNCTION update_expense_audit_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Mettre à jour updated_by avec l'utilisateur actuel
  NEW.updated_by = auth.uid();
  NEW.updated_at = now();
  
  -- Si c'est une création, définir created_by
  IF TG_OP = 'INSERT' THEN
    NEW.created_by = auth.uid();
    NEW.created_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour l'audit trail automatique
DROP TRIGGER IF EXISTS trigger_update_expense_audit ON expenses;
CREATE TRIGGER trigger_update_expense_audit
  BEFORE INSERT OR UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_expense_audit_fields();

-- Fonction pour le soft delete
CREATE OR REPLACE FUNCTION soft_delete_expense()
RETURNS TRIGGER AS $$
BEGIN
  -- Au lieu de supprimer, marquer comme supprimé
  UPDATE expenses 
  SET 
    deleted_by = auth.uid(),
    deleted_at = now()
  WHERE id = OLD.id;
  
  -- Retourner NULL pour empêcher la suppression réelle
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour le soft delete
DROP TRIGGER IF EXISTS trigger_soft_delete_expense ON expenses;
CREATE TRIGGER trigger_soft_delete_expense
  BEFORE DELETE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete_expense();

-- Mettre à jour les politiques RLS pour exclure les dépenses supprimées
DROP POLICY IF EXISTS "Authenticated users can view expenses" ON expenses;
CREATE POLICY "Authenticated users can view expenses"
  ON expenses
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Mettre à jour la politique de mise à jour pour empêcher la modification des dépenses verrouillées
DROP POLICY IF EXISTS "Authenticated users can update expenses" ON expenses;
CREATE POLICY "Authenticated users can update expenses"
  ON expenses
  FOR UPDATE
  TO authenticated
  USING (deleted_at IS NULL AND (locked IS NULL OR locked = false))
  WITH CHECK (deleted_at IS NULL);

-- Mettre à jour la politique de suppression pour permettre le soft delete
DROP POLICY IF EXISTS "Authenticated users can delete expenses" ON expenses;
CREATE POLICY "Authenticated users can delete expenses"
  ON expenses
  FOR DELETE
  TO authenticated
  USING (deleted_at IS NULL);

-- Créer une vue pour les dépenses actives (non supprimées)
CREATE OR REPLACE VIEW active_expenses AS
SELECT 
  e.*,
  c.name as category_name,
  s.name as supplier_name,
  creator.name as created_by_name,
  updater.name as updated_by_name,
  deleter.name as deleted_by_name
FROM expenses e
LEFT JOIN categories c ON e.category_id = c.id
LEFT JOIN suppliers s ON e.supplier_id = s.id
LEFT JOIN user_profiles creator ON e.created_by = creator.id
LEFT JOIN user_profiles updater ON e.updated_by = updater.id
LEFT JOIN user_profiles deleter ON e.deleted_by = deleter.id
WHERE e.deleted_at IS NULL;

-- Créer une vue pour l'audit trail des dépenses
CREATE OR REPLACE VIEW expense_audit_trail AS
SELECT 
  e.id,
  e.amount,
  e.description,
  e.date,
  e.locked,
  e.created_at,
  e.updated_at,
  e.deleted_at,
  creator.name as created_by_name,
  creator.email as created_by_email,
  updater.name as updated_by_name,
  updater.email as updated_by_email,
  deleter.name as deleted_by_name,
  deleter.email as deleted_by_email,
  CASE 
    WHEN e.deleted_at IS NOT NULL THEN 'deleted'
    WHEN e.updated_at > e.created_at THEN 'modified'
    ELSE 'created'
  END as status
FROM expenses e
LEFT JOIN user_profiles creator ON e.created_by = creator.id
LEFT JOIN user_profiles updater ON e.updated_by = updater.id
LEFT JOIN user_profiles deleter ON e.deleted_by = deleter.id
ORDER BY e.created_at DESC;

-- RLS pour les vues
ALTER VIEW active_expenses SET (security_invoker = true);
ALTER VIEW expense_audit_trail SET (security_invoker = true);

-- Politiques RLS pour les vues
CREATE POLICY "Authenticated users can view active expenses"
  ON active_expenses
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view expense audit trail"
  ON expense_audit_trail
  FOR SELECT
  TO authenticated
  USING (true);

-- Fonction pour la suppression définitive (bypass du soft delete)
CREATE OR REPLACE FUNCTION permanently_delete_expense(expense_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Supprimer directement sans passer par le trigger
  DELETE FROM expenses WHERE id = expense_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour restaurer une dépense supprimée
CREATE OR REPLACE FUNCTION restore_expense(expense_id uuid)
RETURNS boolean AS $$
BEGIN
  UPDATE expenses 
  SET 
    deleted_by = NULL,
    deleted_at = NULL
  WHERE id = expense_id AND deleted_at IS NOT NULL;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

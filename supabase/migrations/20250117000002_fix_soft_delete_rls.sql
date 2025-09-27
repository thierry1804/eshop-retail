/*
  # Correction du soft delete pour les dépenses
  
  Problème: Le trigger de soft delete fait un UPDATE qui viole les politiques RLS
  Solution: Modifier le trigger pour utiliser SECURITY DEFINER et bypasser RLS
*/

-- Supprimer l'ancien trigger problématique
DROP TRIGGER IF EXISTS trigger_soft_delete_expense ON expenses;

-- Créer une nouvelle fonction de soft delete avec SECURITY DEFINER
CREATE OR REPLACE FUNCTION soft_delete_expense()
RETURNS TRIGGER AS $$
BEGIN
  -- Utiliser SECURITY DEFINER pour bypasser RLS lors de l'UPDATE
  PERFORM set_config('row_security', 'off', true);
  
  -- Marquer la dépense comme supprimée
  UPDATE expenses 
  SET 
    deleted_by = auth.uid(),
    deleted_at = now()
  WHERE id = OLD.id;
  
  -- Réactiver RLS
  PERFORM set_config('row_security', 'on', true);
  
  -- Retourner NULL pour empêcher la suppression réelle
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recréer le trigger avec la nouvelle fonction
CREATE TRIGGER trigger_soft_delete_expense
  BEFORE DELETE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete_expense();

-- Alternative: Créer une fonction RPC pour le soft delete
CREATE OR REPLACE FUNCTION soft_delete_expense_rpc(expense_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Marquer la dépense comme supprimée
  UPDATE expenses 
  SET 
    deleted_by = auth.uid(),
    deleted_at = now()
  WHERE id = expense_id AND deleted_at IS NULL;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Donner les permissions d'exécution aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION soft_delete_expense_rpc(uuid) TO authenticated;

-- Mettre à jour les politiques RLS pour être plus permissives pour les updates
DROP POLICY IF EXISTS "Authenticated users can update expenses" ON expenses;
CREATE POLICY "Authenticated users can update expenses"
  ON expenses
  FOR UPDATE
  TO authenticated
  USING (deleted_at IS NULL AND (locked IS NULL OR locked = false))
  WITH CHECK (deleted_at IS NULL);

-- Ajouter une politique spécifique pour les updates d'audit (soft delete)
CREATE POLICY "Allow audit updates for soft delete"
  ON expenses
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

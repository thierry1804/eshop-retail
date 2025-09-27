/*
  # Correction de la suppression définitive des dépenses

  Problème: Les fonctions disable_soft_delete_trigger et enable_soft_delete_trigger
  ne sont pas accessibles via RPC car elles ne sont pas dans le schéma public.

  Solution: Remplacer par une fonction permanently_delete_expense qui utilise
  SECURITY DEFINER pour bypasser le trigger de soft delete.
*/

-- Supprimer les anciennes fonctions problématiques
DROP FUNCTION IF EXISTS disable_soft_delete_trigger();
DROP FUNCTION IF EXISTS enable_soft_delete_trigger();

-- Créer la fonction de suppression définitive avec les bonnes permissions
CREATE OR REPLACE FUNCTION permanently_delete_expense(expense_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Supprimer directement sans passer par le trigger
  DELETE FROM expenses WHERE id = expense_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Donner les permissions d'exécution aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION permanently_delete_expense(uuid) TO authenticated;

-- S'assurer que la fonction restore_expense a aussi les bonnes permissions
GRANT EXECUTE ON FUNCTION restore_expense(uuid) TO authenticated;
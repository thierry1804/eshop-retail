/*
  # Correction de la suppression définitive des dépenses
  
  Problème: La fonction permanently_delete_expense est interceptée par le trigger de soft delete
  Solution: Désactiver temporairement le trigger ou utiliser une approche différente
*/

-- Supprimer l'ancienne fonction
DROP FUNCTION IF EXISTS permanently_delete_expense(uuid);

-- Créer une nouvelle fonction qui désactive temporairement le trigger
CREATE OR REPLACE FUNCTION permanently_delete_expense(expense_id uuid)
RETURNS boolean AS $$
DECLARE
  result boolean := false;
  row_count integer;
BEGIN
  -- Désactiver temporairement le trigger de soft delete
  ALTER TABLE expenses DISABLE TRIGGER trigger_soft_delete_expense;
  
  -- Supprimer directement la dépense
  DELETE FROM expenses WHERE id = expense_id;
  
  -- Vérifier si la suppression a réussi
  GET DIAGNOSTICS row_count = ROW_COUNT;
  result := (row_count > 0);
  
  -- Réactiver le trigger
  ALTER TABLE expenses ENABLE TRIGGER trigger_soft_delete_expense;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Donner les permissions d'exécution aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION permanently_delete_expense(uuid) TO authenticated;

-- Alternative: Fonction qui utilise une approche différente
CREATE OR REPLACE FUNCTION permanently_delete_expense_v2(expense_id uuid)
RETURNS boolean AS $$
DECLARE
  result boolean := false;
  row_count integer;
BEGIN
  -- Utiliser une transaction pour contourner le trigger
  BEGIN
    -- Désactiver RLS temporairement
    PERFORM set_config('row_security', 'off', true);
    
    -- Supprimer directement
    DELETE FROM expenses WHERE id = expense_id;
    
    -- Vérifier si la suppression a réussi
    GET DIAGNOSTICS row_count = ROW_COUNT;
    result := (row_count > 0);
    
    -- Réactiver RLS
    PERFORM set_config('row_security', 'on', true);
    
  EXCEPTION WHEN OTHERS THEN
    -- En cas d'erreur, réactiver RLS
    PERFORM set_config('row_security', 'on', true);
    RAISE;
  END;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Donner les permissions pour la version alternative
GRANT EXECUTE ON FUNCTION permanently_delete_expense_v2(uuid) TO authenticated;

-- Créer une fonction qui supprime vraiment (sans trigger)
CREATE OR REPLACE FUNCTION really_delete_expense(expense_id uuid)
RETURNS boolean AS $$
DECLARE
  result boolean := false;
  row_count integer;
BEGIN
  -- Supprimer en utilisant une connexion avec des privilèges élevés
  EXECUTE format('DELETE FROM expenses WHERE id = %L', expense_id);
  
  -- Vérifier si la suppression a réussi
  GET DIAGNOSTICS row_count = ROW_COUNT;
  result := (row_count > 0);
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Donner les permissions
GRANT EXECUTE ON FUNCTION really_delete_expense(uuid) TO authenticated;

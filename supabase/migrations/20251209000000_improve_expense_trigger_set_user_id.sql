-- Migration pour améliorer le trigger des dépenses
-- Définir user_id automatiquement lors de la création pour cohérence

-- Fonction pour mettre à jour updated_by, updated_at et user_id automatiquement
CREATE OR REPLACE FUNCTION update_expense_audit_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Mettre à jour updated_by avec l'utilisateur actuel
  NEW.updated_by = auth.uid();
  NEW.updated_at = now();
  
  -- Si c'est une création, définir created_by et user_id
  IF TG_OP = 'INSERT' THEN
    NEW.created_by = auth.uid();
    NEW.created_at = now();
    -- Définir user_id si non défini (pour cohérence, même si nullable)
    IF NEW.user_id IS NULL THEN
      NEW.user_id = auth.uid();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;






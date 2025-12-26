-- Migration pour créer une fonction qui récupère les informations utilisateur depuis auth.users
-- Cette fonction permet de récupérer le full_name même si le profil n'existe pas dans user_profiles

-- Fonction pour récupérer les informations utilisateur depuis auth.users
CREATE OR REPLACE FUNCTION get_user_info(user_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  name TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  auth_user_record RECORD;
BEGIN
  -- Récupérer les informations depuis auth.users
  SELECT 
    au.id,
    COALESCE(au.email, '') as email,
    COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', '') as full_name,
    COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', au.email, 'Utilisateur') as name
  INTO auth_user_record
  FROM auth.users au
  WHERE au.id = user_id;

  -- Retourner les résultats
  IF auth_user_record.id IS NOT NULL THEN
    RETURN QUERY SELECT 
      auth_user_record.id,
      auth_user_record.email,
      auth_user_record.full_name,
      auth_user_record.name;
  END IF;
  
  RETURN;
END;
$$;

-- Commentaire sur la fonction
COMMENT ON FUNCTION get_user_info(UUID) IS 'Récupère les informations utilisateur depuis auth.users, notamment le full_name depuis user_metadata';

-- Donner les permissions nécessaires
GRANT EXECUTE ON FUNCTION get_user_info(UUID) TO authenticated;


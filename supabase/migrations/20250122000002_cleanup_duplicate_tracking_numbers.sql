-- Migration pour nettoyer les doublons de tracking numbers
-- Garder un seul enregistrement par tracking_number unique (le plus ancien)

-- Supprimer les doublons en gardant le premier enregistrement créé pour chaque tracking_number
DELETE FROM tracking_numbers
WHERE id NOT IN (
    SELECT DISTINCT ON (tracking_number) id
    FROM tracking_numbers
    ORDER BY tracking_number, created_at ASC
);

-- Ajouter une contrainte unique sur tracking_number pour éviter les futurs doublons
DO $$
BEGIN
    -- Vérifier si la contrainte n'existe pas déjà
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'tracking_numbers_tracking_number_key'
        AND table_name = 'tracking_numbers'
    ) THEN
        -- Créer un index unique sur tracking_number
        CREATE UNIQUE INDEX tracking_numbers_tracking_number_key 
        ON tracking_numbers(tracking_number);
    END IF;
END $$;



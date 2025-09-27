-- Migration pour corriger les champs UUID de la table products
-- Permettre des valeurs NULL temporairement pour created_by et updated_by

ALTER TABLE products ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE products ALTER COLUMN updated_by DROP NOT NULL;

-- Mettre à jour les enregistrements existants avec des UUID vides
-- PostgreSQL gère déjà la validation des UUID nativement
UPDATE products 
SET created_by = NULL 
WHERE created_by::text = '' OR created_by IS NULL;

UPDATE products 
SET updated_by = NULL 
WHERE updated_by::text = '' OR updated_by IS NULL;

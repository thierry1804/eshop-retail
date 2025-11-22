-- Migration pour ajouter le champ image_url à la table products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Index pour améliorer les performances des requêtes avec image_url
CREATE INDEX IF NOT EXISTS idx_products_image_url ON products(image_url) WHERE image_url IS NOT NULL;

-- Commentaire sur la colonne
COMMENT ON COLUMN products.image_url IS 'URL de l\'image du produit stockée dans Supabase Storage';



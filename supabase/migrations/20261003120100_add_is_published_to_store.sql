-- Flag de publication produit sur le store (pas de sync e-commerce en v1)

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS is_published_to_store BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_is_published_to_store
    ON products(is_published_to_store)
    WHERE is_published_to_store = true;

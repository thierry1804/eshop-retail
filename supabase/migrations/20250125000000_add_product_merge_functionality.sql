-- Migration pour ajouter la fonctionnalité de fusion de produits en doublon

-- 1. Table d'audit pour tracer les fusions
CREATE TABLE IF NOT EXISTS product_merges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    master_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    merged_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    merged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    merged_by UUID REFERENCES auth.users(id),
    merge_reason TEXT,
    UNIQUE(merged_product_id) -- Un produit ne peut être fusionné qu'une fois
);

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_product_merges_master ON product_merges(master_product_id);
CREATE INDEX IF NOT EXISTS idx_product_merges_merged ON product_merges(merged_product_id);
CREATE INDEX IF NOT EXISTS idx_product_merges_merged_at ON product_merges(merged_at);

-- RLS (Row Level Security)
ALTER TABLE product_merges ENABLE ROW LEVEL SECURITY;

-- Supprimer les politiques existantes si elles existent
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON product_merges;
DROP POLICY IF EXISTS "Allow insert to authenticated users" ON product_merges;

-- Politique pour permettre la lecture à tous les utilisateurs authentifiés
CREATE POLICY "Allow read access to authenticated users" ON product_merges
    FOR SELECT USING (auth.role() = 'authenticated');

-- Politique pour permettre l'insertion aux utilisateurs authentifiés
CREATE POLICY "Allow insert to authenticated users" ON product_merges
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 2. Fonction de normalisation du nom pour la détection de doublons
CREATE OR REPLACE FUNCTION normalize_product_name(name TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Normaliser : trim, lowercase, supprimer accents multiples
    RETURN lower(trim(translate(
        name,
        'àáâãäåèéêëìíîïòóôõöùúûüýÿÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝŸ',
        'aaaaaaeeeeiiiiooooouuuuyyAAAAAAEEEEIIIIOOOOOUUUUYY'
    )));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Fonction pour identifier automatiquement le meilleur master
CREATE OR REPLACE FUNCTION select_master_product(product_ids UUID[])
RETURNS UUID AS $$
DECLARE
    master_id UUID;
BEGIN
    -- Sélectionner le produit avec le plus d'activité (mouvements)
    -- En cas d'égalité, prendre le plus ancien avec le plus de stock
    SELECT p.id INTO master_id
    FROM products p
    WHERE p.id = ANY(product_ids)
    ORDER BY 
        (SELECT COUNT(*) FROM stock_movements WHERE product_id = p.id) DESC,
        p.current_stock DESC,
        CASE WHEN p.status = 'active' THEN 0 ELSE 1 END,
        p.created_at ASC
    LIMIT 1;
    
    RETURN master_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Fonction pour prévisualiser l'impact d'une fusion (SANS l'exécuter)
CREATE OR REPLACE FUNCTION preview_merge(
    master_product_id UUID,
    duplicate_product_id UUID
)
RETURNS JSONB AS $$
DECLARE
    master_product JSONB;
    duplicate_product JSONB;
    impact JSONB;
    stock_alerts_count INTEGER := 0;
BEGIN
    -- Validation
    IF master_product_id = duplicate_product_id THEN
        RAISE EXCEPTION 'Cannot preview merge of product with itself';
    END IF;
    
    -- Vérifier que le produit à fusionner n'a pas déjà été fusionné
    IF EXISTS (SELECT 1 FROM product_merges WHERE merged_product_id = duplicate_product_id) THEN
        RAISE EXCEPTION 'Product % has already been merged', duplicate_product_id;
    END IF;
    
    -- Récupérer les infos des produits
    SELECT to_jsonb(p.*) INTO master_product
    FROM products p
    WHERE p.id = master_product_id;
    
    IF master_product IS NULL THEN
        RAISE EXCEPTION 'Master product % not found', master_product_id;
    END IF;
    
    SELECT to_jsonb(p.*) INTO duplicate_product
    FROM products p
    WHERE p.id = duplicate_product_id;
    
    IF duplicate_product IS NULL THEN
        RAISE EXCEPTION 'Duplicate product % not found', duplicate_product_id;
    END IF;
    
    -- Calculer l'impact
    -- Vérifier si la table stock_alerts existe et compter
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'stock_alerts'
    ) THEN
        SELECT COUNT(*) INTO stock_alerts_count
        FROM stock_alerts 
        WHERE product_id = duplicate_product_id;
    END IF;
    
    SELECT jsonb_build_object(
        'stock_movements', (SELECT COUNT(*) FROM stock_movements WHERE product_id = duplicate_product_id),
        'purchase_order_items', (SELECT COUNT(*) FROM purchase_order_items WHERE product_id = duplicate_product_id),
        'sale_items', (SELECT COUNT(*) FROM sale_items WHERE article_id = duplicate_product_id),
        'receipt_items', (SELECT COUNT(*) FROM receipt_items WHERE product_id = duplicate_product_id),
        'delivery_items', (SELECT COUNT(*) FROM delivery_items WHERE product_id = duplicate_product_id),
        'product_prices', (SELECT COUNT(*) FROM product_prices WHERE product_id = duplicate_product_id),
        'stock_alerts', stock_alerts_count,
        'new_master_stock', (
            (SELECT current_stock FROM products WHERE id = master_product_id) +
            (SELECT current_stock FROM products WHERE id = duplicate_product_id)
        )
    ) INTO impact;
    
    RETURN jsonb_build_object(
        'master_product', master_product,
        'duplicate_product', duplicate_product,
        'impact', impact
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Fonction principale de fusion (transactionnelle)
CREATE OR REPLACE FUNCTION merge_products(
    master_product_id UUID,
    duplicate_product_id UUID,
    merge_user_id UUID DEFAULT NULL,
    delete_duplicate BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    master_stock INTEGER;
    duplicate_stock INTEGER;
    master_initial_stock INTEGER;
    master_final_stock INTEGER;
    stats JSONB;
    stock_alerts_count INTEGER := 0;
    user_email TEXT;
    master_product_name TEXT;
    duplicate_product_name TEXT;
    master_product_sku TEXT;
    duplicate_product_sku TEXT;
BEGIN
    -- Validation
    IF master_product_id = duplicate_product_id THEN
        RAISE EXCEPTION 'Cannot merge product with itself';
    END IF;
    
    -- Vérifier que le produit à fusionner n'a pas déjà été fusionné
    IF EXISTS (SELECT 1 FROM product_merges WHERE merged_product_id = duplicate_product_id) THEN
        RAISE EXCEPTION 'Product % has already been merged', duplicate_product_id;
    END IF;
    
    -- Vérifier que les produits existent
    IF NOT EXISTS (SELECT 1 FROM products WHERE id = master_product_id) THEN
        RAISE EXCEPTION 'Master product % not found', master_product_id;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM products WHERE id = duplicate_product_id) THEN
        RAISE EXCEPTION 'Duplicate product % not found', duplicate_product_id;
    END IF;
    
    -- Récupérer les stocks actuels (AVANT transfert des mouvements)
    SELECT current_stock INTO master_stock FROM products WHERE id = master_product_id;
    SELECT current_stock INTO duplicate_stock FROM products WHERE id = duplicate_product_id;
    
    -- Stocker le stock initial du master pour le logging
    master_initial_stock := master_stock;
    
    -- Compter les relations avant fusion
    -- Vérifier si la table stock_alerts existe et compter
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'stock_alerts'
    ) THEN
        SELECT COUNT(*) INTO stock_alerts_count
        FROM stock_alerts 
        WHERE product_id = duplicate_product_id;
    END IF;
    
    SELECT jsonb_build_object(
        'stock_movements', (SELECT COUNT(*) FROM stock_movements WHERE product_id = duplicate_product_id),
        'purchase_order_items', (SELECT COUNT(*) FROM purchase_order_items WHERE product_id = duplicate_product_id),
        'sale_items', (SELECT COUNT(*) FROM sale_items WHERE article_id = duplicate_product_id),
        'receipt_items', (SELECT COUNT(*) FROM receipt_items WHERE product_id = duplicate_product_id),
        'delivery_items', (SELECT COUNT(*) FROM delivery_items WHERE product_id = duplicate_product_id),
        'product_prices', (SELECT COUNT(*) FROM product_prices WHERE product_id = duplicate_product_id),
        'stock_alerts', stock_alerts_count
    ) INTO stats;
    
    -- Les fonctions PostgreSQL sont déjà transactionnelles, pas besoin de BEGIN explicite
    -- 1. Transférer les mouvements de stock
    UPDATE stock_movements 
    SET product_id = master_product_id 
    WHERE product_id = duplicate_product_id;
    
    -- 2. Transférer les articles de commande
    UPDATE purchase_order_items 
    SET product_id = master_product_id 
    WHERE product_id = duplicate_product_id;
    
    -- 3. Transférer les articles de réception
    UPDATE receipt_items 
    SET product_id = master_product_id 
    WHERE product_id = duplicate_product_id;
    
    -- 4. Transférer les articles de livraison
    UPDATE delivery_items 
    SET product_id = master_product_id 
    WHERE product_id = duplicate_product_id;
    
    -- 5. Transférer les articles de vente (article_id)
    UPDATE sale_items 
    SET article_id = master_product_id 
    WHERE article_id = duplicate_product_id;
    
    -- 6. Transférer les alertes de stock (si la table existe)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'stock_alerts'
    ) THEN
        UPDATE stock_alerts 
        SET product_id = master_product_id 
        WHERE product_id = duplicate_product_id;
    END IF;
    
    -- 7. Gérer les prix
    -- Désactiver les prix dupliqués identiques
    UPDATE product_prices pp
    SET is_active = false
    WHERE pp.product_id = duplicate_product_id
    AND EXISTS (
        SELECT 1 FROM product_prices pp2
        WHERE pp2.product_id = master_product_id
        AND pp2.price_type = pp.price_type
        AND pp2.is_active = true
        AND ABS(pp2.price - pp.price) < 0.01 -- Tolérance pour les arrondis
    );
    
    -- Transférer les prix restants vers le master
    UPDATE product_prices 
    SET product_id = master_product_id 
    WHERE product_id = duplicate_product_id;
    
    -- 8. Le stock sera automatiquement recalculé par le trigger update_product_stock
    -- après le transfert des mouvements de stock (pas besoin d'additionner manuellement)
    -- Le trigger recalcule le stock à partir de TOUS les mouvements, y compris ceux transférés
    
    -- 9. Mettre à jour les métadonnées du master si nécessaire
    -- (garder les meilleures valeurs : description plus complète, image, etc.)
    UPDATE products p1
    SET 
        description = COALESCE(
            NULLIF(p1.description, ''),
            (SELECT description FROM products WHERE id = duplicate_product_id)
        ),
        barcode = COALESCE(
            NULLIF(p1.barcode, ''),
            (SELECT barcode FROM products WHERE id = duplicate_product_id)
        ),
        image_url = COALESCE(
            NULLIF(p1.image_url, ''),
            (SELECT image_url FROM products WHERE id = duplicate_product_id)
        ),
        updated_at = NOW(),
        updated_by = merge_user_id
    WHERE p1.id = master_product_id;
    
    -- 10. Récupérer les informations des produits pour le logging (AVANT suppression)
    SELECT name, sku INTO master_product_name, master_product_sku
    FROM products
    WHERE id = master_product_id;
    
    SELECT name, sku INTO duplicate_product_name, duplicate_product_sku
    FROM products
    WHERE id = duplicate_product_id;
    
    -- 11. Enregistrer la fusion dans l'audit (AVANT suppression pour éviter la violation de contrainte FK)
    INSERT INTO product_merges (master_product_id, merged_product_id, merged_by, merge_reason)
    VALUES (
        master_product_id, 
        duplicate_product_id, 
        merge_user_id, 
        CASE 
            WHEN delete_duplicate THEN 'Duplicate merge (deleted)'
            ELSE 'Duplicate merge (discontinued)'
        END
    );
    
    -- 12. Gérer le produit dupliqué selon l'option choisie (APRÈS l'insertion dans product_merges)
    -- Note: L'enregistrement dans product_merges sera supprimé par CASCADE si on supprime le produit,
    -- mais l'audit complet est déjà dans user_logs
    IF delete_duplicate THEN
        -- Suppression réelle (les CASCADE s'occuperont des relations, y compris product_merges)
        DELETE FROM products WHERE id = duplicate_product_id;
    ELSE
        -- Marquer comme discontinué (conservation de l'historique)
        UPDATE products 
        SET 
            status = 'discontinued',
            current_stock = 0,
            updated_at = NOW(),
            updated_by = merge_user_id
        WHERE id = duplicate_product_id;
    END IF;
    
    -- 13. Le trigger sur stock_movements a déjà recalculé automatiquement le stock
    -- Récupérer le stock final calculé par le trigger (après transfert des mouvements)
    SELECT current_stock INTO master_final_stock
    FROM products
    WHERE id = master_product_id;
    
    -- 14. Logger l'opération dans user_logs
    IF merge_user_id IS NOT NULL THEN
        BEGIN
            -- Récupérer l'email de l'utilisateur
            SELECT email INTO user_email
            FROM auth.users
            WHERE id = merge_user_id;
            
            -- Insérer le log
            INSERT INTO user_logs (
                user_id,
                user_email,
                action,
                page,
                url,
                component,
                details,
                timestamp
            ) VALUES (
                merge_user_id,
                COALESCE(user_email, 'unknown@example.com'),
                'PRODUCT_MERGE',
                '/stock',
                '/stock',
                'ProductMergeModal',
                jsonb_build_object(
                    'master_product_id', master_product_id,
                    'master_product_name', COALESCE(master_product_name, 'Unknown'),
                    'master_product_sku', COALESCE(master_product_sku, 'Unknown'),
                    'merged_product_id', duplicate_product_id,
                    'merged_product_name', COALESCE(duplicate_product_name, 'Unknown'),
                    'merged_product_sku', COALESCE(duplicate_product_sku, 'Unknown'),
                        'delete_duplicate', delete_duplicate,
                        'stock_merged', duplicate_stock,
                        'master_initial_stock', master_initial_stock,
                        'master_new_stock', master_final_stock,
                        'relations_transferred', stats,
                    'merge_reason', CASE 
                        WHEN delete_duplicate THEN 'Duplicate merge (deleted)'
                        ELSE 'Duplicate merge (discontinued)'
                    END
                ),
                NOW()
            );
        EXCEPTION WHEN OTHERS THEN
            -- En cas d'erreur de logging, continuer quand même (ne pas faire échouer la fusion)
            RAISE WARNING 'Erreur lors du logging de la fusion: %', SQLERRM;
        END;
    END IF;
    
    -- 15. Retourner le résultat détaillé
    result := jsonb_build_object(
        'success', true,
        'master_product_id', master_product_id,
        'merged_product_id', duplicate_product_id,
        'stock_merged', duplicate_stock,
        'master_initial_stock', master_initial_stock,
        'master_new_stock', master_final_stock, -- Stock final calculé par le trigger
        'relations_transferred', stats,
        'deleted', delete_duplicate
    );
    
    RETURN result;
        
EXCEPTION WHEN OTHERS THEN
    -- En cas d'erreur, tout est annulé automatiquement (transaction)
    RAISE EXCEPTION 'Error merging products: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissions pour les fonctions RPC (spécifier le schéma public explicitement)
GRANT EXECUTE ON FUNCTION public.preview_merge(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_products(UUID, UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_product_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.select_master_product(UUID[]) TO authenticated;


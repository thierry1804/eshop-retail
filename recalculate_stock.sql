-- Script pour recalculer le stock de tous les produits
-- À exécuter directement dans le SQL Editor de Supabase

-- 0. Supprimer les triggers et fonctions problématiques
DROP TRIGGER IF EXISTS trigger_check_stock_alerts ON products;
DROP TRIGGER IF EXISTS trigger_update_available_stock ON products;
DROP FUNCTION IF EXISTS check_stock_alerts() CASCADE;
DROP FUNCTION IF EXISTS update_available_stock() CASCADE;

-- 1. Mettre à jour le stock de tous les produits basé sur leurs mouvements
UPDATE products 
SET 
    current_stock = COALESCE((
        SELECT SUM(
            CASE 
                WHEN movement_type = 'in' THEN quantity
                WHEN movement_type = 'out' THEN -quantity
                WHEN movement_type = 'adjustment' THEN quantity
                WHEN movement_type = 'transfer' THEN 
                    CASE 
                        WHEN reference_type = 'transfer' AND reference_id IS NOT NULL THEN -quantity
                        ELSE quantity
                    END
                ELSE 0
            END
        )
        FROM stock_movements 
        WHERE product_id = products.id
    ), 0),
    updated_at = NOW();

-- 2. Afficher un résumé des résultats
SELECT 
    'Résumé du recalcul' as info,
    COUNT(*) as total_products,
    SUM(current_stock) as total_stock,
    COUNT(CASE WHEN current_stock > 0 THEN 1 END) as products_with_stock,
    COUNT(CASE WHEN current_stock = 0 THEN 1 END) as products_without_stock
FROM products;

-- 3. Afficher le détail par produit
SELECT 
    p.name as produit,
    p.sku,
    p.current_stock as stock_actuel,
    p.available_stock as stock_disponible,
    COALESCE((
        SELECT COUNT(*)
        FROM stock_movements 
        WHERE product_id = p.id
    ), 0) as nombre_mouvements
FROM products p
ORDER BY p.name;

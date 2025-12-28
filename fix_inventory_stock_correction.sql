-- Script pour corriger les mouvements de stock créés avec le bug ABS() dans finalize_inventory
-- À exécuter dans le SQL Editor de Supabase si le stock n'a pas été corrigé automatiquement

-- 1. Identifier les mouvements à corriger
-- Cette requête montre les mouvements qui ont probablement été créés avec le bug
SELECT 
    sm.id as movement_id,
    sm.product_id,
    p.name as product_name,
    p.sku,
    sm.quantity as current_quantity,
    ii.discrepancy as expected_quantity,
    i.inventory_date,
    i.status as inventory_status,
    CASE 
        WHEN ii.discrepancy != sm.quantity THEN 'À CORRIGER'
        ELSE 'OK'
    END as status
FROM stock_movements sm
JOIN inventory_items ii ON 
    ii.inventory_id = sm.reference_id 
    AND ii.product_id = sm.product_id
JOIN inventories i ON i.id = ii.inventory_id
JOIN products p ON p.id = sm.product_id
WHERE sm.movement_type = 'adjustment'
AND sm.reference_type = 'adjustment'
AND sm.reference_id IS NOT NULL
AND ii.discrepancy != 0
ORDER BY i.inventory_date DESC, p.name;

-- 2. Corriger les mouvements incorrects
-- ATTENTION : Cette requête modifie les données. Vérifiez d'abord avec la requête ci-dessus.
UPDATE stock_movements sm
SET quantity = ii.discrepancy
FROM inventory_items ii
JOIN inventories i ON i.id = ii.inventory_id
WHERE sm.movement_type = 'adjustment'
AND sm.reference_type = 'adjustment'
AND sm.reference_id = ii.inventory_id
AND sm.product_id = ii.product_id
AND ii.discrepancy != sm.quantity
AND i.status = 'completed';

-- 3. Recalculer le stock de tous les produits
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

-- 4. Vérifier le résultat pour un produit spécifique (remplacez le SKU)
SELECT 
    p.name,
    p.sku,
    p.current_stock,
    ii.actual_quantity as inventory_actual,
    ii.theoretical_quantity as inventory_theoretical,
    ii.discrepancy,
    sm.quantity as adjustment_quantity,
    sm.created_at as adjustment_date
FROM products p
JOIN inventory_items ii ON ii.product_id = p.id
JOIN inventories i ON i.id = ii.inventory_id
LEFT JOIN stock_movements sm ON 
    sm.product_id = p.id 
    AND sm.movement_type = 'adjustment'
    AND sm.reference_type = 'adjustment'
    AND sm.reference_id = i.id
WHERE p.sku = 'CYM-251122-00001'  -- Remplacez par le SKU du produit concerné
ORDER BY i.inventory_date DESC
LIMIT 1;


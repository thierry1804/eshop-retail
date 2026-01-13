-- Script pour traiter le dernier inventaire complété
-- Ce script crée les mouvements de stock pour le dernier inventaire complété
-- et ajuste les stocks en conséquence
-- À exécuter dans le SQL Editor de Supabase

-- 1. Vérifier le dernier inventaire complété
SELECT 
    i.id,
    i.inventory_date,
    i.status,
    i.completed_at,
    i.total_products,
    i.counted_products,
    i.total_discrepancies,
    COUNT(sm.id) as existing_movements
FROM inventories i
LEFT JOIN stock_movements sm ON 
    sm.reference_type = 'adjustment' 
    AND sm.reference_id = i.id
WHERE i.status = 'completed'
GROUP BY i.id, i.inventory_date, i.status, i.completed_at, i.total_products, i.counted_products, i.total_discrepancies
ORDER BY i.completed_at DESC NULLS LAST, i.created_at DESC
LIMIT 1;

-- 2. Vérifier les items de cet inventaire qui nécessitent des ajustements
SELECT 
    ii.id,
    p.name as product_name,
    p.sku,
    ii.theoretical_quantity,
    ii.actual_quantity,
    ii.discrepancy,
    CASE 
        WHEN sm.id IS NOT NULL THEN 'Mouvement existe déjà'
        ELSE 'Nouveau mouvement à créer'
    END as status
FROM inventories i
JOIN inventory_items ii ON ii.inventory_id = i.id
JOIN products p ON p.id = ii.product_id
LEFT JOIN stock_movements sm ON 
    sm.reference_type = 'adjustment'
    AND sm.reference_id = i.id
    AND sm.product_id = ii.product_id
WHERE i.status = 'completed'
AND ii.discrepancy != 0
ORDER BY i.completed_at DESC NULLS LAST, i.created_at DESC, p.name
LIMIT 50;

-- 3. Exécuter la fonction pour créer les mouvements de stock
-- Cette fonction vérifie automatiquement qu'il n'y a pas déjà de mouvements
SELECT process_last_completed_inventory();

-- 4. Vérifier les mouvements créés
SELECT 
    sm.id,
    p.name as product_name,
    p.sku,
    sm.quantity,
    sm.reason,
    sm.created_at,
    i.inventory_date
FROM stock_movements sm
JOIN products p ON p.id = sm.product_id
JOIN inventories i ON i.id = sm.reference_id
WHERE sm.movement_type = 'adjustment'
AND sm.reference_type = 'adjustment'
AND i.status = 'completed'
ORDER BY i.completed_at DESC NULLS LAST, i.created_at DESC, sm.created_at DESC
LIMIT 50;

-- 5. Vérifier le stock mis à jour pour un produit spécifique (remplacez le SKU)
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
AND i.status = 'completed'
ORDER BY i.inventory_date DESC
LIMIT 1;


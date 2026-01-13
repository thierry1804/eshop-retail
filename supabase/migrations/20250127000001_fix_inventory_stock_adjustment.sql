-- Migration pour corriger le bug dans finalize_inventory
-- Le problème : ABS() était utilisé, ce qui supprimait le signe de l'écart
-- Résultat : les ajustements négatifs (réduction de stock) étaient traités comme positifs

-- Corriger la fonction finalize_inventory pour utiliser la valeur signée de discrepancy
CREATE OR REPLACE FUNCTION finalize_inventory(
    p_inventory_id UUID,
    p_completed_by UUID
)
RETURNS JSONB AS $$
DECLARE
    v_inventory inventories%ROWTYPE;
    v_item inventory_items%ROWTYPE;
    v_adjustments_count INTEGER := 0;
    v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Récupérer l'inventaire
    SELECT * INTO v_inventory
    FROM inventories
    WHERE id = p_inventory_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Inventaire non trouvé'
        );
    END IF;
    
    IF v_inventory.status = 'completed' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Cet inventaire est déjà finalisé'
        );
    END IF;
    
    -- Vérifier que tous les produits sont comptés
    IF EXISTS (
        SELECT 1 
        FROM inventory_items 
        WHERE inventory_id = p_inventory_id 
        AND actual_quantity IS NULL
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Tous les produits doivent être comptés avant de finaliser'
        );
    END IF;
    
    -- Vérifier qu'il n'existe pas déjà des mouvements de stock pour cet inventaire
    -- Pour éviter de créer des doublons si la fonction est appelée plusieurs fois
    IF EXISTS (
        SELECT 1 
        FROM stock_movements 
        WHERE reference_type = 'adjustment'
        AND reference_id = p_inventory_id
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Des mouvements de stock existent déjà pour cet inventaire'
        );
    END IF;
    
    -- Créer les mouvements de stock pour chaque écart
    -- CORRECTION : Utiliser v_item.discrepancy directement au lieu de ABS(v_item.discrepancy)
    -- Cela permet de gérer correctement les ajustements négatifs (réduction de stock)
    FOR v_item IN 
        SELECT * 
        FROM inventory_items 
        WHERE inventory_id = p_inventory_id 
        AND discrepancy != 0
    LOOP
        BEGIN
            INSERT INTO stock_movements (
                product_id,
                movement_type,
                quantity,
                reference_type,
                reference_id,
                reason,
                notes,
                created_by
            ) VALUES (
                v_item.product_id,
                'adjustment',
                v_item.discrepancy,  -- CORRECTION : Utiliser la valeur signée au lieu de ABS()
                'adjustment',
                p_inventory_id,  -- CORRECTION : Utiliser directement l'UUID au lieu de ::TEXT
                CASE 
                    WHEN v_item.discrepancy > 0 THEN 'Ajustement positif (inventaire)'
                    ELSE 'Ajustement négatif (inventaire)'
                END,
                COALESCE(
                    'Inventaire du ' || v_inventory.inventory_date::TEXT || 
                    CASE WHEN v_item.notes IS NOT NULL THEN ' - ' || v_item.notes ELSE '' END,
                    'Inventaire du ' || v_inventory.inventory_date::TEXT
                ),
                p_completed_by
            );
            
            v_adjustments_count := v_adjustments_count + 1;
        EXCEPTION WHEN OTHERS THEN
            v_errors := array_append(v_errors, 
                'Erreur pour produit ' || v_item.product_id::TEXT || ': ' || SQLERRM
            );
        END;
    END LOOP;
    
    -- Mettre à jour le statut de l'inventaire
    UPDATE inventories
    SET
        status = 'completed',
        completed_by = p_completed_by,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_inventory_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'adjustments_count', v_adjustments_count,
        'errors', v_errors
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour corriger les mouvements de stock existants créés avec le bug ABS()
-- Cette fonction identifie et corrige les ajustements incorrects des inventaires déjà finalisés
CREATE OR REPLACE FUNCTION fix_existing_inventory_adjustments()
RETURNS JSONB AS $$
DECLARE
    v_movement stock_movements%ROWTYPE;
    v_item inventory_items%ROWTYPE;
    v_corrected_count INTEGER := 0;
    v_errors TEXT[] := ARRAY[]::TEXT[];
    v_inventory_id UUID;
    v_expected_quantity INTEGER;
BEGIN
    -- Parcourir tous les mouvements de stock créés par des inventaires
    -- Note: reference_id est de type UUID, donc on peut l'utiliser directement
    FOR v_movement IN 
        SELECT sm.*
        FROM stock_movements sm
        WHERE sm.movement_type = 'adjustment'
        AND sm.reference_type = 'adjustment'
        AND sm.reference_id IS NOT NULL
    LOOP
        BEGIN
            -- Utiliser reference_id directement comme UUID
            v_inventory_id := v_movement.reference_id;
            
            -- Trouver l'item d'inventaire correspondant
            SELECT * INTO v_item
            FROM inventory_items
            WHERE inventory_id = v_inventory_id
            AND product_id = v_movement.product_id
            AND discrepancy != 0;
            
            -- Si l'item existe, vérifier si la quantité du mouvement est incorrecte
            IF FOUND THEN
                -- La quantité attendue devrait être l'écart réel (peut être négatif)
                v_expected_quantity := v_item.discrepancy;
                
                -- Si l'écart est négatif mais la quantité du mouvement est positive, c'est le bug
                -- Ou si l'écart est positif mais la quantité est différente de l'écart
                IF v_expected_quantity != v_movement.quantity THEN
                    -- Corriger la quantité du mouvement
                    UPDATE stock_movements
                    SET quantity = v_expected_quantity
                    WHERE id = v_movement.id;
                    
                    v_corrected_count := v_corrected_count + 1;
                END IF;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_errors := array_append(v_errors, 
                'Erreur pour mouvement ' || v_movement.id::TEXT || ': ' || SQLERRM
            );
        END;
    END LOOP;
    
    -- Recalculer le stock de tous les produits affectés
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
        updated_at = NOW()
    WHERE id IN (
        SELECT DISTINCT product_id
        FROM stock_movements
        WHERE movement_type = 'adjustment'
        AND reference_type = 'adjustment'
        AND reference_id IS NOT NULL
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'corrected_movements', v_corrected_count,
        'errors', v_errors
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour créer les mouvements de stock pour le dernier inventaire complété
-- Cette fonction vérifie qu'il n'y a pas déjà de mouvements pour éviter les doublons
CREATE OR REPLACE FUNCTION process_last_completed_inventory()
RETURNS JSONB AS $$
DECLARE
    v_inventory inventories%ROWTYPE;
    v_item inventory_items%ROWTYPE;
    v_movements_count INTEGER := 0;
    v_errors TEXT[] := ARRAY[]::TEXT[];
    v_existing_movements INTEGER;
BEGIN
    -- Trouver le dernier inventaire complété
    SELECT * INTO v_inventory
    FROM inventories
    WHERE status = 'completed'
    ORDER BY completed_at DESC NULLS LAST, created_at DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Aucun inventaire complété trouvé'
        );
    END IF;
    
    -- Vérifier s'il existe déjà des mouvements de stock pour cet inventaire
    SELECT COUNT(*) INTO v_existing_movements
    FROM stock_movements
    WHERE reference_type = 'adjustment'
    AND reference_id = v_inventory.id;
    
    IF v_existing_movements > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Des mouvements de stock existent déjà pour cet inventaire',
            'inventory_id', v_inventory.id,
            'inventory_date', v_inventory.inventory_date,
            'existing_movements', v_existing_movements
        );
    END IF;
    
    -- Créer les mouvements de stock pour chaque item avec écart
    FOR v_item IN 
        SELECT * 
        FROM inventory_items 
        WHERE inventory_id = v_inventory.id 
        AND discrepancy != 0
    LOOP
        BEGIN
            INSERT INTO stock_movements (
                product_id,
                movement_type,
                quantity,
                reference_type,
                reference_id,
                reason,
                notes,
                created_by
            ) VALUES (
                v_item.product_id,
                'adjustment',
                v_item.discrepancy,
                'adjustment',
                v_inventory.id,
                CASE 
                    WHEN v_item.discrepancy > 0 THEN 'Ajustement positif (inventaire)'
                    ELSE 'Ajustement négatif (inventaire)'
                END,
                COALESCE(
                    'Inventaire du ' || v_inventory.inventory_date::TEXT || 
                    CASE WHEN v_item.notes IS NOT NULL THEN ' - ' || v_item.notes ELSE '' END,
                    'Inventaire du ' || v_inventory.inventory_date::TEXT
                ),
                COALESCE(v_inventory.completed_by, v_inventory.created_by)
            );
            
            v_movements_count := v_movements_count + 1;
        EXCEPTION WHEN OTHERS THEN
            v_errors := array_append(v_errors, 
                'Erreur pour produit ' || v_item.product_id::TEXT || ': ' || SQLERRM
            );
        END;
    END LOOP;
    
    -- Le trigger update_product_stock() mettra automatiquement à jour le stock
    -- Mais on peut aussi forcer un recalcul pour être sûr
    
    RETURN jsonb_build_object(
        'success', true,
        'inventory_id', v_inventory.id,
        'inventory_date', v_inventory.inventory_date,
        'movements_created', v_movements_count,
        'errors', v_errors
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Exécuter automatiquement la correction lors de la migration
SELECT fix_existing_inventory_adjustments();

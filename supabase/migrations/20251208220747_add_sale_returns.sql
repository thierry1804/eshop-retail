-- Migration pour ajouter le support des retours de ventes
-- Cette migration permet de :
-- 1. Ajouter le statut 'returned' aux ventes
-- 2. Créer une fonction pour gérer les retours (annuler vente, remettre en stock, annuler livraison)

-- Ajouter le statut 'returned' au type ENUM sale_status
-- Note: ALTER TYPE ... ADD VALUE ne supporte pas IF NOT EXISTS dans toutes les versions
-- On utilise un DO block pour vérifier si la valeur existe déjà
DO $$ 
BEGIN
    -- Vérifier si 'returned' existe déjà dans l'enum
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'returned' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sale_status')
    ) THEN
        ALTER TYPE sale_status ADD VALUE 'returned';
    END IF;
END $$;

-- Fonction pour retourner une vente
-- Cette fonction :
-- 1. Change le statut de la vente en 'returned'
-- 2. Crée des mouvements de stock de type 'in' pour remettre les articles en stock
-- 3. Annule les livraisons associées (change le statut en 'cancelled')
CREATE OR REPLACE FUNCTION return_sale(
    p_sale_id UUID,
    p_user_id UUID,
    p_return_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_sale RECORD;
    v_sale_item RECORD;
    v_delivery RECORD;
    v_stock_movement_id UUID;
    v_result JSONB;
    v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Vérifier que la vente existe
    SELECT * INTO v_sale
    FROM sales
    WHERE id = p_sale_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Vente non trouvée'
        );
    END IF;
    
    -- Vérifier que la vente n'est pas déjà retournée
    IF v_sale.status = 'returned' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Cette vente a déjà été retournée'
        );
    END IF;
    
    -- Commencer une transaction implicite (chaque opération est dans un bloc TRY)
    BEGIN
        -- 1. Changer le statut de la vente en 'returned'
        UPDATE sales
        SET status = 'returned'::sale_status
        WHERE id = p_sale_id;
        
        -- 2. Pour chaque article de la vente, créer un mouvement de stock de type 'in'
        FOR v_sale_item IN
            SELECT * FROM sale_items WHERE sale_id = p_sale_id
        LOOP
            -- Vérifier que l'article a un article_id (product_id)
            IF v_sale_item.article_id IS NOT NULL THEN
                -- Créer un mouvement de stock pour remettre l'article en stock
                INSERT INTO stock_movements (
                    product_id,
                    movement_type,
                    quantity,
                    reference_type,
                    reference_id,
                    notes,
                    created_by
                ) VALUES (
                    v_sale_item.article_id,
                    'in',
                    v_sale_item.quantity,
                    'return',
                    p_sale_id,
                    COALESCE(p_return_notes, 'Retour de vente - ' || v_sale_item.product_name),
                    p_user_id
                )
                RETURNING id INTO v_stock_movement_id;
            END IF;
        END LOOP;
        
        -- 3. Annuler les livraisons associées à cette vente
        FOR v_delivery IN
            SELECT * FROM deliveries WHERE sale_id = p_sale_id
        LOOP
            -- Ne mettre à jour que si la livraison n'est pas déjà livrée ou annulée
            IF v_delivery.status NOT IN ('delivered', 'cancelled') THEN
                UPDATE deliveries
                SET 
                    status = 'cancelled',
                    updated_by = p_user_id,
                    updated_at = NOW()
                WHERE id = v_delivery.id;
            END IF;
        END LOOP;
        
        -- Retourner un résultat de succès
        v_result := jsonb_build_object(
            'success', true,
            'sale_id', p_sale_id,
            'message', 'Vente retournée avec succès'
        );
        
    EXCEPTION WHEN OTHERS THEN
        -- En cas d'erreur, retourner les détails
        v_result := jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'detail', SQLSTATE
        );
    END;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commentaire sur la fonction
COMMENT ON FUNCTION return_sale(UUID, UUID, TEXT) IS 
'Fonction pour retourner une vente : annule la vente, remet les articles en stock et annule les livraisons associées';


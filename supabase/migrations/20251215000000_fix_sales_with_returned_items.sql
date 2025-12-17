-- Migration pour corriger le calcul du total_amount et remaining_balance
-- en tenant compte des articles retournés
-- 
-- Problème: Quand des articles sont retournés, le total_amount et remaining_balance
-- ne sont pas ajustés pour exclure la valeur des articles retournés
-- Le statut ne doit pas être "paid" si le total est à 0 à cause de retours
--
-- Solution: 
-- 1. Ajouter le statut 'partially_returned' pour les retours partiels
-- 2. Modifier la fonction update_sale_balance() pour calculer le total_amount ajusté
-- 3. Créer une fonction pour déterminer le statut correct selon les retours
-- 4. Recalculer tous les total_amount et remaining_balance existants

-- ============================================
-- PARTIE 0: Note importante
-- ============================================
-- Cette migration suppose que le statut 'partially_returned' a déjà été ajouté
-- à l'enum sale_status dans la migration 20251215000000_add_partially_returned_status.sql
-- Si ce n'est pas le cas, exécutez d'abord cette migration.

-- ============================================
-- PARTIE 1: Fonction helper pour déterminer le statut selon les retours
-- ============================================

CREATE OR REPLACE FUNCTION determine_sale_status_from_returns(p_sale_id UUID, p_adjusted_total NUMERIC(10,2), p_calculated_balance NUMERIC(10,2))
RETURNS sale_status AS $$
DECLARE
    v_total_items_count INTEGER;
    v_returned_items_count INTEGER;
    v_partially_returned_items_count INTEGER;
    v_has_returns BOOLEAN;
BEGIN
    -- Compter les articles
    SELECT COUNT(*) INTO v_total_items_count
    FROM sale_items
    WHERE sale_id = p_sale_id;
    
    -- Compter les articles complètement retournés
    SELECT COUNT(*) INTO v_returned_items_count
    FROM sale_items
    WHERE sale_id = p_sale_id
    AND COALESCE(returned_quantity, 0) >= quantity
    AND quantity > 0;
    
    -- Compter les articles partiellement retournés (retournés mais pas complètement)
    SELECT COUNT(*) INTO v_partially_returned_items_count
    FROM sale_items
    WHERE sale_id = p_sale_id
    AND COALESCE(returned_quantity, 0) > 0
    AND COALESCE(returned_quantity, 0) < quantity;
    
    -- Vérifier s'il y a des retours
    v_has_returns := (v_returned_items_count > 0 OR v_partially_returned_items_count > 0);
    
    -- Si le total ajusté est à 0 à cause de retours, ne pas mettre "paid"
    IF p_adjusted_total <= 0 AND v_has_returns THEN
        -- Si tous les articles sont retournés
        IF v_returned_items_count = v_total_items_count AND v_total_items_count > 0 THEN
            RETURN 'returned'::sale_status;
        -- Si certains articles sont retournés
        ELSIF v_returned_items_count > 0 OR v_partially_returned_items_count > 0 THEN
            RETURN 'partially_returned'::sale_status;
        END IF;
    END IF;
    
    -- Si le solde est à 0 et qu'il n'y a pas de retours, c'est payé
    IF p_calculated_balance <= 0 AND NOT v_has_returns THEN
        RETURN 'paid'::sale_status;
    END IF;
    
    -- Si le solde est à 0 mais qu'il y a des retours partiels
    IF p_calculated_balance <= 0 AND v_has_returns THEN
        IF v_returned_items_count = v_total_items_count AND v_total_items_count > 0 THEN
            RETURN 'returned'::sale_status;
        ELSE
            RETURN 'partially_returned'::sale_status;
        END IF;
    END IF;
    
    -- Sinon, en cours
    RETURN 'ongoing'::sale_status;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PARTIE 2: Fonction helper pour calculer le total ajusté avec retours
-- ============================================

CREATE OR REPLACE FUNCTION calculate_adjusted_sale_total(p_sale_id UUID)
RETURNS NUMERIC(10,2) AS $$
DECLARE
    v_adjusted_total NUMERIC(10,2);
BEGIN
    -- Calculer le total en excluant la valeur des articles retournés
    -- Pour chaque article: (quantity - returned_quantity) * unit_price
    -- Ou si total_price existe: total_price * (quantity - returned_quantity) / quantity
    SELECT COALESCE(
        SUM(
            CASE 
                WHEN COALESCE(si.returned_quantity, 0) >= si.quantity THEN 0
                WHEN si.total_price IS NOT NULL AND si.total_price > 0 THEN
                    -- Utiliser total_price et appliquer le ratio
                    si.total_price * (si.quantity - COALESCE(si.returned_quantity, 0))::NUMERIC / NULLIF(si.quantity, 0)
                ELSE
                    -- Calculer à partir de unit_price
                    (si.quantity - COALESCE(si.returned_quantity, 0)) * si.unit_price
            END
        ),
        0
    ) INTO v_adjusted_total
    FROM sale_items si
    WHERE si.sale_id = p_sale_id;
    
    RETURN v_adjusted_total;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PARTIE 3: Mettre à jour la fonction update_sale_balance()
-- ============================================

CREATE OR REPLACE FUNCTION update_sale_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_sale_id UUID;
    v_adjusted_total NUMERIC(10,2);
    v_calculated_balance NUMERIC(10,2);
BEGIN
    -- Déterminer le sale_id selon le type de trigger
    IF TG_OP = 'DELETE' THEN
        v_sale_id := OLD.sale_id;
    ELSE
        v_sale_id := NEW.sale_id;
    END IF;

    -- Calculer le total ajusté en tenant compte des retours
    v_adjusted_total := calculate_adjusted_sale_total(v_sale_id);
    
    -- Mettre à jour le total_amount avec la valeur ajustée
    UPDATE sales 
    SET total_amount = v_adjusted_total
    WHERE id = v_sale_id;

    -- Calculer le solde restant avec le total ajusté
    SELECT GREATEST(0, 
        v_adjusted_total - COALESCE(s.deposit, 0) - COALESCE(
            (SELECT SUM(p.amount) 
             FROM payments p 
             WHERE p.sale_id = v_sale_id), 
            0
        )
    ) INTO v_calculated_balance
    FROM sales s
    WHERE s.id = v_sale_id;

    -- Mettre à jour le remaining_balance et le status de la vente
    UPDATE sales 
    SET 
        remaining_balance = v_calculated_balance,
        status = determine_sale_status_from_returns(v_sale_id, v_adjusted_total, v_calculated_balance)
    WHERE id = v_sale_id;
    
    -- Retourner la ligne appropriée selon le type d'opération
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PARTIE 3: Fonction helper pour mettre à jour une vente spécifique
-- ============================================

-- Fonction helper pour mettre à jour une vente spécifique
CREATE OR REPLACE FUNCTION update_sale_balance_for_sale(p_sale_id UUID)
RETURNS VOID AS $$
DECLARE
    v_adjusted_total NUMERIC(10,2);
    v_calculated_balance NUMERIC(10,2);
    v_deposit NUMERIC(10,2);
BEGIN
    -- Calculer le total ajusté en tenant compte des retours
    v_adjusted_total := calculate_adjusted_sale_total(p_sale_id);
    
    -- Récupérer le deposit
    SELECT COALESCE(deposit, 0) INTO v_deposit
    FROM sales
    WHERE id = p_sale_id;
    
    -- Calculer le solde restant
    v_calculated_balance := GREATEST(0, 
        v_adjusted_total - v_deposit - COALESCE(
            (SELECT SUM(p.amount) 
             FROM payments p 
             WHERE p.sale_id = p_sale_id), 
            0
        )
    );

    -- Mettre à jour le total_amount, remaining_balance et le status
    UPDATE sales 
    SET 
        total_amount = v_adjusted_total,
        remaining_balance = v_calculated_balance,
        status = determine_sale_status_from_returns(p_sale_id, v_adjusted_total, v_calculated_balance)
    WHERE id = p_sale_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PARTIE 4: Créer un trigger pour mettre à jour le total quand sale_items change
-- ============================================

-- Fonction pour mettre à jour le total_amount quand sale_items change
CREATE OR REPLACE FUNCTION update_sale_total_on_items_change()
RETURNS TRIGGER AS $$
DECLARE
    v_sale_id UUID;
BEGIN
    -- Déterminer le sale_id selon le type de trigger
    IF TG_OP = 'DELETE' THEN
        v_sale_id := OLD.sale_id;
    ELSE
        v_sale_id := NEW.sale_id;
    END IF;

    -- Appeler update_sale_balance pour recalculer tout
    PERFORM update_sale_balance_for_sale(v_sale_id);
    
    -- Retourner la ligne appropriée
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Créer les triggers pour sale_items
DROP TRIGGER IF EXISTS trigger_update_sale_total_on_items_insert ON sale_items;
DROP TRIGGER IF EXISTS trigger_update_sale_total_on_items_update ON sale_items;
DROP TRIGGER IF EXISTS trigger_update_sale_total_on_items_delete ON sale_items;

CREATE TRIGGER trigger_update_sale_total_on_items_insert
    AFTER INSERT ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_sale_total_on_items_change();

CREATE TRIGGER trigger_update_sale_total_on_items_update
    AFTER UPDATE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_sale_total_on_items_change();

CREATE TRIGGER trigger_update_sale_total_on_items_delete
    AFTER DELETE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION update_sale_total_on_items_change();

-- ============================================
-- PARTIE 5: Mettre à jour la fonction return_sale_items pour recalculer après retour
-- ============================================

-- Recréer la fonction return_sale_items avec l'appel à update_sale_balance_for_sale
CREATE OR REPLACE FUNCTION return_sale_items(
    p_sale_id UUID,
    p_user_id UUID,
    p_items_to_return JSONB,
    p_return_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_sale RECORD;
    v_sale_item RECORD;
    v_item_to_return JSONB;
    v_sale_item_id UUID;
    v_quantity_to_return INTEGER;
    v_current_returned INTEGER;
    v_remaining_quantity INTEGER;
    v_delivery RECORD;
    v_stock_movement_id UUID;
    v_result JSONB;
    v_all_items_returned BOOLEAN := true;
    v_total_items_count INTEGER;
    v_returned_items_count INTEGER;
    v_product_name TEXT;
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
    
    -- Vérifier que la vente n'est pas déjà complètement retournée
    IF v_sale.status = 'returned' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Cette vente a déjà été complètement retournée'
        );
    END IF;
    
    -- Vérifier que p_items_to_return est un tableau valide
    IF NOT jsonb_typeof(p_items_to_return) = 'array' OR jsonb_array_length(p_items_to_return) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Aucun article à retourner spécifié'
        );
    END IF;
    
    -- Commencer une transaction
    BEGIN
        -- Traiter chaque article à retourner
        FOR v_item_to_return IN SELECT * FROM jsonb_array_elements(p_items_to_return)
        LOOP
            v_sale_item_id := (v_item_to_return->>'sale_item_id')::UUID;
            v_quantity_to_return := (v_item_to_return->>'quantity_to_return')::INTEGER;
            
            -- Vérifier que l'article existe et appartient à cette vente
            SELECT * INTO v_sale_item
            FROM sale_items
            WHERE id = v_sale_item_id AND sale_id = p_sale_id;
            
            IF NOT FOUND THEN
                CONTINUE; -- Ignorer cet article et passer au suivant
            END IF;
            
            -- Vérifier que la quantité à retourner est valide
            IF v_quantity_to_return <= 0 OR v_quantity_to_return > v_sale_item.quantity THEN
                CONTINUE; -- Ignorer cet article
            END IF;
            
            -- Vérifier qu'on ne retourne pas plus que ce qui n'a pas déjà été retourné
            v_current_returned := COALESCE(v_sale_item.returned_quantity, 0);
            v_remaining_quantity := v_sale_item.quantity - v_current_returned;
            
            IF v_quantity_to_return > v_remaining_quantity THEN
                v_quantity_to_return := v_remaining_quantity; -- Ajuster à la quantité restante
            END IF;
            
            IF v_quantity_to_return <= 0 THEN
                CONTINUE; -- Cet article est déjà complètement retourné
            END IF;
            
            -- 1. Mettre à jour la quantité retournée dans sale_items
            UPDATE sale_items
            SET returned_quantity = COALESCE(returned_quantity, 0) + v_quantity_to_return
            WHERE id = v_sale_item_id;
            
            -- 2. Créer un enregistrement dans sale_item_returns pour l'historique
            INSERT INTO sale_item_returns (
                sale_id,
                sale_item_id,
                quantity_returned,
                return_notes,
                created_by
            ) VALUES (
                p_sale_id,
                v_sale_item_id,
                v_quantity_to_return,
                p_return_notes,
                p_user_id
            );
            
            -- 3. Si l'article a un article_id (product_id), créer un mouvement de stock
            IF v_sale_item.article_id IS NOT NULL THEN
                -- Récupérer le nom du produit depuis la table products
                SELECT name INTO v_product_name
                FROM products
                WHERE id = v_sale_item.article_id;
                
                -- Si le nom n'est pas trouvé, utiliser une valeur par défaut
                v_product_name := COALESCE(v_product_name, 'Article');
                
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
                    v_quantity_to_return,
                    'return',
                    p_sale_id,
                    COALESCE(p_return_notes, 'Retour partiel - ' || v_product_name || ' (qty: ' || v_quantity_to_return || ')'),
                    p_user_id
                )
                RETURNING id INTO v_stock_movement_id;
            END IF;
        END LOOP;
        
        -- NOUVEAU: Recalculer le total_amount et remaining_balance après les retours
        PERFORM update_sale_balance_for_sale(p_sale_id);
        
        -- Vérifier si tous les articles sont maintenant retournés
        SELECT 
            COUNT(*) INTO v_total_items_count
        FROM sale_items
        WHERE sale_id = p_sale_id;
        
        SELECT 
            COUNT(*) INTO v_returned_items_count
        FROM sale_items
        WHERE sale_id = p_sale_id
        AND COALESCE(returned_quantity, 0) >= quantity;
        
        -- Le statut est déjà mis à jour par update_sale_balance_for_sale
        -- On vérifie juste si tous les articles sont retournés pour annuler les livraisons
        IF v_returned_items_count = v_total_items_count AND v_total_items_count > 0 THEN
            
            -- Annuler les livraisons associées si la vente est complètement retournée
            FOR v_delivery IN
                SELECT * FROM deliveries WHERE sale_id = p_sale_id
            LOOP
                IF v_delivery.status NOT IN ('delivered', 'cancelled') THEN
                    UPDATE deliveries
                    SET 
                        status = 'cancelled',
                        updated_by = p_user_id,
                        updated_at = NOW()
                    WHERE id = v_delivery.id;
                END IF;
            END LOOP;
        END IF;
        
        -- Retourner un résultat de succès
        v_result := jsonb_build_object(
            'success', true,
            'sale_id', p_sale_id,
            'message', 'Articles retournés avec succès',
            'all_items_returned', (v_returned_items_count = v_total_items_count AND v_total_items_count > 0)
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

-- ============================================
-- PARTIE 6: Recalculer tous les total_amount et remaining_balance existants
-- ============================================

-- Recalculer tous les total_amount en tenant compte des retours
UPDATE sales s 
SET 
    total_amount = calculate_adjusted_sale_total(s.id),
    remaining_balance = GREATEST(0, 
        calculate_adjusted_sale_total(s.id) - COALESCE(s.deposit, 0) - COALESCE(
            (SELECT SUM(p.amount) 
             FROM payments p 
             WHERE p.sale_id = s.id), 
            0
        )
    ),
    status = determine_sale_status_from_returns(
        s.id, 
        calculate_adjusted_sale_total(s.id),
        GREATEST(0, 
            calculate_adjusted_sale_total(s.id) - COALESCE(s.deposit, 0) - COALESCE(
                (SELECT SUM(p.amount) 
                 FROM payments p 
                 WHERE p.sale_id = s.id), 
                0
            )
        )
    );

-- ============================================
-- PARTIE 7: Commentaires
-- ============================================

COMMENT ON FUNCTION calculate_adjusted_sale_total(UUID) IS 
'Calcule le total d''une vente en excluant la valeur des articles retournés';

COMMENT ON FUNCTION determine_sale_status_from_returns(UUID, NUMERIC, NUMERIC) IS 
'Détermine le statut d''une vente selon les retours : returned si tous retournés, partially_returned si partiels, paid si solde à 0 sans retours, ongoing sinon';

COMMENT ON FUNCTION update_sale_balance_for_sale(UUID) IS 
'Met à jour le total_amount, remaining_balance et status d''une vente en tenant compte des retours';


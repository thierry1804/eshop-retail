-- Migration pour corriger deux problèmes :
-- 1. L'erreur de contrainte "sales_remaining_balance_check" lors des paiements
-- 2. Les totaux à 0 dans les ventes

-- ============================================
-- PARTIE 1: Corriger le trigger pour éviter les valeurs négatives
-- ============================================

-- Améliorer la fonction update_sale_balance() pour utiliser GREATEST(0, ...)
-- Cela garantit que remaining_balance ne sera jamais négatif, même si total_amount est 0
CREATE OR REPLACE FUNCTION update_sale_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_sale_id UUID;
    v_calculated_balance NUMERIC(10,2);
BEGIN
    -- Déterminer le sale_id selon le type de trigger
    IF TG_OP = 'DELETE' THEN
        v_sale_id := OLD.sale_id;
    ELSE
        v_sale_id := NEW.sale_id;
    END IF;

    -- Calculer le solde restant
    SELECT GREATEST(0, 
        COALESCE(s.total_amount, 0) - COALESCE(s.deposit, 0) - COALESCE(
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
        status = CASE 
            WHEN v_calculated_balance <= 0 THEN 'paid'::sale_status
            ELSE 'ongoing'::sale_status
        END
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
-- PARTIE 2: Recalculer tous les total_amount à partir des sale_items
-- ============================================

-- Mettre à jour toutes les ventes pour calculer total_amount depuis sale_items
UPDATE sales s
SET 
    total_amount = COALESCE(
        (SELECT SUM(COALESCE(si.total_price, si.quantity * si.unit_price)) 
         FROM sale_items si 
         WHERE si.sale_id = s.id), 
        0
    )
WHERE s.total_amount = 0 
   OR s.total_amount IS NULL
   OR EXISTS (
       SELECT 1 
       FROM sale_items si 
       WHERE si.sale_id = s.id
       AND COALESCE(si.total_price, si.quantity * si.unit_price) > 0
   );

-- ============================================
-- PARTIE 3: Recalculer tous les remaining_balance après correction des total_amount
-- ============================================

-- Recalculer tous les remaining_balance pour toutes les ventes
UPDATE sales s 
SET 
    remaining_balance = GREATEST(0, 
        COALESCE(s.total_amount, 0) - COALESCE(s.deposit, 0) - COALESCE(
            (SELECT SUM(p.amount) 
             FROM payments p 
             WHERE p.sale_id = s.id), 
            0
        )
    ),
    status = CASE 
        WHEN GREATEST(0, 
            COALESCE(s.total_amount, 0) - COALESCE(s.deposit, 0) - COALESCE(
                (SELECT SUM(p.amount) 
                 FROM payments p 
                 WHERE p.sale_id = s.id), 
                0
            )
        ) <= 0 THEN 'paid'::sale_status
        ELSE 'ongoing'::sale_status
    END;

-- ============================================
-- PARTIE 4: Afficher un résumé des corrections
-- ============================================

DO $$
DECLARE
    v_zero_totals_count INTEGER;
    v_negative_balances_count INTEGER;
BEGIN
    -- Compter les ventes avec total_amount = 0 qui ont des articles
    SELECT COUNT(*) INTO v_zero_totals_count
    FROM sales s
    WHERE s.total_amount = 0 
    AND EXISTS (
        SELECT 1 
        FROM sale_items si 
        WHERE si.sale_id = s.id
        AND COALESCE(si.total_price, si.quantity * si.unit_price) > 0
    );
    
    -- Compter les ventes avec remaining_balance < 0
    SELECT COUNT(*) INTO v_negative_balances_count
    FROM sales s
    WHERE s.remaining_balance < 0;
    
    IF v_zero_totals_count > 0 THEN
        RAISE NOTICE 'Attention: % ventes ont encore total_amount = 0 mais ont des articles avec montant > 0. Vérifiez manuellement.', v_zero_totals_count;
    END IF;
    
    IF v_negative_balances_count > 0 THEN
        RAISE NOTICE 'Attention: % ventes ont encore remaining_balance < 0. Vérifiez manuellement.', v_negative_balances_count;
    END IF;
    
    IF v_zero_totals_count = 0 AND v_negative_balances_count = 0 THEN
        RAISE NOTICE '✅ Toutes les ventes ont été corrigées avec succès.';
    END IF;
END $$;


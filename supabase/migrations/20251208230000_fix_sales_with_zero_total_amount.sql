-- Migration pour corriger les ventes avec total_amount = 0
-- Recalculer le total_amount à partir des sale_items pour les ventes concernées

UPDATE sales s
SET 
    total_amount = COALESCE(
        (SELECT SUM(COALESCE(si.total_price, si.quantity * si.unit_price)) 
         FROM sale_items si 
         WHERE si.sale_id = s.id), 
        0
    ),
    remaining_balance = GREATEST(0, 
        COALESCE(
            (SELECT SUM(COALESCE(si.total_price, si.quantity * si.unit_price)) 
             FROM sale_items si 
             WHERE si.sale_id = s.id), 
            0
        ) - s.deposit - COALESCE(
            (SELECT SUM(p.amount) 
             FROM payments p 
             WHERE p.sale_id = s.id), 
            0
        )
    ),
    status = CASE 
        WHEN COALESCE(
            (SELECT SUM(COALESCE(si.total_price, si.quantity * si.unit_price)) 
             FROM sale_items si 
             WHERE si.sale_id = s.id), 
            0
        ) - s.deposit - COALESCE(
            (SELECT SUM(p.amount) 
             FROM payments p 
             WHERE p.sale_id = s.id), 
            0
        ) <= 0 THEN 'paid'::sale_status
        ELSE 'ongoing'::sale_status
    END
WHERE s.total_amount = 0 
AND EXISTS (
    SELECT 1 
    FROM sale_items si 
    WHERE si.sale_id = s.id
    AND COALESCE(si.total_price, si.quantity * si.unit_price) > 0
);

-- Afficher un message pour les ventes corrigées
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM sales s
    WHERE s.total_amount = 0 
    AND EXISTS (
        SELECT 1 
        FROM sale_items si 
        WHERE si.sale_id = s.id
        AND COALESCE(si.total_price, si.quantity * si.unit_price) > 0
    );
    
    IF v_count > 0 THEN
        RAISE NOTICE 'Attention: % ventes ont encore total_amount = 0 mais ont des articles avec montant > 0. Vérifiez manuellement.', v_count;
    END IF;
END $$;


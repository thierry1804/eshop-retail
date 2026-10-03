-- Clôture de période de stock : snapshot + remise à 0 via mouvements adjustment

CREATE TABLE IF NOT EXISTS stock_period_closures (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    closed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('all', 'selection')),
    notes TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    product_count INTEGER NOT NULL DEFAULT 0,
    total_stock_before INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_period_closures_closed_at
    ON stock_period_closures(closed_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_period_closures_created_by
    ON stock_period_closures(created_by);

CREATE TABLE IF NOT EXISTS stock_period_closure_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    closure_id UUID NOT NULL REFERENCES stock_period_closures(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    stock_before INTEGER NOT NULL DEFAULT 0,
    reserved_before INTEGER NOT NULL DEFAULT 0,
    min_stock_level_before INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (closure_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_period_closure_items_closure
    ON stock_period_closure_items(closure_id);
CREATE INDEX IF NOT EXISTS idx_stock_period_closure_items_product
    ON stock_period_closure_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_period_closure_items_product_closed
    ON stock_period_closure_items(product_id, closure_id);

ALTER TABLE stock_period_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_period_closure_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read stock_period_closures" ON stock_period_closures
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow insert stock_period_closures" ON stock_period_closures
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow read stock_period_closure_items" ON stock_period_closure_items
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow insert stock_period_closure_items" ON stock_period_closure_items
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- RPC atomique : clôture globale (actifs) ou par sélection
CREATE OR REPLACE FUNCTION close_stock_period(
    p_product_ids UUID[] DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_closed_by UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_closed_by UUID;
    v_scope VARCHAR(20);
    v_closure_id UUID;
    v_product RECORD;
    v_closed_count INTEGER := 0;
    v_adjustments_count INTEGER := 0;
    v_total_stock_before INTEGER := 0;
    v_excluded JSONB := '[]'::JSONB;
    v_eligible_ids UUID[];
BEGIN
    v_closed_by := COALESCE(p_closed_by, auth.uid());

    IF v_closed_by IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Utilisateur non authentifié'
        );
    END IF;

    IF p_product_ids IS NULL THEN
        v_scope := 'all';
        SELECT ARRAY_AGG(id) INTO v_eligible_ids
        FROM products
        WHERE status = 'active';
    ELSE
        v_scope := 'selection';
        IF array_length(p_product_ids, 1) IS NULL OR array_length(p_product_ids, 1) = 0 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Aucun produit sélectionné'
            );
        END IF;
        v_eligible_ids := p_product_ids;
    END IF;

    IF v_eligible_ids IS NULL OR array_length(v_eligible_ids, 1) IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Aucun produit à clôturer'
        );
    END IF;

    -- Exclure les produits avec stock réservé
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'sku', p.sku,
                'reserved_stock', p.reserved_stock,
                'reason', 'reserved_stock'
            )
        ),
        '[]'::JSONB
    )
    INTO v_excluded
    FROM products p
    WHERE p.id = ANY(v_eligible_ids)
      AND p.reserved_stock > 0;

    SELECT ARRAY_AGG(p.id)
    INTO v_eligible_ids
    FROM products p
    WHERE p.id = ANY(v_eligible_ids)
      AND p.reserved_stock = 0;

    IF v_eligible_ids IS NULL OR array_length(v_eligible_ids, 1) IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Tous les produits sélectionnés ont un stock réservé et ont été exclus',
            'excluded', v_excluded
        );
    END IF;

    SELECT COALESCE(SUM(current_stock), 0)
    INTO v_total_stock_before
    FROM products
    WHERE id = ANY(v_eligible_ids);

    INSERT INTO stock_period_closures (
        closed_at,
        scope,
        notes,
        created_by,
        product_count,
        total_stock_before
    ) VALUES (
        NOW(),
        v_scope,
        p_notes,
        v_closed_by,
        array_length(v_eligible_ids, 1),
        v_total_stock_before
    )
    RETURNING id INTO v_closure_id;

    FOR v_product IN
        SELECT id, current_stock, reserved_stock, min_stock_level, name
        FROM products
        WHERE id = ANY(v_eligible_ids)
        FOR UPDATE
    LOOP
        INSERT INTO stock_period_closure_items (
            closure_id,
            product_id,
            stock_before,
            reserved_before,
            min_stock_level_before
        ) VALUES (
            v_closure_id,
            v_product.id,
            v_product.current_stock,
            v_product.reserved_stock,
            v_product.min_stock_level
        );

        v_closed_count := v_closed_count + 1;

        IF v_product.current_stock != 0 THEN
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
                v_product.id,
                'adjustment',
                -v_product.current_stock,
                'adjustment',
                v_closure_id,
                'period_close',
                COALESCE(
                    'Clôture de période' ||
                    CASE WHEN p_notes IS NOT NULL AND length(trim(p_notes)) > 0
                         THEN ' — ' || p_notes
                         ELSE ''
                    END,
                    'Clôture de période'
                ),
                v_closed_by
            );
            v_adjustments_count := v_adjustments_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'closure_id', v_closure_id,
        'scope', v_scope,
        'closed_count', v_closed_count,
        'adjustments_count', v_adjustments_count,
        'total_stock_before', v_total_stock_before,
        'excluded', v_excluded
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION close_stock_period(UUID[], TEXT, UUID) TO authenticated;

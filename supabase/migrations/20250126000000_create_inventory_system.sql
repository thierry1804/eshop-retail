-- Migration pour créer le système d'inventaire complet

-- 1. Table des inventaires
CREATE TABLE IF NOT EXISTS inventories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    inventory_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled')),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    completed_by UUID REFERENCES auth.users(id),
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    total_products INTEGER NOT NULL DEFAULT 0,
    counted_products INTEGER NOT NULL DEFAULT 0,
    total_discrepancies INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Table des items d'inventaire
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    inventory_id UUID NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    theoretical_quantity INTEGER NOT NULL,
    actual_quantity INTEGER,
    discrepancy INTEGER GENERATED ALWAYS AS (COALESCE(actual_quantity, 0) - theoretical_quantity) STORED,
    notes TEXT,
    counted_by UUID REFERENCES auth.users(id),
    counted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(inventory_id, product_id) -- Un produit ne peut apparaître qu'une fois par inventaire
);

-- 3. Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_inventories_date ON inventories(inventory_date);
CREATE INDEX IF NOT EXISTS idx_inventories_status ON inventories(status);
CREATE INDEX IF NOT EXISTS idx_inventories_created_by ON inventories(created_by);
CREATE INDEX IF NOT EXISTS idx_inventories_completed_by ON inventories(completed_by);

CREATE INDEX IF NOT EXISTS idx_inventory_items_inventory_id ON inventory_items(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_product_id ON inventory_items(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_composite ON inventory_items(inventory_id, product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_counted_by ON inventory_items(counted_by);

-- 4. RLS (Row Level Security) pour inventories
ALTER TABLE inventories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to authenticated users" ON inventories;
DROP POLICY IF EXISTS "Allow insert to authenticated users" ON inventories;
DROP POLICY IF EXISTS "Allow update to authenticated users" ON inventories;
DROP POLICY IF EXISTS "Allow delete to authenticated users" ON inventories;

CREATE POLICY "Allow read access to authenticated users" ON inventories
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert to authenticated users" ON inventories
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update to authenticated users" ON inventories
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow delete to authenticated users" ON inventories
    FOR DELETE USING (auth.role() = 'authenticated');

-- 5. RLS pour inventory_items
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to authenticated users" ON inventory_items;
DROP POLICY IF EXISTS "Allow insert to authenticated users" ON inventory_items;
DROP POLICY IF EXISTS "Allow update to authenticated users" ON inventory_items;
DROP POLICY IF EXISTS "Allow delete to authenticated users" ON inventory_items;

CREATE POLICY "Allow read access to authenticated users" ON inventory_items
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert to authenticated users" ON inventory_items
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update to authenticated users" ON inventory_items
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow delete to authenticated users" ON inventory_items
    FOR DELETE USING (auth.role() = 'authenticated');

-- 6. Fonction pour mettre à jour les statistiques d'un inventaire
CREATE OR REPLACE FUNCTION update_inventory_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE inventories
    SET
        total_products = (
            SELECT COUNT(*) 
            FROM inventory_items 
            WHERE inventory_id = COALESCE(NEW.inventory_id, OLD.inventory_id)
        ),
        counted_products = (
            SELECT COUNT(*) 
            FROM inventory_items 
            WHERE inventory_id = COALESCE(NEW.inventory_id, OLD.inventory_id)
            AND actual_quantity IS NOT NULL
        ),
        total_discrepancies = (
            SELECT COUNT(*) 
            FROM inventory_items 
            WHERE inventory_id = COALESCE(NEW.inventory_id, OLD.inventory_id)
            AND actual_quantity IS NOT NULL
            AND (COALESCE(actual_quantity, 0) - theoretical_quantity) != 0
        ),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.inventory_id, OLD.inventory_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 7. Trigger pour mettre à jour les statistiques automatiquement
DROP TRIGGER IF EXISTS trigger_update_inventory_stats ON inventory_items;
CREATE TRIGGER trigger_update_inventory_stats
    AFTER INSERT OR UPDATE OR DELETE ON inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_stats();

-- 8. Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Triggers pour updated_at
DROP TRIGGER IF EXISTS trigger_inventories_updated_at ON inventories;
CREATE TRIGGER trigger_inventories_updated_at
    BEFORE UPDATE ON inventories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_inventory_items_updated_at ON inventory_items;
CREATE TRIGGER trigger_inventory_items_updated_at
    BEFORE UPDATE ON inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 10. Fonction pour finaliser un inventaire et créer les ajustements de stock
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
    
    -- Créer les mouvements de stock pour chaque écart
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
                ABS(v_item.discrepancy),
                'adjustment',
                p_inventory_id::TEXT,
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

-- 11. Fonction pour créer un inventaire avec tous les produits actifs
CREATE OR REPLACE FUNCTION create_inventory_with_all_products(
    p_inventory_date DATE,
    p_created_by UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_inventory_id UUID;
    v_product RECORD;
BEGIN
    -- Créer l'inventaire
    INSERT INTO inventories (
        inventory_date,
        status,
        created_by,
        notes
    ) VALUES (
        p_inventory_date,
        'in_progress',
        p_created_by,
        p_notes
    ) RETURNING id INTO v_inventory_id;
    
    -- Ajouter tous les produits actifs avec leur stock théorique actuel
    FOR v_product IN 
        SELECT id, current_stock
        FROM products
        WHERE status = 'active'
        ORDER BY name
    LOOP
        INSERT INTO inventory_items (
            inventory_id,
            product_id,
            theoretical_quantity
        ) VALUES (
            v_inventory_id,
            v_product.id,
            COALESCE(v_product.current_stock, 0)
        );
    END LOOP;
    
    RETURN v_inventory_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Fonction pour vérifier si un inventaire de fin de semaine existe déjà
CREATE OR REPLACE FUNCTION get_or_create_weekend_inventory(
    p_created_by UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID AS $$
DECLARE
    v_inventory_id UUID;
    v_day_of_week INTEGER;
    v_friday_date DATE;
    v_saturday_date DATE;
BEGIN
    -- Calculer les dates de vendredi et samedi de la semaine
    v_day_of_week := EXTRACT(DOW FROM p_date)::INTEGER;
    
    -- Si c'est vendredi (5) ou samedi (6), utiliser cette date
    -- Sinon, calculer le vendredi précédent
    IF v_day_of_week = 5 THEN
        v_friday_date := p_date;
        v_saturday_date := p_date + INTERVAL '1 day';
    ELSIF v_day_of_week = 6 THEN
        v_friday_date := p_date - INTERVAL '1 day';
        v_saturday_date := p_date;
    ELSE
        -- Calculer le vendredi précédent
        v_friday_date := p_date - (v_day_of_week + 2)::INTEGER;
        v_saturday_date := v_friday_date + INTERVAL '1 day';
    END IF;
    
    -- Vérifier si un inventaire existe déjà pour cette période
    SELECT id INTO v_inventory_id
    FROM inventories
    WHERE inventory_date IN (v_friday_date, v_saturday_date)
    AND status != 'cancelled'
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Si aucun inventaire n'existe, en créer un nouveau
    IF v_inventory_id IS NULL THEN
        v_inventory_id := create_inventory_with_all_products(
            v_friday_date,
            p_created_by,
            'Inventaire automatique de fin de semaine'
        );
    END IF;
    
    RETURN v_inventory_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


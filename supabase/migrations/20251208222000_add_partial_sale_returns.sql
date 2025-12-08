-- Migration pour ajouter le support des retours partiels d'articles
-- Cette migration permet de :
-- 1. Ajouter une colonne returned_quantity à sale_items pour tracer les quantités retournées
-- 2. Créer une table sale_item_returns pour l'historique des retours
-- 3. Modifier la fonction return_sale pour accepter une liste d'articles à retourner

-- Ajouter une colonne pour tracer les quantités retournées
ALTER TABLE sale_items 
ADD COLUMN IF NOT EXISTS returned_quantity INTEGER DEFAULT 0 CHECK (returned_quantity >= 0 AND returned_quantity <= quantity);

-- Créer une table pour l'historique des retours d'articles
CREATE TABLE IF NOT EXISTS sale_item_returns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    sale_item_id UUID NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
    quantity_returned INTEGER NOT NULL CHECK (quantity_returned > 0),
    return_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_sale_item_returns_sale ON sale_item_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_item_returns_item ON sale_item_returns(sale_item_id);

-- RLS (Row Level Security)
ALTER TABLE sale_item_returns ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour sale_item_returns
CREATE POLICY "Allow read access to authenticated users" ON sale_item_returns
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert to authenticated users" ON sale_item_returns
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Fonction pour retourner des articles spécifiques d'une vente
-- p_sale_id: ID de la vente
-- p_user_id: ID de l'utilisateur qui effectue le retour
-- p_items_to_return: Tableau JSON avec [{sale_item_id, quantity_to_return}, ...]
-- p_return_notes: Notes optionnelles sur le retour
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
                    COALESCE(p_return_notes, 'Retour partiel - ' || v_sale_item.product_name || ' (qty: ' || v_quantity_to_return || ')'),
                    p_user_id
                )
                RETURNING id INTO v_stock_movement_id;
            END IF;
        END LOOP;
        
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
        
        -- Si tous les articles sont retournés, changer le statut de la vente en 'returned'
        IF v_returned_items_count = v_total_items_count AND v_total_items_count > 0 THEN
            UPDATE sales
            SET status = 'returned'::sale_status
            WHERE id = p_sale_id;
            
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

-- Commentaire sur la fonction
COMMENT ON FUNCTION return_sale_items(UUID, UUID, JSONB, TEXT) IS 
'Fonction pour retourner des articles spécifiques d''une vente : remet les articles en stock et met à jour les quantités retournées. Si tous les articles sont retournés, la vente devient ''returned'' et les livraisons sont annulées.';

-- Garder l'ancienne fonction pour la compatibilité (retour complet de la vente)
-- Elle appelle maintenant return_sale_items avec tous les articles
CREATE OR REPLACE FUNCTION return_sale(
    p_sale_id UUID,
    p_user_id UUID,
    p_return_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_all_items JSONB;
    v_item RECORD;
BEGIN
    -- Récupérer tous les articles de la vente
    SELECT jsonb_agg(
        jsonb_build_object(
            'sale_item_id', id,
            'quantity_to_return', quantity
        )
    ) INTO v_all_items
    FROM sale_items
    WHERE sale_id = p_sale_id;
    
    -- Si aucun article, retourner une erreur
    IF v_all_items IS NULL OR jsonb_array_length(v_all_items) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Aucun article trouvé pour cette vente'
        );
    END IF;
    
    -- Appeler la fonction de retour partiel avec tous les articles
    RETURN return_sale_items(p_sale_id, p_user_id, v_all_items, p_return_notes);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


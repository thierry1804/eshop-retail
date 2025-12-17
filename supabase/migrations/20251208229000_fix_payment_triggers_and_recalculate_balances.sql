-- Migration pour corriger les triggers de paiements et recalculer les remaining_balance
-- Problème: Le trigger ne se déclenche que sur INSERT, pas sur UPDATE ou DELETE
-- Solution: Ajouter des triggers pour UPDATE et DELETE, et recalculer tous les remaining_balance

-- Améliorer la fonction pour qu'elle fonctionne aussi avec UPDATE et DELETE
CREATE OR REPLACE FUNCTION update_sale_balance()
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

    -- Mettre à jour le remaining_balance et le status de la vente
    UPDATE sales 
    SET 
        remaining_balance = total_amount - deposit - (
            SELECT COALESCE(SUM(amount), 0) 
            FROM payments 
            WHERE sale_id = v_sale_id
        ),
        status = CASE 
            WHEN total_amount - deposit - (
                SELECT COALESCE(SUM(amount), 0) 
                FROM payments 
                WHERE sale_id = v_sale_id
            ) <= 0 THEN 'paid'::sale_status
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

-- Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS trigger_update_sale_balance ON payments;

-- Créer les triggers pour INSERT, UPDATE et DELETE
CREATE TRIGGER trigger_update_sale_balance_on_insert
    AFTER INSERT ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_sale_balance();

CREATE TRIGGER trigger_update_sale_balance_on_update
    AFTER UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_sale_balance();

CREATE TRIGGER trigger_update_sale_balance_on_delete
    AFTER DELETE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_sale_balance();

-- Recalculer tous les remaining_balance existants pour corriger les incohérences
UPDATE sales s 
SET 
    remaining_balance = GREATEST(0, s.total_amount - s.deposit - COALESCE(
        (SELECT SUM(p.amount) FROM payments p WHERE p.sale_id = s.id), 0
    )),
    status = CASE 
        WHEN s.total_amount - s.deposit - COALESCE(
            (SELECT SUM(p.amount) FROM payments p WHERE p.sale_id = s.id), 0
        ) <= 0 THEN 'paid'::sale_status
        ELSE 'ongoing'::sale_status
    END;


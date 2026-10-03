-- Clôture administrative des commandes d'achat (short close / annulation)

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS close_reason TEXT,
  ADD COLUMN IF NOT EXISTS close_mode VARCHAR(20)
    CHECK (close_mode IS NULL OR close_mode IN ('short_close', 'cancel'));

COMMENT ON COLUMN purchase_orders.close_mode IS 'short_close = qty ajustées au reçu; cancel = annulée sans réception';

-- Ne pas écraser un statut cancelled lors des MAJ d'articles
CREATE OR REPLACE FUNCTION update_purchase_order_status()
RETURNS TRIGGER AS $$
DECLARE
    total_ordered INTEGER;
    total_received INTEGER;
    new_status VARCHAR(20);
    current_status VARCHAR(20);
    order_id UUID;
BEGIN
    order_id := COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);

    SELECT status INTO current_status
    FROM purchase_orders
    WHERE id = order_id;

    IF current_status = 'cancelled' THEN
      RETURN COALESCE(NEW, OLD);
    END IF;

    SELECT
        COALESCE(SUM(quantity_ordered), 0),
        COALESCE(SUM(quantity_received), 0)
    INTO total_ordered, total_received
    FROM purchase_order_items
    WHERE purchase_order_id = order_id;

    IF total_ordered = 0 THEN
        new_status := 'cancelled';
    ELSIF total_received = 0 THEN
        new_status := 'ordered';
    ELSIF total_received < total_ordered THEN
        new_status := 'partial';
    ELSE
        new_status := 'received';
    END IF;

    UPDATE purchase_orders
    SET status = new_status, updated_at = NOW()
    WHERE id = order_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION close_purchase_order(
  p_order_id UUID,
  p_mode TEXT,
  p_reason TEXT,
  p_closed_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order purchase_orders%ROWTYPE;
  v_total_received INTEGER;
  v_items_adjusted INTEGER := 0;
  v_items_removed INTEGER := 0;
  v_reason TEXT;
BEGIN
  IF p_mode NOT IN ('short_close', 'cancel') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mode invalide.');
  END IF;

  v_reason := NULLIF(trim(COALESCE(p_reason, '')), '');
  IF v_reason IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un motif est obligatoire.');
  END IF;

  SELECT * INTO v_order
  FROM purchase_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Commande introuvable.');
  END IF;

  IF v_order.status IN ('received', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette commande est déjà clôturée.');
  END IF;

  IF v_order.status NOT IN ('ordered', 'partial', 'pending') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Seules les commandes commandées / partielles peuvent être clôturées.'
    );
  END IF;

  SELECT COALESCE(SUM(quantity_received), 0)
  INTO v_total_received
  FROM purchase_order_items
  WHERE purchase_order_id = p_order_id;

  IF p_mode = 'cancel' THEN
    IF v_total_received > 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Des quantités ont déjà été reçues. Utilisez la clôture courte.'
      );
    END IF;

    UPDATE purchase_orders
    SET
      status = 'cancelled',
      closed_at = NOW(),
      closed_by = p_closed_by,
      close_reason = v_reason,
      close_mode = 'cancel',
      updated_at = NOW(),
      updated_by = p_closed_by
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
      'success', true,
      'mode', 'cancel',
      'status', 'cancelled',
      'items_adjusted', 0,
      'items_removed', 0
    );
  END IF;

  -- short_close
  IF v_total_received = 0 THEN
    -- Rien reçu → équivalent annulation
    UPDATE purchase_orders
    SET
      status = 'cancelled',
      closed_at = NOW(),
      closed_by = p_closed_by,
      close_reason = v_reason,
      close_mode = 'cancel',
      updated_at = NOW(),
      updated_by = p_closed_by
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
      'success', true,
      'mode', 'cancel',
      'status', 'cancelled',
      'items_adjusted', 0,
      'items_removed', 0,
      'note', 'Aucune quantité reçue : commande annulée.'
    );
  END IF;

  -- Supprimer les lignes sans réception (qty_ordered ne peut pas être 0)
  WITH deleted AS (
    DELETE FROM purchase_order_items
    WHERE purchase_order_id = p_order_id
      AND quantity_received = 0
    RETURNING id
  )
  SELECT COUNT(*) INTO v_items_removed FROM deleted;

  -- Ajuster qty commandée = qty reçue
  WITH updated AS (
    UPDATE purchase_order_items
    SET
      quantity_ordered = quantity_received,
      updated_at = NOW()
    WHERE purchase_order_id = p_order_id
      AND quantity_received > 0
      AND quantity_ordered <> quantity_received
    RETURNING id
  )
  SELECT COUNT(*) INTO v_items_adjusted FROM updated;

  UPDATE purchase_orders
  SET
    status = 'received',
    closed_at = NOW(),
    closed_by = p_closed_by,
    close_reason = v_reason,
    close_mode = 'short_close',
    updated_at = NOW(),
    updated_by = p_closed_by
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'mode', 'short_close',
    'status', 'received',
    'items_adjusted', v_items_adjusted,
    'items_removed', v_items_removed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION close_purchase_order(UUID, TEXT, TEXT, UUID) TO authenticated;

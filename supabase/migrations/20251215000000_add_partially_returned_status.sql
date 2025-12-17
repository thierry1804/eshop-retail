-- Migration pour ajouter le statut 'partially_returned' à l'enum sale_status
-- Cette migration doit être exécutée AVANT 20251215000000_fix_sales_with_returned_items.sql
-- car PostgreSQL ne permet pas d'utiliser une nouvelle valeur d'enum dans la même transaction

DO $$ 
BEGIN
    -- Vérifier si 'partially_returned' existe déjà dans l'enum
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'partially_returned' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sale_status')
    ) THEN
        ALTER TYPE sale_status ADD VALUE 'partially_returned';
    END IF;
END $$;


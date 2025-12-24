-- Migration pour ajouter les champs requis pour les paiements mobile money
-- et créer la contrainte mobile_money_fields_check

-- Ajouter les colonnes pour mobile money
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS provider VARCHAR(50),
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100);

-- Créer la contrainte qui vérifie que les champs sont remplis pour mobile_money
-- Si payment_method = 'mobile_money', alors provider, phone_number et transaction_id doivent être non NULL
DO $$
BEGIN
    -- Supprimer la contrainte si elle existe déjà
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'mobile_money_fields_check'
        AND table_name = 'payments'
    ) THEN
        ALTER TABLE payments DROP CONSTRAINT mobile_money_fields_check;
    END IF;
    
    -- Créer la contrainte
    ALTER TABLE payments
    ADD CONSTRAINT mobile_money_fields_check
    CHECK (
        (payment_method != 'mobile_money') OR
        (payment_method = 'mobile_money' AND provider IS NOT NULL AND phone_number IS NOT NULL AND transaction_id IS NOT NULL)
    );
END $$;

-- Commentaire sur les colonnes
COMMENT ON COLUMN payments.provider IS 'Fournisseur de mobile money (Orange Money, Airtel Money, MVola, etc.)';
COMMENT ON COLUMN payments.phone_number IS 'Numéro de téléphone utilisé pour le paiement mobile money';
COMMENT ON COLUMN payments.transaction_id IS 'Identifiant de la transaction mobile money';



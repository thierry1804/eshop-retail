-- Création de la table des tracking numbers pour le suivi des colis
CREATE TABLE tracking_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    tracking_number VARCHAR(100) NOT NULL,
    
    -- Dimensions (en cm)
    length DECIMAL(10,2),
    width DECIMAL(10,2),
    height DECIMAL(10,2),
    
    -- Volume calculé automatiquement (en m³)
    -- Conversion : cm³ vers m³ = (length * width * height) / 1,000,000
    volume_m3 DECIMAL(10,6) GENERATED ALWAYS AS (
        CASE 
            WHEN length IS NOT NULL AND width IS NOT NULL AND height IS NOT NULL 
            THEN (length * width * height) / 1000000.0
            ELSE NULL 
        END
    ) STORED,
    
    -- Poids (en kg)
    weight_kg DECIMAL(10,2),
    
    -- Tarifs (en USD)
    rate_per_m3 DECIMAL(10,2),
    rate_per_kg DECIMAL(10,2),
    
    -- Taux de change USD -> MGA
    exchange_rate_mga DECIMAL(10,2),
    
    -- Coût calculé par volume (USD)
    -- Calcul direct à partir des dimensions de base (ne peut pas référencer volume_m3)
    cost_by_volume_usd DECIMAL(15,2) GENERATED ALWAYS AS (
        CASE 
            WHEN length IS NOT NULL AND width IS NOT NULL AND height IS NOT NULL 
                 AND rate_per_m3 IS NOT NULL 
            THEN ((length * width * height) / 1000000.0) * rate_per_m3
            ELSE 0 
        END
    ) STORED,
    
    -- Coût calculé par poids (USD)
    cost_by_weight_usd DECIMAL(15,2) GENERATED ALWAYS AS (
        CASE 
            WHEN weight_kg IS NOT NULL AND rate_per_kg IS NOT NULL 
            THEN weight_kg * rate_per_kg 
            ELSE 0 
        END
    ) STORED,
    
    -- Coût total USD (le maximum entre volume et poids)
    -- Calcul direct à partir des colonnes de base (ne peut pas référencer cost_by_volume_usd et cost_by_weight_usd)
    total_cost_usd DECIMAL(15,2) GENERATED ALWAYS AS (
        GREATEST(
            CASE 
                WHEN length IS NOT NULL AND width IS NOT NULL AND height IS NOT NULL 
                     AND rate_per_m3 IS NOT NULL 
                THEN ((length * width * height) / 1000000.0) * rate_per_m3
                ELSE 0 
            END,
            CASE 
                WHEN weight_kg IS NOT NULL AND rate_per_kg IS NOT NULL 
                THEN weight_kg * rate_per_kg 
                ELSE 0 
            END
        )
    ) STORED,
    
    -- Coût total en MGA
    -- Calcul direct à partir des colonnes de base (ne peut pas référencer total_cost_usd)
    total_cost_mga DECIMAL(15,2) GENERATED ALWAYS AS (
        CASE 
            WHEN exchange_rate_mga IS NOT NULL THEN
                GREATEST(
                    CASE 
                        WHEN length IS NOT NULL AND width IS NOT NULL AND height IS NOT NULL 
                             AND rate_per_m3 IS NOT NULL 
                        THEN ((length * width * height) / 1000000.0) * rate_per_m3
                        ELSE 0 
                    END,
                    CASE 
                        WHEN weight_kg IS NOT NULL AND rate_per_kg IS NOT NULL 
                        THEN weight_kg * rate_per_kg 
                        ELSE 0 
                    END
                ) * exchange_rate_mga
            ELSE 0 
        END
    ) STORED,
    
    -- Statut du suivi
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'arrived', 'received')),
    
    -- Notes
    notes TEXT,
    
    -- Métadonnées
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX idx_tracking_numbers_purchase_order ON tracking_numbers(purchase_order_id);
CREATE INDEX idx_tracking_numbers_tracking ON tracking_numbers(tracking_number);
CREATE INDEX idx_tracking_numbers_status ON tracking_numbers(status);
CREATE INDEX idx_tracking_numbers_created_by ON tracking_numbers(created_by);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_tracking_numbers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tracking_numbers_updated_at
    BEFORE UPDATE ON tracking_numbers
    FOR EACH ROW
    EXECUTE FUNCTION update_tracking_numbers_updated_at();

-- RLS (Row Level Security)
ALTER TABLE tracking_numbers ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre la lecture à tous les utilisateurs authentifiés
CREATE POLICY "Users can view tracking numbers" ON tracking_numbers
    FOR SELECT USING (auth.role() = 'authenticated');

-- Politique pour permettre l'insertion aux utilisateurs authentifiés
CREATE POLICY "Users can insert tracking numbers" ON tracking_numbers
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Politique pour permettre la mise à jour aux utilisateurs authentifiés
CREATE POLICY "Users can update tracking numbers" ON tracking_numbers
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Politique pour permettre la suppression aux utilisateurs authentifiés
CREATE POLICY "Users can delete tracking numbers" ON tracking_numbers
    FOR DELETE USING (auth.role() = 'authenticated');


-- Migration pour créer la table des alertes de stock
CREATE TABLE IF NOT EXISTS stock_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('low_stock', 'out_of_stock', 'overstock')),
    threshold_value INTEGER NOT NULL,
    current_value INTEGER NOT NULL,
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_stock_alerts_product ON stock_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_type ON stock_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_resolved ON stock_alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_created_at ON stock_alerts(created_at);

-- RLS (Row Level Security)
ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre la lecture à tous les utilisateurs authentifiés
CREATE POLICY "Allow read access to authenticated users" ON stock_alerts
    FOR SELECT USING (auth.role() = 'authenticated');

-- Politique pour permettre l'insertion aux utilisateurs authentifiés
CREATE POLICY "Allow insert to authenticated users" ON stock_alerts
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Politique pour permettre la mise à jour aux utilisateurs authentifiés
CREATE POLICY "Allow update to authenticated users" ON stock_alerts
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Politique pour permettre la suppression aux utilisateurs authentifiés
CREATE POLICY "Allow delete to authenticated users" ON stock_alerts
    FOR DELETE USING (auth.role() = 'authenticated');

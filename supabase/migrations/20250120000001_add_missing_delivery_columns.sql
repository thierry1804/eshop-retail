-- Migration pour ajouter les colonnes manquantes à la table deliveries

-- Vérifier si la colonne delivery_number existe, sinon l'ajouter
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' 
        AND column_name = 'delivery_number'
    ) THEN
        ALTER TABLE deliveries ADD COLUMN delivery_number VARCHAR(50);
    END IF;
END $$;

-- Vérifier si la colonne client_id existe, sinon l'ajouter
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' 
        AND column_name = 'client_id'
    ) THEN
        ALTER TABLE deliveries ADD COLUMN client_id UUID;
    END IF;
END $$;

-- Vérifier si la colonne sale_id existe, sinon l'ajouter
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' 
        AND column_name = 'sale_id'
    ) THEN
        ALTER TABLE deliveries ADD COLUMN sale_id UUID;
    END IF;
END $$;

-- Vérifier si la colonne delivery_date existe, sinon l'ajouter
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' 
        AND column_name = 'delivery_date'
    ) THEN
        ALTER TABLE deliveries ADD COLUMN delivery_date TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Vérifier si la colonne expected_delivery_date existe, sinon l'ajouter
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' 
        AND column_name = 'expected_delivery_date'
    ) THEN
        ALTER TABLE deliveries ADD COLUMN expected_delivery_date TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Vérifier si la colonne status existe, sinon l'ajouter
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE deliveries ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
    END IF;
END $$;

-- Vérifier si la colonne delivery_method existe, sinon l'ajouter
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' 
        AND column_name = 'delivery_method'
    ) THEN
        ALTER TABLE deliveries ADD COLUMN delivery_method VARCHAR(20);
    END IF;
END $$;

-- Vérifier si la colonne delivery_address existe, sinon l'ajouter
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' 
        AND column_name = 'delivery_address'
    ) THEN
        ALTER TABLE deliveries ADD COLUMN delivery_address TEXT;
    END IF;
END $$;

-- Vérifier si la colonne delivery_notes existe, sinon l'ajouter
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' 
        AND column_name = 'delivery_notes'
    ) THEN
        ALTER TABLE deliveries ADD COLUMN delivery_notes TEXT;
    END IF;
END $$;

-- Vérifier si la colonne tracking_number existe, sinon l'ajouter
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' 
        AND column_name = 'tracking_number'
    ) THEN
        ALTER TABLE deliveries ADD COLUMN tracking_number VARCHAR(100);
    END IF;
END $$;

-- Vérifier si la colonne delivery_cost existe, sinon l'ajouter
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' 
        AND column_name = 'delivery_cost'
    ) THEN
        ALTER TABLE deliveries ADD COLUMN delivery_cost DECIMAL(10,2) DEFAULT 0;
    END IF;
END $$;

-- Vérifier si la colonne delivery_fee existe, sinon l'ajouter
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' 
        AND column_name = 'delivery_fee'
    ) THEN
        ALTER TABLE deliveries ADD COLUMN delivery_fee DECIMAL(10,2) DEFAULT 0;
    END IF;
END $$;

-- Vérifier si la colonne total_weight existe, sinon l'ajouter
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' 
        AND column_name = 'total_weight'
    ) THEN
        ALTER TABLE deliveries ADD COLUMN total_weight DECIMAL(10,3);
    END IF;
END $$;

-- Vérifier si la colonne total_volume existe, sinon l'ajouter
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' 
        AND column_name = 'total_volume'
    ) THEN
        ALTER TABLE deliveries ADD COLUMN total_volume DECIMAL(10,3);
    END IF;
END $$;

-- Vérifier si la colonne driver_name existe, sinon l'ajouter
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' 
        AND column_name = 'driver_name'
    ) THEN
        ALTER TABLE deliveries ADD COLUMN driver_name VARCHAR(255);
    END IF;
END $$;

-- Vérifier si la colonne driver_phone existe, sinon l'ajouter
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' 
        AND column_name = 'driver_phone'
    ) THEN
        ALTER TABLE deliveries ADD COLUMN driver_phone VARCHAR(20);
    END IF;
END $$;

-- Vérifier si la colonne vehicle_info existe, sinon l'ajouter
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' 
        AND column_name = 'vehicle_info'
    ) THEN
        ALTER TABLE deliveries ADD COLUMN vehicle_info VARCHAR(255);
    END IF;
END $$;

-- Vérifier si la colonne delivered_at existe, sinon l'ajouter
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' 
        AND column_name = 'delivered_at'
    ) THEN
        ALTER TABLE deliveries ADD COLUMN delivered_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Vérifier si la colonne created_by existe, sinon l'ajouter
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE deliveries ADD COLUMN created_by UUID;
    END IF;
END $$;

-- Vérifier si la colonne updated_by existe, sinon l'ajouter
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' 
        AND column_name = 'updated_by'
    ) THEN
        ALTER TABLE deliveries ADD COLUMN updated_by UUID;
    END IF;
END $$;

-- Vérifier si la colonne updated_at existe, sinon l'ajouter
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE deliveries ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Ajouter les contraintes si elles n'existent pas
DO $$ 
BEGIN
    -- Contrainte unique sur delivery_number
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'deliveries' 
        AND constraint_name = 'deliveries_delivery_number_key'
    ) THEN
        ALTER TABLE deliveries ADD CONSTRAINT deliveries_delivery_number_key UNIQUE (delivery_number);
    END IF;
    
    -- Contrainte NOT NULL sur delivery_number
    ALTER TABLE deliveries ALTER COLUMN delivery_number SET NOT NULL;
    
    -- Contrainte NOT NULL sur client_id
    ALTER TABLE deliveries ALTER COLUMN client_id SET NOT NULL;
    
    -- Contrainte NOT NULL sur delivery_date
    ALTER TABLE deliveries ALTER COLUMN delivery_date SET NOT NULL;
    
    -- Contrainte NOT NULL sur delivery_method
    ALTER TABLE deliveries ALTER COLUMN delivery_method SET NOT NULL;
    
    -- Contrainte NOT NULL sur delivery_address
    ALTER TABLE deliveries ALTER COLUMN delivery_address SET NOT NULL;
    
    -- Contrainte NOT NULL sur created_by
    ALTER TABLE deliveries ALTER COLUMN created_by SET NOT NULL;
END $$;

-- Ajouter les contraintes de clés étrangères si elles n'existent pas
DO $$ 
BEGIN
    -- Clé étrangère vers clients
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'deliveries' 
        AND constraint_name = 'deliveries_client_id_fkey'
    ) THEN
        ALTER TABLE deliveries ADD CONSTRAINT deliveries_client_id_fkey 
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
    END IF;
    
    -- Clé étrangère vers sales
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'deliveries' 
        AND constraint_name = 'deliveries_sale_id_fkey'
    ) THEN
        ALTER TABLE deliveries ADD CONSTRAINT deliveries_sale_id_fkey 
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Ajouter les contraintes CHECK si elles n'existent pas
DO $$ 
BEGIN
    -- Contrainte CHECK sur status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'deliveries_status_check'
    ) THEN
        ALTER TABLE deliveries ADD CONSTRAINT deliveries_status_check 
        CHECK (status IN ('pending', 'preparing', 'in_transit', 'delivered', 'failed', 'cancelled'));
    END IF;
    
    -- Contrainte CHECK sur delivery_method
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'deliveries_delivery_method_check'
    ) THEN
        ALTER TABLE deliveries ADD CONSTRAINT deliveries_delivery_method_check 
        CHECK (delivery_method IN ('pickup', 'home_delivery', 'express', 'standard'));
    END IF;
END $$;

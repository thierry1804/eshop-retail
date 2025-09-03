/*
  # Schéma initial pour l'application de gestion de friperie

  1. Nouvelles Tables
     - `user_profiles` - Profils utilisateurs avec rôles
       - `id` (uuid, clé primaire, référence à auth.users)
       - `email` (text, unique)
       - `name` (text)
       - `role` (enum: admin, employee)
       - `created_at` (timestamp)
     
     - `clients` - Clients de la boutique
       - `id` (uuid, clé primaire)
       - `first_name` (text)
       - `last_name` (text)
       - `phone` (text, unique)
       - `address` (text)
       - `trust_rating` (enum: good, average, poor)
       - `notes` (text)
       - `created_at` (timestamp)
       - `updated_at` (timestamp)
       - `created_by` (uuid, référence user_profiles)

     - `sales` - Ventes effectuées
       - `id` (uuid, clé primaire)
       - `client_id` (uuid, référence clients)
       - `description` (text)
       - `total_amount` (numeric)
       - `deposit` (numeric, défaut 0)
       - `remaining_balance` (numeric)
       - `status` (enum: ongoing, paid)
       - `created_at` (timestamp)
       - `created_by` (uuid, référence user_profiles)

     - `payments` - Paiements reçus
       - `id` (uuid, clé primaire)
       - `sale_id` (uuid, référence sales)
       - `amount` (numeric)
       - `payment_method` (enum: cash, mobile_money, bank_transfer, other)
       - `notes` (text)
       - `created_at` (timestamp)
       - `created_by` (uuid, référence user_profiles)

  2. Sécurité
     - Activer RLS sur toutes les tables
     - Politiques pour lecture/écriture basées sur l'authentification
     - Contrôle d'accès selon les rôles utilisateur

  3. Index et Contraintes
     - Index sur les colonnes de recherche fréquente
     - Contraintes de cohérence des données
     - Validation des montants et statuts
*/

-- Enum types
CREATE TYPE user_role AS ENUM ('admin', 'employee');
CREATE TYPE trust_rating AS ENUM ('good', 'average', 'poor');
CREATE TYPE sale_status AS ENUM ('ongoing', 'paid');
CREATE TYPE payment_method AS ENUM ('cash', 'mobile_money', 'bank_transfer', 'other');

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role user_role DEFAULT 'employee',
  created_at timestamptz DEFAULT now()
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text UNIQUE NOT NULL,
  address text NOT NULL,
  trust_rating trust_rating DEFAULT 'good',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id)
);

-- Sales table
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  description text NOT NULL,
  total_amount numeric(10,2) NOT NULL CHECK (total_amount > 0),
  deposit numeric(10,2) DEFAULT 0 CHECK (deposit >= 0),
  remaining_balance numeric(10,2) NOT NULL CHECK (remaining_balance >= 0),
  status sale_status DEFAULT 'ongoing',
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id),
  CONSTRAINT valid_amounts CHECK (deposit <= total_amount),
  CONSTRAINT valid_remaining_balance CHECK (remaining_balance >= 0)
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  payment_method payment_method NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id)
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- RLS Policies for clients
CREATE POLICY "Authenticated users can view clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create clients"
  ON clients
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update clients"
  ON clients
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete clients"
  ON clients
  FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for sales
CREATE POLICY "Authenticated users can view sales"
  ON sales
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create sales"
  ON sales
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update sales"
  ON sales
  FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for payments
CREATE POLICY "Authenticated users can view payments"
  ON payments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create payments"
  ON payments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_clients_trust_rating ON clients(trust_rating);
CREATE INDEX IF NOT EXISTS idx_sales_client_id ON sales(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- Function to update sale balance after payment
CREATE OR REPLACE FUNCTION update_sale_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sales 
  SET 
    remaining_balance = total_amount - deposit - (
      SELECT COALESCE(SUM(amount), 0) 
      FROM payments 
      WHERE sale_id = NEW.sale_id
    ),
    status = CASE 
      WHEN total_amount - deposit - (
        SELECT COALESCE(SUM(amount), 0) 
        FROM payments 
        WHERE sale_id = NEW.sale_id
      ) = 0 THEN 'paid'::sale_status
      ELSE 'ongoing'::sale_status
    END
  WHERE id = NEW.sale_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update sale balance when payment is added
CREATE TRIGGER trigger_update_sale_balance
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_sale_balance();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on clients
CREATE TRIGGER trigger_update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
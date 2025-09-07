/*
  # Amélioration du système de vente - Nouvelles tables et modifications

  1. Nouvelles Tables
     - `articles` - Catalogue des articles avec codes auto-générés
     - `sale_items` - Articles détaillés dans une vente
     - `deliveries` - Informations de livraison avec historique

  2. Modifications
     - `payments` - Ajout des champs pour mobile money
     - `sales` - Suppression du champ description (remplacé par sale_items)

  3. Fonctionnalités
     - Génération automatique des codes articles (3 lettres + 3 chiffres)
     - Auto-complétion des articles existants
     - Calcul automatique des montants
     - Gestion des livraisons en province
     - Support mobile money avec opérateurs
*/

-- Enum types pour les nouvelles fonctionnalités
CREATE TYPE delivery_type AS ENUM ('pickup', 'delivery');
CREATE TYPE mobile_operator AS ENUM ('orange_money', 'airtel_money', 'mvola');

-- Table articles - Catalogue des articles
CREATE TABLE IF NOT EXISTS articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL CHECK (code ~ '^[A-Z]{3}[0-9]{3}$'),
  name text NOT NULL,
  unit_price numeric(10,2) NOT NULL CHECK (unit_price > 0),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id),
  CONSTRAINT unique_article_code UNIQUE (code)
);

-- Table sale_items - Articles détaillés dans une vente
CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  article_id uuid REFERENCES articles(id) ON DELETE SET NULL,
  code text NOT NULL CHECK (code ~ '^[A-Z]{3}[0-9]{3}$'),
  name text NOT NULL,
  unit_price numeric(10,2) NOT NULL CHECK (unit_price > 0),
  quantity integer NOT NULL CHECK (quantity > 0),
  total_amount numeric(10,2) NOT NULL CHECK (total_amount > 0),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_item_total CHECK (total_amount = unit_price * quantity)
);

-- Table deliveries - Informations de livraison
CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  delivery_address text NOT NULL,
  is_province boolean DEFAULT false,
  delivery_type delivery_type NOT NULL,
  delivery_fees numeric(10,2) DEFAULT 0 CHECK (delivery_fees >= 0),
  delivery_date date NOT NULL,
  delivery_time time,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id),
  CONSTRAINT province_delivery_check CHECK (
    NOT (is_province = true AND delivery_type = 'pickup')
  )
);

-- Modifier la table payments pour ajouter les champs mobile money
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS mobile_operator mobile_operator,
ADD COLUMN IF NOT EXISTS transaction_reference text,
ADD CONSTRAINT mobile_money_fields_check CHECK (
  (payment_method = 'mobile_money' AND mobile_operator IS NOT NULL AND transaction_reference IS NOT NULL) OR
  (payment_method != 'mobile_money')
);

-- Supprimer la colonne description de sales (remplacée par sale_items)
-- Note: On garde temporairement pour éviter les erreurs, on la supprimera plus tard
-- ALTER TABLE sales DROP COLUMN IF EXISTS description;

-- Enable RLS sur les nouvelles tables
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour articles
CREATE POLICY "Authenticated users can view articles"
  ON articles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create articles"
  ON articles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update articles"
  ON articles
  FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies pour sale_items
CREATE POLICY "Authenticated users can view sale items"
  ON sale_items
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create sale items"
  ON sale_items
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update sale items"
  ON sale_items
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete sale items"
  ON sale_items
  FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies pour deliveries
CREATE POLICY "Authenticated users can view deliveries"
  ON deliveries
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create deliveries"
  ON deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update deliveries"
  ON deliveries
  FOR UPDATE
  TO authenticated
  USING (true);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_articles_code ON articles(code);
CREATE INDEX IF NOT EXISTS idx_articles_name ON articles(name);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_article_id ON sale_items(article_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_sale_id ON deliveries(sale_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(delivery_date);
CREATE INDEX IF NOT EXISTS idx_payments_mobile_operator ON payments(mobile_operator);

-- Fonction pour générer automatiquement les codes articles
CREATE OR REPLACE FUNCTION generate_article_code()
RETURNS text AS $$
DECLARE
  new_code text;
  counter integer := 0;
BEGIN
  LOOP
    -- Générer 3 lettres majuscules aléatoires
    new_code := upper(substring(md5(random()::text) from 1 for 3));
    
    -- Ajouter 3 chiffres aléatoires
    new_code := new_code || lpad(floor(random() * 1000)::text, 3, '0');
    
    -- Vérifier si le code existe déjà
    IF NOT EXISTS (SELECT 1 FROM articles WHERE code = new_code) THEN
      RETURN new_code;
    END IF;
    
    counter := counter + 1;
    IF counter > 100 THEN
      RAISE EXCEPTION 'Impossible de générer un code unique après 100 tentatives';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour calculer automatiquement le total d'une vente
CREATE OR REPLACE FUNCTION calculate_sale_total(sale_uuid uuid)
RETURNS numeric AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(total_amount) FROM sale_items WHERE sale_id = sale_uuid), 0
  );
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour le montant total d'une vente
CREATE OR REPLACE FUNCTION update_sale_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sales 
  SET total_amount = calculate_sale_total(NEW.sale_id)
  WHERE id = NEW.sale_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour automatiquement le total de la vente
CREATE TRIGGER trigger_update_sale_total
  AFTER INSERT OR UPDATE OR DELETE ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION update_sale_total();

-- Fonction pour valider les règles métier de livraison
CREATE OR REPLACE FUNCTION validate_delivery_rules()
RETURNS TRIGGER AS $$
BEGIN
  -- Vérifier que l'acompte est à 100% pour les livraisons en province
  IF NEW.is_province = true THEN
    IF NOT EXISTS (
      SELECT 1 FROM sales s 
      WHERE s.id = NEW.sale_id 
      AND s.deposit = s.total_amount
    ) THEN
      RAISE EXCEPTION 'L''acompte doit être à 100%% pour les livraisons en province';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour valider les règles de livraison
CREATE TRIGGER trigger_validate_delivery_rules
  BEFORE INSERT OR UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION validate_delivery_rules();

-- Données de test pour les articles
INSERT INTO articles (code, name, unit_price) VALUES
  ('ABC001', 'Robe d''été taille M', 5000),
  ('DEF002', 'Jean slim homme taille 32', 3500),
  ('GHI003', 'Chemise à carreaux L', 2500),
  ('JKL004', 'T-shirt basique S', 1500),
  ('MNO005', 'Pantalon chino taille 34', 4000),
  ('PQR006', 'Veste en jean femme', 6000),
  ('STU007', 'Escarpins pointure 38', 8000),
  ('VWX008', 'Sac à main cuir', 12000),
  ('YZA009', 'Ceinture cuir homme', 2000),
  ('BCD010', 'Robe de soirée noire S', 15000);

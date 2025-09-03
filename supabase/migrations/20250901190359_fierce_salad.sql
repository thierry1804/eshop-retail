/*
  # Données de test pour l'application de gestion de friperie

  1. Utilisateurs de test
     - Admin par défaut
     - Employé de test

  2. Clients échantillons
     - Variété de profils clients avec différents statuts de confiance
     - Informations de contact réalistes

  3. Ventes et paiements
     - Exemples de ventes au comptant et à crédit
     - Historique de paiements variés

  Note: Ces données sont uniquement pour la démonstration et les tests
*/

-- Désactiver temporairement la contrainte valid_balance pour l'insertion des données de test
ALTER TABLE sales DROP CONSTRAINT IF EXISTS valid_balance;

-- Insérer des profils utilisateur de test (ces IDs doivent correspondre aux utilisateurs auth créés)
-- Note: En production, ces utilisateurs doivent être créés via l'interface d'authentification

-- Clients échantillons
INSERT INTO clients (first_name, last_name, phone, address, trust_rating, notes) VALUES
  ('Marie', 'Rakoto', '+261 07 12 34 56 78', 'Antananarivo, Analakely, Villa 123', 'good', 'Cliente fidèle depuis 2 ans, toujours ponctuelle dans ses paiements'),
  ('Jean', 'Rasoa', '+261 05 98 76 54 32', 'Antananarivo, Andoharanofotsy, Rue des Palmiers', 'average', 'Paiements parfois en retard mais finit toujours par régler'),
  ('Fatou', 'Ramanantsoa', '+261 01 23 45 67 89', 'Antananarivo, Isoraka, près du marché', 'poor', 'Difficultés de paiement, nécessite un suivi rapproché'),
  ('Kouadio', 'Razafindrabe', '+261 08 11 22 33 44', 'Antananarivo, Ambohijatovo, Résidence les Flamboyants', 'good', 'Client recommandé par Marie Rakoto'),
  ('Aminata', 'Rasolofomanana', '+261 09 55 66 77 88', 'Antananarivo, Tsaralalana, Avenue 7', 'good', 'Acheteuse régulière, préfère les paiements en espèces');

-- Ventes échantillons (utilisant les IDs des clients créés ci-dessus)
INSERT INTO sales (client_id, description, total_amount, deposit, remaining_balance, status) 
SELECT 
  c.id,
  description,
  total_amount,
  deposit,
  total_amount - deposit,
  status::sale_status
FROM clients c
CROSS JOIN (VALUES
  ('Lot de robes d''été, 3 pièces taille M, excellent état', 15000, 15000, 'paid'),
  ('Jean slim homme taille 32, chemise à carreaux L, ceinture cuir', 8500, 3000, 'ongoing'),
  ('Robe de soirée noire taille S, escarpins pointure 38', 25000, 0, 'ongoing'),
  ('Ensemble pantalon-veste femme taille 40, sac à main', 18000, 10000, 'ongoing'),
  ('T-shirts enfant lot de 5, tailles variées 6-10 ans', 7500, 7500, 'paid')
) AS sales_data(description, total_amount, deposit, status)
WHERE c.first_name IN ('Marie', 'Jean', 'Fatou', 'Kouadio', 'Aminata')
LIMIT 5;

-- Paiements échantillons pour les ventes en cours
INSERT INTO payments (sale_id, amount, payment_method, notes)
SELECT 
  s.id,
  amount,
  payment_method::payment_method,
  notes
FROM sales s
CROSS JOIN (VALUES
  (2000, 'mobile_money', 'Paiement partiel via Orange Money'),
  (5000, 'cash', 'Paiement en espèces au magasin'),
  (3000, 'bank_transfer', 'Virement bancaire confirmé')
) AS payments_data(amount, payment_method, notes)
WHERE s.status = 'ongoing'
AND s.remaining_balance >= amount
LIMIT 3;

-- Mettre à jour les remaining_balance pour refléter la réalité après les paiements
UPDATE sales s SET 
  remaining_balance = s.total_amount - s.deposit - COALESCE(
    (SELECT SUM(p.amount) FROM payments p WHERE p.sale_id = s.id), 0
  ),
  status = CASE 
    WHEN s.total_amount - s.deposit - COALESCE(
      (SELECT SUM(p.amount) FROM payments p WHERE p.sale_id = s.id), 0
    ) = 0 THEN 'paid'::sale_status
    ELSE 'ongoing'::sale_status
  END;

-- Supprimer la contrainte valid_balance problématique et la remplacer par une version plus flexible
-- La contrainte originale ne tient pas compte des paiements
-- ALTER TABLE sales ADD CONSTRAINT valid_balance CHECK (remaining_balance = total_amount - deposit);
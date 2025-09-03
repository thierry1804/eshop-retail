/*
  # Correction de la contrainte valid_balance

  Problème: La contrainte valid_balance vérifie remaining_balance = total_amount - deposit
  mais ne tient pas compte des paiements effectués.

  Solution: Supprimer cette contrainte car le remaining_balance est géré par les triggers
  qui tiennent compte des paiements.
*/

-- Supprimer la contrainte valid_balance problématique
ALTER TABLE sales DROP CONSTRAINT IF EXISTS valid_balance;

-- Ajouter une contrainte plus simple qui vérifie seulement que remaining_balance >= 0
ALTER TABLE sales ADD CONSTRAINT valid_remaining_balance CHECK (remaining_balance >= 0);

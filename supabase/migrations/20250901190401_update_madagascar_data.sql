/*
  # Mise à jour des données pour Madagascar

  Cette migration met à jour les données existantes pour correspondre à Madagascar :
  - Changement des indicatifs téléphoniques de +225 (Côte d'Ivoire) vers +261 (Madagascar)
  - Mise à jour des noms et adresses pour correspondre à Madagascar
  - Les montants restent les mêmes mais seront affichés en MGA (Ariary) au lieu de XOF (FCFA)
*/

-- Mise à jour des clients existants avec des données malgaches
UPDATE clients SET 
  first_name = CASE 
    WHEN first_name = 'Marie' THEN 'Marie'
    WHEN first_name = 'Jean' THEN 'Jean'
    WHEN first_name = 'Fatou' THEN 'Fatou'
    WHEN first_name = 'Kouadio' THEN 'Kouadio'
    WHEN first_name = 'Aminata' THEN 'Aminata'
    ELSE first_name
  END,
  last_name = CASE 
    WHEN last_name = 'Kouassi' THEN 'Rakoto'
    WHEN last_name = 'Diabaté' THEN 'Rasoa'
    WHEN last_name = 'Traoré' THEN 'Ramanantsoa'
    WHEN last_name = 'N''Guessan' THEN 'Razafindrabe'
    WHEN last_name = 'Coulibaly' THEN 'Rasolofomanana'
    ELSE last_name
  END,
  phone = CASE 
    WHEN phone = '+225 07 12 34 56 78' THEN '+261 07 12 34 56 78'
    WHEN phone = '+225 05 98 76 54 32' THEN '+261 05 98 76 54 32'
    WHEN phone = '+225 01 23 45 67 89' THEN '+261 01 23 45 67 89'
    WHEN phone = '+225 08 11 22 33 44' THEN '+261 08 11 22 33 44'
    WHEN phone = '+225 09 55 66 77 88' THEN '+261 09 55 66 77 88'
    ELSE phone
  END,
  address = CASE 
    WHEN address LIKE '%Cocody%' THEN 'Antananarivo, Analakely, Villa 123'
    WHEN address LIKE '%Yopougon%' THEN 'Antananarivo, Andoharanofotsy, Rue des Palmiers'
    WHEN address LIKE '%Adjamé%' THEN 'Antananarivo, Isoraka, près du marché'
    WHEN address LIKE '%Marcory%' THEN 'Antananarivo, Ambohijatovo, Résidence les Flamboyants'
    WHEN address LIKE '%Treichville%' THEN 'Antananarivo, Tsaralalana, Avenue 7'
    ELSE address
  END,
  notes = CASE 
    WHEN notes LIKE '%Marie Kouassi%' THEN REPLACE(notes, 'Marie Kouassi', 'Marie Rakoto')
    ELSE notes
  END
WHERE phone LIKE '+225%';

-- Mise à jour des notes pour refléter les nouveaux noms
UPDATE clients SET 
  notes = REPLACE(notes, 'Client recommandé par Marie Kouassi', 'Client recommandé par Marie Rakoto')
WHERE notes LIKE '%Marie Kouassi%';

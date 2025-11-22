-- Migration pour modifier la précision du volume de 4 à 6 décimales

-- Modifier la colonne volume_m3 pour avoir 6 décimales au lieu de 4
ALTER TABLE tracking_numbers 
ALTER COLUMN volume_m3 TYPE DECIMAL(10,6);


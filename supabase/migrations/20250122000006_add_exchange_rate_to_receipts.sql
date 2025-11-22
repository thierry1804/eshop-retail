-- Migration pour ajouter le cours de change MGA aux réceptions
ALTER TABLE receipts 
ADD COLUMN exchange_rate_mga DECIMAL(10,2);

-- Commentaire pour documenter
COMMENT ON COLUMN receipts.exchange_rate_mga IS 'Taux de change USD vers MGA utilisé lors de la réception';


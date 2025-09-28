import { supabase } from './supabase';

/**
 * Génère un SKU incrémental basé sur le nom du produit et la date
 * Format: XXX-YYMMDD-00001
 * @param productName - Nom du produit (minimum 3 caractères)
 * @returns Promise<string> - SKU généré
 */
export const generateIncrementalSKU = async (productName: string): Promise<string> => {
  if (productName.length < 3) {
    throw new Error('Le nom du produit doit contenir au moins 3 caractères');
  }

  // Prendre les 3 premières lettres du nom du produit
  const productLetters = productName.substring(0, 3).toUpperCase().padEnd(3, 'X');
  
  // Date actuelle au format YYMMDD
  const now = new Date();
  const dateStr = `${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
  
  try {
    // Récupérer le prochain numéro de séquence pour cette combinaison lettres-date
    const { data, error } = await supabase
      .from('products')
      .select('sku')
      .like('sku', `${productLetters}-${dateStr}-%`)
      .order('sku', { ascending: false })
      .limit(1);

    if (error) throw error;

    let nextSequence = 1;
    if (data && data.length > 0) {
      // Extraire le numéro de séquence du dernier SKU
      const lastSku = data[0].sku;
      const lastSequenceStr = lastSku.split('-')[2];
      const lastSequence = parseInt(lastSequenceStr) || 0;
      nextSequence = lastSequence + 1;
    }

    const sequenceStr = nextSequence.toString().padStart(5, '0');
    return `${productLetters}-${dateStr}-${sequenceStr}`;
  } catch (error) {
    console.error('Erreur lors de la génération du SKU:', error);
    // Fallback avec un numéro de séquence basé sur l'heure
    const fallbackSequence = Date.now() % 100000;
    const sequenceStr = fallbackSequence.toString().padStart(5, '0');
    return `${productLetters}-${dateStr}-${sequenceStr}`;
  }
};

/**
 * Valide le format d'un SKU
 * @param sku - SKU à valider
 * @returns boolean - true si le format est valide
 */
export const validateSKUFormat = (sku: string): boolean => {
  const skuPattern = /^[A-Z]{3}-\d{6}-\d{5}$/;
  return skuPattern.test(sku);
};

/**
 * Extrait les informations d'un SKU
 * @param sku - SKU à analyser
 * @returns object avec les composants du SKU
 */
export const parseSKU = (sku: string) => {
  const parts = sku.split('-');
  if (parts.length !== 3) {
    throw new Error('Format de SKU invalide');
  }

  return {
    productLetters: parts[0],
    date: parts[1],
    sequence: parseInt(parts[2])
  };
};

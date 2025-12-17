/**
 * Formate un nombre de manière compacte avec des suffixes (K, M, etc.)
 * @param value - Le nombre à formater
 * @param currency - La devise à ajouter (optionnel, par défaut 'MGA')
 * @returns Le nombre formaté avec suffixe et devise
 * 
 * Exemples:
 * - 40000 -> "40K MGA"
 * - 1280000 -> "1.28M MGA"
 * - 500 -> "500 MGA"
 */
export const formatCompactNumber = (value: number, currency: string = 'MGA'): string => {
  if (isNaN(value) || value === null || value === undefined) {
    return `0 ${currency}`;
  }

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1000000) {
    // Millions
    const millions = absValue / 1000000;
    // Arrondir à 2 décimales maximum, mais ne pas afficher .00
    const rounded = Math.round(millions * 100) / 100;
    const formatted = rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(2);
    return `${sign}${formatted}M ${currency}`;
  } else if (absValue >= 1000) {
    // Milliers
    const thousands = absValue / 1000;
    // Arrondir à 1 décimale maximum, mais ne pas afficher .0
    const rounded = Math.round(thousands * 10) / 10;
    const formatted = rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);
    return `${sign}${formatted}K ${currency}`;
  } else {
    // Moins de 1000, afficher tel quel
    return `${sign}${Math.round(absValue)} ${currency}`;
  }
};

/**
 * Formate un nombre de manière compacte sans devise
 * @param value - Le nombre à formater
 * @returns Le nombre formaté avec suffixe uniquement
 * 
 * Exemples:
 * - 40000 -> "40K"
 * - 1280000 -> "1.28M"
 * - 500 -> "500"
 */
export const formatCompactNumberOnly = (value: number): string => {
  if (isNaN(value) || value === null || value === undefined) {
    return '0';
  }

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1000000) {
    // Millions
    const millions = absValue / 1000000;
    const rounded = Math.round(millions * 100) / 100;
    const formatted = rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(2);
    return `${sign}${formatted}M`;
  } else if (absValue >= 1000) {
    // Milliers
    const thousands = absValue / 1000;
    const rounded = Math.round(thousands * 10) / 10;
    const formatted = rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);
    return `${sign}${formatted}K`;
  } else {
    // Moins de 1000, afficher tel quel
    return `${sign}${Math.round(absValue)}`;
  }
};


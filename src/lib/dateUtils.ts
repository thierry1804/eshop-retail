/**
 * Formate une date en string YYYY-MM-DD en utilisant le fuseau horaire local
 * Évite les problèmes de décalage avec toISOString()
 */
export const formatDateToLocalString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Crée une date à partir d'une string YYYY-MM-DD en utilisant le fuseau horaire local
 * Évite les problèmes de décalage avec new Date()
 */
export const createDateFromLocalString = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Vérifie si deux dates sont le même jour (ignorant l'heure)
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
};

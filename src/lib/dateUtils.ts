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
 * Parse une date (Date | ISO | YYYY-MM-DD) en Date locale.
 * Retourne null si invalide.
 */
export const parseLocalDate = (
  value: string | Date | null | undefined
): Date | null => {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return createDateFromLocalString(trimmed);
  }
  // YYYY-MM-DDTHH:mm... → garder le jour calendaire local si pas de fuseau explicite
  const dateOnlyPrefix = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T ]/);
  if (dateOnlyPrefix && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const d = createDateFromLocalString(dateOnlyPrefix[1]);
    const timePart = trimmed.slice(11);
    const timeMatch = timePart.match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (timeMatch) {
      d.setHours(
        Number(timeMatch[1]),
        Number(timeMatch[2]),
        Number(timeMatch[3] || 0),
        0
      );
    }
    return d;
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Affichage date : toujours dd/mm/yyyy
 */
export const formatDateDisplay = (
  value: string | Date | null | undefined,
  empty = '-'
): string => {
  const date = parseLocalDate(value);
  if (!date) return empty;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Affichage date + heure : dd/mm/yyyy HH:mm
 */
export const formatDateTimeDisplay = (
  value: string | Date | null | undefined,
  empty = '-'
): string => {
  const date = parseLocalDate(value);
  if (!date) return empty;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${formatDateDisplay(date)} ${hours}:${minutes}`;
};

/**
 * Vérifie si deux dates sont le même jour (ignorant l'heure)
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
};

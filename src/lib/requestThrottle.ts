/**
 * Utilitaire pour limiter les requêtes et éviter les "too many requests"
 */

// Cache simple pour les requêtes
const requestCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

// Dernière requête de rafraîchissement de token
let lastTokenRefresh = 0;
const TOKEN_REFRESH_COOLDOWN = 60000; // 60 secondes minimum entre les rafraîchissements

/**
 * Debounce function pour limiter les appels de fonction
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function pour limiter la fréquence des appels
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Vérifie si on peut faire un rafraîchissement de token
 */
export function canRefreshToken(): boolean {
  const now = Date.now();
  if (now - lastTokenRefresh < TOKEN_REFRESH_COOLDOWN) {
    return false;
  }
  lastTokenRefresh = now;
  return true;
}

/**
 * Cache une requête avec un TTL
 */
export function cacheRequest<T>(
  key: string,
  data: T,
  ttl: number = 30000 // 30 secondes par défaut
): void {
  requestCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl
  });
}

/**
 * Récupère une requête du cache si elle est encore valide
 */
export function getCachedRequest<T>(key: string): T | null {
  const cached = requestCache.get(key);
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > cached.ttl) {
    requestCache.delete(key);
    return null;
  }
  
  return cached.data as T;
}

/**
 * Nettoie le cache des entrées expirées
 */
export function cleanCache(): void {
  const now = Date.now();
  for (const [key, value] of requestCache.entries()) {
    if (now - value.timestamp > value.ttl) {
      requestCache.delete(key);
    }
  }
}

// Nettoyer le cache toutes les minutes
setInterval(cleanCache, 60000);


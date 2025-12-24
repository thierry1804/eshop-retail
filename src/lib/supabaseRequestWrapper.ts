/**
 * Wrapper pour les requêtes Supabase avec gestion des erreurs 429
 */

import { PostgrestError } from '@supabase/supabase-js';

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  onRetry?: (attempt: number, delay: number) => void;
}

/**
 * Wrapper pour les requêtes Supabase qui gère automatiquement les erreurs 429
 * avec retry et backoff exponentiel
 */
export async function withRetry<T>(
  requestFn: () => Promise<{ data: T | null; error: PostgrestError | null }>,
  options: RetryOptions = {}
): Promise<{ data: T | null; error: PostgrestError | null }> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    onRetry
  } = options;

  let lastError: PostgrestError | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await requestFn();
      
      // Si succès, retourner le résultat
      if (!result.error) {
        return result;
      }
      
      // Vérifier si c'est une erreur 429 (Too Many Requests)
      const errorCode = result.error?.code || result.error?.message || '';
      const isRateLimit = 
        errorCode === 'PGRST301' || 
        errorCode === '429' ||
        result.error?.message?.includes('429') ||
        result.error?.message?.includes('rate limit') ||
        result.error?.message?.includes('Too Many Requests');
      
      if (!isRateLimit || attempt >= maxRetries) {
        // Si ce n'est pas une erreur de rate limit ou qu'on a épuisé les tentatives
        return result;
      }
      
      // Calculer le délai avec backoff exponentiel
      const delay = baseDelay * Math.pow(2, attempt);
      
      if (onRetry) {
        onRetry(attempt + 1, delay);
      } else {
        console.warn(
          `⚠️ Supabase: 429 Too Many Requests, attente de ${delay}ms avant retry ${attempt + 1}/${maxRetries}`
        );
      }
      
      // Attendre avant de réessayer
      await new Promise(resolve => setTimeout(resolve, delay));
      lastError = result.error;
      
    } catch (error: any) {
      // Vérifier si c'est une erreur de rate limit
      const isRateLimit = 
        error?.code === '429' ||
        error?.message?.includes('429') ||
        error?.message?.includes('rate limit') ||
        error?.message?.includes('Too Many Requests');
      
      if (!isRateLimit || attempt >= maxRetries) {
        return {
          data: null,
          error: error as PostgrestError || lastError
        };
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      
      if (onRetry) {
        onRetry(attempt + 1, delay);
      } else {
        console.warn(
          `⚠️ Supabase: Erreur réseau, attente de ${delay}ms avant retry ${attempt + 1}/${maxRetries}`
        );
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
      lastError = error as PostgrestError;
    }
  }
  
  // Si on arrive ici, toutes les tentatives ont échoué
  return {
    data: null,
    error: lastError || {
      message: 'Trop de requêtes. Veuillez patienter quelques instants.',
      details: '',
      hint: '',
      code: '429'
    } as PostgrestError
  };
}


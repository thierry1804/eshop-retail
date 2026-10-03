import { createClient } from '@supabase/supabase-js';
import { devLog, devWarn } from './devLog';
import type { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Vérification des variables d'environnement
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERREUR: Variables d\'environnement Supabase manquantes!');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? '✅ Défini' : '❌ Manquant');
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Défini' : '❌ Manquant');
  console.error('Créez un fichier .env à la racine du projet avec :');
  console.error('VITE_SUPABASE_URL=votre_url_supabase');
  console.error('VITE_SUPABASE_ANON_KEY=votre_clé_anon_supabase');
}

// Singleton pour éviter les instances multiples
let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null;

export const supabase: ReturnType<typeof createClient<Database>> = (() => {
  try {
    if (!supabaseInstance) {
      if (!supabaseUrl || !supabaseAnonKey) {
        console.error('❌ Supabase: Variables d\'environnement manquantes');
        console.error('URL:', supabaseUrl);
        console.error('Key:', supabaseAnonKey ? 'Définie' : 'Manquante');
        throw new Error('Variables d\'environnement Supabase manquantes. Vérifiez votre fichier .env');
      }
      devLog('🔧 Supabase: Création de l\'instance unique');
      supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: false, // Désactivé pour éviter les rafraîchissements automatiques excessifs
          detectSessionInUrl: true,
          storage: window.localStorage,
          storageKey: 'supabase.auth.token',
        },
        global: {
          headers: {
            'x-client-info': 'beh-clients-app'
          }
        }
      });
      
      // Système de verrouillage pour éviter les rafraîchissements simultanés
      let isRefreshing = false;
      let lastTokenRefreshAttempt = 0;
      let sessionCache: { session: any; timestamp: number } | null = null;
      const SESSION_CACHE_TTL = 300000; // Cache la session pendant 5 minutes pour réduire les appels
      
      // Intercepter getSession pour éviter les rafraîchissements automatiques et les appels multiples
      const originalGetSession = supabaseInstance.auth.getSession.bind(supabaseInstance.auth);
      supabaseInstance.auth.getSession = async () => {
        try {
          // Utiliser le cache si disponible et récent
          const now = Date.now();
          if (sessionCache && (now - sessionCache.timestamp) < SESSION_CACHE_TTL) {
            return { data: { session: sessionCache.session, user: sessionCache.session?.user || null }, error: null };
          }
          
          // Appeler la méthode originale
          const result = await originalGetSession();
          
          // Mettre en cache le résultat si la session est valide
          if (result.data?.session) {
            const expiresAt = result.data.session.expires_at ? result.data.session.expires_at * 1000 : 0;
            const timeUntilExpiry = expiresAt - now;
            
            // Ne mettre en cache que les sessions valides (pas expirées depuis plus de 5 minutes)
            // Mais toujours retourner la session même si expirée (Supabase gère cela)
            if (timeUntilExpiry > -300000) {
              sessionCache = { session: result.data.session, timestamp: now };
            } else {
              // Session expirée depuis plus de 5 minutes, ne pas mettre en cache
              // mais retourner quand même le résultat pour que Supabase puisse gérer
              sessionCache = null;
            }
          } else {
            sessionCache = null;
          }
          
          // Toujours retourner le résultat tel quel (ne pas bloquer les sessions)
          // Supabase gère lui-même les sessions expirées
          return result;
        } catch (error) {
          devWarn('⚠️ Supabase: Erreur lors de la récupération de session:', error);
          sessionCache = null; // Invalider le cache en cas d'erreur
          return { data: { session: null, user: null }, error: error as any };
        }
      };
      
      // Intercepter refreshSession pour éviter les rafraîchissements excessifs
      const originalRefreshSession = supabaseInstance.auth.refreshSession.bind(supabaseInstance.auth);
      supabaseInstance.auth.refreshSession = async (refreshToken?: string) => {
        const now = Date.now();
        const timeSinceLastRefresh = now - lastTokenRefreshAttempt;
        
        // Si on rafraîchit trop souvent, ignorer (minimum 15 minutes entre rafraîchissements)
        const MIN_REFRESH_INTERVAL = 900000; // 15 minutes pour éviter les 429
        if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL) {
          devLog(`⏳ Supabase: Rafraîchissement ignoré (${Math.round((MIN_REFRESH_INTERVAL - timeSinceLastRefresh) / 1000)}s restants)`);
          // Retourner la session actuelle au lieu de rafraîchir
          const { data: { session } } = await supabaseInstance.auth.getSession();
          return { data: { session, user: session?.user || null }, error: null };
        }
        
        // Si un rafraîchissement est déjà en cours, attendre
        if (isRefreshing) {
          devLog('⏳ Supabase: Rafraîchissement déjà en cours, attente...');
          // Attendre jusqu'à 5 secondes
          let waitCount = 0;
          while (isRefreshing && waitCount < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            waitCount++;
          }
          if (isRefreshing) {
            // Si toujours en cours, retourner la session actuelle
            const { data: { session } } = await supabaseInstance.auth.getSession();
            return { data: { session, user: session?.user || null }, error: null };
          }
        }
        
        isRefreshing = true;
        lastTokenRefreshAttempt = now;
        
        try {
          devLog('🔄 Supabase: Rafraîchissement du token autorisé');
          
          // Utiliser un timeout pour éviter les blocages
          const refreshPromise = originalRefreshSession(refreshToken);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout rafraîchissement')), 5000)
          );
          
          const result = await Promise.race([refreshPromise, timeoutPromise]) as any;
          
          // Vérifier si c'est une erreur 429
          if (result?.error) {
            const errorMessage = result.error.message || '';
            const isRateLimit = 
              result.error.status === 429 ||
              errorMessage.includes('429') ||
              errorMessage.includes('rate limit') ||
              errorMessage.includes('Too Many Requests');
            
            if (isRateLimit) {
              devWarn('⚠️ Supabase: Erreur 429 (rate limit) lors du rafraîchissement, utilisation de la session actuelle');
              // Ne pas déconnecter l'utilisateur, retourner la session actuelle
              const { data: { session } } = await supabaseInstance.auth.getSession();
              return { data: { session, user: session?.user || null }, error: null };
            }
          }
          
          return result;
        } catch (error: any) {
          // Vérifier si c'est une erreur 429 ou un timeout
          const errorMessage = error?.message || '';
          const isRateLimit = 
            error?.status === 429 ||
            errorMessage.includes('429') ||
            errorMessage.includes('rate limit') ||
            errorMessage.includes('Too Many Requests') ||
            errorMessage.includes('Timeout');
          
          if (isRateLimit) {
            devWarn('⚠️ Supabase: Erreur 429 ou timeout lors du rafraîchissement, utilisation de la session actuelle');
            // Ne pas déconnecter l'utilisateur, retourner la session actuelle
            try {
              const { data: { session } } = await supabaseInstance.auth.getSession();
              return { data: { session, user: session?.user || null }, error: null };
            } catch (sessionError) {
              // Si même getSession échoue, retourner une erreur mais ne pas throw
              devWarn('⚠️ Supabase: Impossible de récupérer la session après erreur 429:', sessionError);
              return { data: { session: null, user: null }, error: null };
            }
          }
          
          devWarn('⚠️ Supabase: Erreur lors du rafraîchissement du token:', error);
          // Ne pas throw l'erreur pour éviter que Supabase déclenche SIGNED_OUT
          // Retourner la session actuelle à la place
          try {
            const { data: { session } } = await supabaseInstance.auth.getSession();
            return { data: { session, user: session?.user || null }, error: null };
          } catch (sessionError) {
            return { data: { session: null, user: null }, error: null };
          }
        } finally {
          isRefreshing = false;
        }
      };
      
      // Désactiver le rafraîchissement manuel périodique car autoRefreshToken est activé
      // Supabase gère automatiquement le rafraîchissement
      
      // Filtrer les événements TOKEN_REFRESHED pour éviter le spam
      let lastTokenRefreshedEvent = 0;
      const TOKEN_REFRESHED_DEBOUNCE = 60000; // Ignorer les TOKEN_REFRESHED plus fréquents que toutes les minutes
      
      // Invalider le cache de session lors d'un rafraîchissement réussi
      const originalOnAuthStateChange = supabaseInstance.auth.onAuthStateChange.bind(supabaseInstance.auth);
      supabaseInstance.auth.onAuthStateChange = (callback) => {
        return originalOnAuthStateChange(async (event, session) => {
          // Filtrer les événements TOKEN_REFRESHED trop fréquents
          if (event === 'TOKEN_REFRESHED') {
            const now = Date.now();
            const timeSinceLastEvent = now - lastTokenRefreshedEvent;
            
            if (timeSinceLastEvent < TOKEN_REFRESHED_DEBOUNCE) {
              // Ignorer silencieusement les événements TOKEN_REFRESHED trop fréquents
              // Ne pas invalider le cache non plus
              return;
            }
            
            lastTokenRefreshedEvent = now;
            sessionCache = null; // Invalider le cache seulement pour les événements non filtrés
          } else if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
            sessionCache = null;
          }
          
          // Filtrer les événements SIGNED_OUT causés par des erreurs 429
          if (event === 'SIGNED_OUT' && !session) {
            // Vérifier si c'est vraiment une déconnexion ou juste une erreur 429
            try {
              // Attendre un peu pour laisser le temps à Supabase de se stabiliser
              await new Promise(resolve => setTimeout(resolve, 300));
              
              // Vérifier si la session est toujours valide
              const { data: { session: currentSession } } = await supabaseInstance.auth.getSession();
              if (currentSession && currentSession.user) {
                devLog('⚠️ Supabase: Événement SIGNED_OUT filtré (session toujours valide, probable erreur 429)');
                // Ne pas propager l'événement SIGNED_OUT si la session est toujours valide
                // Ne pas déclencher TOKEN_REFRESHED non plus pour éviter le spam
                return;
              }
            } catch (error) {
              devWarn('⚠️ Supabase: Erreur lors de la vérification de session dans onAuthStateChange:', error);
              // En cas d'erreur, propager quand même l'événement
            }
          }
          
          callback(event, session);
        });
      };
      
      devLog('✅ Supabase: Instance créée avec succès (rafraîchissement automatique activé, protection contre rate limit, cache de session 5 min, intervalle minimum 15 min)');
    }
    return supabaseInstance!;
  } catch (error) {
    console.error('❌ Supabase: Erreur lors de la création de l\'instance:', error);
    throw error;
  }
})();

// Auth helpers
export const signIn = async (email: string, password: string) => {
  devLog('🔐 Supabase: Tentative de connexion avec Supabase...');
  const startTime = performance.now();
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  const endTime = performance.now();
  devLog(`⏱️ Supabase: Connexion Supabase terminée en ${(endTime - startTime).toFixed(2)}ms`);
  
  if (error) {
    console.error('❌ Supabase: Erreur de connexion:', error);
  } else {
    devLog('✅ Supabase: Connexion réussie');
  }
  
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};
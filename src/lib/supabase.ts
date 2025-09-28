import { createClient } from '@supabase/supabase-js';
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
      console.log('🔧 Supabase: Création de l\'instance unique');
      supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage,
          storageKey: 'supabase.auth.token'
        }
      });
      console.log('✅ Supabase: Instance créée avec succès');
    }
    return supabaseInstance!;
  } catch (error) {
    console.error('❌ Supabase: Erreur lors de la création de l\'instance:', error);
    throw error;
  }
})();

// Auth helpers
export const signIn = async (email: string, password: string) => {
  console.log('🔐 Supabase: Tentative de connexion avec Supabase...');
  const startTime = performance.now();
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  const endTime = performance.now();
  console.log(`⏱️ Supabase: Connexion Supabase terminée en ${(endTime - startTime).toFixed(2)}ms`);
  
  if (error) {
    console.error('❌ Supabase: Erreur de connexion:', error);
  } else {
    console.log('✅ Supabase: Connexion réussie');
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
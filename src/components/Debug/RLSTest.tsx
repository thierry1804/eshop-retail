import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export const RLSTest: React.FC = () => {
  const [status, setStatus] = useState<string>('Initialisation...');
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkCurrentUser();
  }, []);

  const checkCurrentUser = async () => {
    try {
      setStatus('Vérification de l\'utilisateur actuel...');
      
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        setError(`Erreur utilisateur: ${userError.message}`);
        setStatus('❌ Erreur utilisateur');
        return;
      }

      if (!currentUser) {
        setError('Aucun utilisateur connecté');
        setStatus('❌ Pas d\'utilisateur');
        return;
      }

      setUser(currentUser);
      setStatus(`✅ Utilisateur connecté: ${currentUser.email}`);
      
      // Tester la récupération du profil
      await testProfileRetrieval(currentUser.id);
      
    } catch (err: any) {
      setError(`Erreur: ${err.message}`);
      setStatus('❌ Erreur');
    }
  };

  const testProfileRetrieval = async (userId: string) => {
    try {
      setStatus('Test de récupération du profil...');
      
      // @ts-ignore
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        setError(`Erreur récupération profil: ${error.message}`);
        setStatus('❌ Erreur récupération');
        return;
      }

      if (data) {
        setStatus(`✅ Profil trouvé: ${data.name}`);
      } else {
        setStatus('⚠️ Profil non trouvé, test de création...');
        await testProfileCreation(userId);
      }
      
    } catch (err: any) {
      setError(`Erreur récupération: ${err.message}`);
      setStatus('❌ Erreur récupération');
    }
  };

  const testProfileCreation = async (userId: string) => {
    try {
      setStatus('Test de création du profil...');
      
      const defaultProfile = {
        id: userId,
        email: user?.email || 'test@example.com',
        name: user?.email?.split('@')[0] || 'Utilisateur',
        role: 'employee' as const,
        created_at: new Date().toISOString(),
      };

      // @ts-ignore
      const { data, error } = await supabase
        .from('user_profiles')
        .insert(defaultProfile)
        .select()
        .single();

      if (error) {
        setError(`Erreur création profil: ${error.message}`);
        setStatus('❌ Erreur création');
        return;
      }

      setStatus(`✅ Profil créé avec succès: ${data.name}`);
      
    } catch (err: any) {
      setError(`Erreur création: ${err.message}`);
      setStatus('❌ Erreur création');
    }
  };

  const signInTest = async () => {
    try {
      setStatus('Connexion avec utilisateur de test...');
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123'
      });

      if (error) {
        setError(`Erreur connexion: ${error.message}`);
        setStatus('❌ Erreur connexion');
        return;
      }

      setStatus('✅ Connexion réussie');
      setUser(data.user);
      
      // Tester la récupération du profil après connexion
      await testProfileRetrieval(data.user.id);
      
    } catch (err: any) {
      setError(`Erreur connexion: ${err.message}`);
      setStatus('❌ Erreur connexion');
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setStatus('Déconnecté');
      setError(null);
    } catch (err: any) {
      setError(`Erreur déconnexion: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">🔐 Test RLS & Profil Utilisateur</h1>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-700">Status:</h3>
              <p className="text-sm text-gray-600">{status}</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <h4 className="font-medium text-red-800">Erreur:</h4>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {user && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <h4 className="font-medium text-green-800">Utilisateur connecté:</h4>
                <p className="text-sm text-green-700">{user.email}</p>
                <p className="text-sm text-green-600">ID: {user.id}</p>
              </div>
            )}

            <div className="flex space-x-4">
              <button
                onClick={signInTest}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                🔑 Connexion Test
              </button>
              <button
                onClick={checkCurrentUser}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                🔄 Vérifier
              </button>
              <button
                onClick={signOut}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                🚪 Déconnexion
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <h4 className="font-medium text-blue-800 mb-2">Instructions:</h4>
              <ol className="text-sm text-blue-700 space-y-1">
                <li>1. Créez un utilisateur dans Supabase Auth (test@example.com)</li>
                <li>2. Cliquez sur "Connexion Test"</li>
                <li>3. Vérifiez que le profil se crée automatiquement</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

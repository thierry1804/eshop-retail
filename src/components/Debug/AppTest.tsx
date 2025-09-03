import React, { useState, useEffect } from 'react';

export const AppTest: React.FC = () => {
  const [status, setStatus] = useState<string>('Initialisation...');
  const [envVars, setEnvVars] = useState<{url: string, key: string}>({url: '', key: ''});

  useEffect(() => {
    console.log('🧪 AppTest: Démarrage du test');
    
    // Test 1: Variables d'environnement
    setStatus('Vérification des variables d\'environnement...');
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    setEnvVars({url: url || 'NON DÉFINI', key: key ? 'DÉFINI' : 'NON DÉFINI'});
    
    if (!url || !key) {
      setStatus('❌ Variables d\'environnement manquantes');
      return;
    }
    
    // Test 2: Import Supabase
    setStatus('Test d\'import de Supabase...');
    try {
      import('../../lib/supabase').then(() => {
        setStatus('✅ Supabase importé avec succès');
      }).catch((error) => {
        setStatus(`❌ Erreur import Supabase: ${error.message}`);
      });
    } catch (error) {
      setStatus(`❌ Erreur lors de l'import: ${error}`);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">🧪 Test de l'Application</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-700">Status:</h3>
            <p className="text-sm text-gray-600">{status}</p>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-700">Variables d'environnement:</h3>
            <div className="text-sm space-y-1">
              <p>URL: <span className={envVars.url === 'NON DÉFINI' ? 'text-red-600' : 'text-green-600'}>{envVars.url}</span></p>
              <p>Clé: <span className={envVars.key === 'NON DÉFINI' ? 'text-red-600' : 'text-green-600'}>{envVars.key}</span></p>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <h4 className="font-medium text-blue-800 mb-2">Instructions:</h4>
            <ol className="text-sm text-blue-700 space-y-1">
              <li>1. Vérifiez la console (F12) pour les erreurs</li>
              <li>2. Créez le fichier .env si nécessaire</li>
              <li>3. Redémarrez le serveur</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

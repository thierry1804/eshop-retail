import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export const SupabaseTest: React.FC = () => {
  const [status, setStatus] = useState<string>('Initialisation...');
  const [clients, setClients] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    testSupabaseConnection();
  }, []);

  const testSupabaseConnection = async () => {
    try {
      setStatus('Test de connexion Supabase...');
      
      // Test 1: Vérifier la configuration
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!url || !key) {
        setError('Variables d\'environnement manquantes');
        setStatus('❌ Configuration manquante');
        return;
      }

      setStatus('Connexion établie, récupération des clients...');

      // Test 2: Récupérer des clients
      // @ts-ignore
      const { data, error: fetchError } = await supabase
        .from('clients')
        .select('*')
        .limit(5);

      if (fetchError) {
        setError(`Erreur récupération: ${fetchError.message}`);
        setStatus('❌ Erreur récupération');
        return;
      }

      setClients(data || []);
      setStatus(`✅ ${data?.length || 0} clients récupérés avec succès`);

    } catch (err: any) {
      setError(`Erreur: ${err.message}`);
      setStatus('❌ Erreur de connexion');
    }
  };

  const testInsertClient = async () => {
    try {
      setStatus('Test d\'insertion d\'un client...');
      
      const testClient = {
        first_name: 'Test',
        last_name: 'Client',
        phone: '+261 01 23 45 67 89',
        address: 'Adresse de test',
        trust_rating: 'good' as const,
        notes: 'Client de test créé automatiquement'
      };

      // @ts-ignore
      const { data, error: insertError } = await supabase
        .from('clients')
        .insert(testClient)
        .select();

      if (insertError) {
        setError(`Erreur insertion: ${insertError.message}`);
        setStatus('❌ Erreur insertion');
        return;
      }

      setStatus('✅ Client de test créé avec succès');
      testSupabaseConnection(); // Recharger la liste

    } catch (err: any) {
      setError(`Erreur insertion: ${err.message}`);
      setStatus('❌ Erreur insertion');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">🧪 Test Supabase</h1>
          
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

            <div className="flex space-x-4">
              <button
                onClick={testSupabaseConnection}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                🔄 Recharger
              </button>
              <button
                onClick={testInsertClient}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                ➕ Ajouter Client Test
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">📋 Clients ({clients.length})</h2>
          
          {clients.length === 0 ? (
            <p className="text-gray-500">Aucun client trouvé</p>
          ) : (
            <div className="space-y-3">
              {clients.map((client, index) => (
                <div key={client.id || index} className="border border-gray-200 rounded-md p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {client.first_name} {client.last_name}
                      </h3>
                      <p className="text-sm text-gray-600">{client.phone}</p>
                      <p className="text-sm text-gray-500">{client.address}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      client.trust_rating === 'good' ? 'bg-green-100 text-green-800' :
                      client.trust_rating === 'average' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {client.trust_rating === 'good' ? '✅ Bon' :
                       client.trust_rating === 'average' ? '⚠️ Moyen' : '❌ Mauvais'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

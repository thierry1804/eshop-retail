import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export const SalesTest: React.FC = () => {
  const [status, setStatus] = useState<string>('Initialisation...');
  const [sales, setSales] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    testSalesConnection();
  }, []);

  const testSalesConnection = async () => {
    try {
      setStatus('Test de connexion et authentification...');
      
      // Test 1: Vérifier l'utilisateur actuel
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
      
      if (!currentUser) {
        setError('Aucun utilisateur authentifié');
        setStatus('❌ Utilisateur non authentifié');
        return;
      }

      setStatus('Utilisateur authentifié, test des ventes...');

      // Test 2: Récupérer des ventes
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          *,
          clients (*)
        `)
        .order('created_at', { ascending: false });

      if (salesError) {
        setError(`Erreur récupération ventes: ${salesError.message}`);
        setStatus('❌ Erreur récupération ventes');
        return;
      }

      setSales(salesData || []);
      console.log('🔍 SalesTest: Ventes récupérées:', salesData);

      // Test 3: Récupérer des clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .limit(5);

      if (clientsError) {
        setError(`Erreur récupération clients: ${clientsError.message}`);
        setStatus('❌ Erreur récupération clients');
        return;
      }

      setClients(clientsData || []);
      console.log('🔍 SalesTest: Clients récupérés:', clientsData);

      setStatus(`✅ ${salesData?.length || 0} ventes et ${clientsData?.length || 0} clients récupérés`);

    } catch (err: any) {
      setError(`Erreur: ${err.message}`);
      setStatus('❌ Erreur de connexion');
    }
  };

  const testInsertSale = async () => {
    try {
      setStatus('Test d\'insertion d\'une vente...');
      
      if (clients.length === 0) {
        setError('Aucun client disponible pour créer une vente');
        setStatus('❌ Aucun client disponible');
        return;
      }

      const testSale = {
        client_id: clients[0].id,
        description: 'Vente de test - Jeans et chemise',
        total_amount: 15000,
        deposit: 5000,
        remaining_balance: 10000,
        status: 'ongoing'
      };

      const { data, error: insertError } = await supabase
        .from('sales')
        .insert(testSale)
        .select(`
          *,
          clients (*)
        `);

      if (insertError) {
        setError(`Erreur insertion vente: ${insertError.message}`);
        setStatus('❌ Erreur insertion vente');
        return;
      }

      setStatus('✅ Vente de test créée avec succès');
      testSalesConnection(); // Recharger la liste

    } catch (err: any) {
      setError(`Erreur insertion: ${err.message}`);
      setStatus('❌ Erreur insertion');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">🧪 Test des Ventes</h1>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-700">Status:</h3>
              <p className="text-sm text-gray-600">{status}</p>
            </div>

            {user && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <h4 className="font-medium text-green-800">Utilisateur authentifié:</h4>
                <p className="text-sm text-green-700">{user.email}</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <h4 className="font-medium text-red-800">Erreur:</h4>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex space-x-4">
              <button
                onClick={testSalesConnection}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                🔄 Recharger
              </button>
              <button
                onClick={testInsertSale}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                ➕ Ajouter Vente Test
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📋 Ventes ({sales.length})</h2>
            
            {sales.length === 0 ? (
              <p className="text-gray-500">Aucune vente trouvée</p>
            ) : (
              <div className="space-y-3">
                {sales.map((sale, index) => (
                  <div key={sale.id || index} className="border border-gray-200 rounded-md p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {sale.client?.first_name} {sale.client?.last_name}
                        </h3>
                        <p className="text-sm text-gray-600">{sale.description}</p>
                        <p className="text-sm text-gray-500">
                          Total: {sale.total_amount} MGA | Acompte: {sale.deposit} MGA
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        sale.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {sale.status === 'paid' ? '✅ Réglée' : '⏳ En cours'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">👥 Clients ({clients.length})</h2>
            
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
    </div>
  );
};

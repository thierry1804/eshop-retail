import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export const DatabaseTest: React.FC = () => {
  const [status, setStatus] = useState<string>('Initialisation...');
  const [results, setResults] = useState<any>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    runDatabaseTests();
  }, []);

  const runDatabaseTests = async () => {
    const testResults: any = {};
    
    try {
      setStatus('Test de connexion et authentification...');
      
      // Test 1: Authentification
      const { data: { user } } = await supabase.auth.getUser();
      testResults.auth = {
        success: !!user,
        user: user ? { id: user.id, email: user.email } : null
      };

      if (!user) {
        setError('Aucun utilisateur authentifié');
        setStatus('❌ Utilisateur non authentifié');
        setResults(testResults);
        return;
      }

      setStatus('Test des tables et données...');

      // Test 2: Table clients
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .limit(10);
      
      testResults.clients = {
        success: !clientsError,
        count: clients?.length || 0,
        error: clientsError?.message,
        sample: clients?.slice(0, 2)
      };

      // Test 3: Table sales
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .limit(10);
      
      testResults.sales = {
        success: !salesError,
        count: sales?.length || 0,
        error: salesError?.message,
        sample: sales?.slice(0, 2)
      };

      // Test 4: Jointure sales + clients
      const { data: salesWithClients, error: joinError } = await supabase
        .from('sales')
        .select(`
          *,
          clients (*)
        `)
        .limit(5);
      
      testResults.salesJoin = {
        success: !joinError,
        count: salesWithClients?.length || 0,
        error: joinError?.message,
        sample: salesWithClients?.slice(0, 2)
      };

      // Test 5: Table payments
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .limit(10);
      
      testResults.payments = {
        success: !paymentsError,
        count: payments?.length || 0,
        error: paymentsError?.message,
        sample: payments?.slice(0, 2)
      };

      // Test 6: Insertion de test
      if (clients && clients.length > 0) {
        const testSale = {
          client_id: clients[0].id,
          description: 'Vente de test diagnostique',
          total_amount: 10000,
          deposit: 5000,
          remaining_balance: 5000,
          status: 'ongoing'
        };

        const { data: insertedSale, error: insertError } = await supabase
          .from('sales')
          .insert(testSale)
          .select();

        testResults.insertTest = {
          success: !insertError,
          error: insertError?.message,
          inserted: insertedSale
        };

        // Nettoyer la vente de test
        if (insertedSale && insertedSale.length > 0) {
          await supabase
            .from('sales')
            .delete()
            .eq('id', insertedSale[0].id);
        }
      }

      setResults(testResults);
      setStatus('✅ Tests terminés');
      
    } catch (err: any) {
      setError(`Erreur générale: ${err.message}`);
      setStatus('❌ Erreur lors des tests');
      setResults(testResults);
    }
  };

  const getStatusIcon = (success: boolean) => success ? '✅' : '❌';
  const getStatusColor = (success: boolean) => success ? 'text-green-600' : 'text-red-600';

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">🔧 Test de Base de Données</h1>
          
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

            <button
              onClick={runDatabaseTests}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              🔄 Relancer les tests
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Authentification */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {getStatusIcon(results.auth?.success)} Authentification
            </h2>
            <div className="space-y-2">
              <p className={`text-sm ${getStatusColor(results.auth?.success)}`}>
                {results.auth?.success ? 'Utilisateur authentifié' : 'Non authentifié'}
              </p>
              {results.auth?.user && (
                <div className="text-xs text-gray-600">
                  <p>ID: {results.auth.user.id}</p>
                  <p>Email: {results.auth.user.email}</p>
                </div>
              )}
            </div>
          </div>

          {/* Table Clients */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {getStatusIcon(results.clients?.success)} Table Clients
            </h2>
            <div className="space-y-2">
              <p className={`text-sm ${getStatusColor(results.clients?.success)}`}>
                {results.clients?.count || 0} clients trouvés
              </p>
              {results.clients?.error && (
                <p className="text-xs text-red-600">{results.clients.error}</p>
              )}
              {results.clients?.sample && results.clients.sample.length > 0 && (
                <div className="text-xs text-gray-600">
                  <p>Exemple: {results.clients.sample[0].first_name} {results.clients.sample[0].last_name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Table Sales */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {getStatusIcon(results.sales?.success)} Table Sales
            </h2>
            <div className="space-y-2">
              <p className={`text-sm ${getStatusColor(results.sales?.success)}`}>
                {results.sales?.count || 0} ventes trouvées
              </p>
              {results.sales?.error && (
                <p className="text-xs text-red-600">{results.sales.error}</p>
              )}
              {results.sales?.sample && results.sales.sample.length > 0 && (
                <div className="text-xs text-gray-600">
                  <p>Exemple: {results.sales.sample[0].description}</p>
                  <p>Montant: {results.sales.sample[0].total_amount} MGA</p>
                </div>
              )}
            </div>
          </div>

          {/* Jointure Sales + Clients */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {getStatusIcon(results.salesJoin?.success)} Jointure Sales + Clients
            </h2>
            <div className="space-y-2">
              <p className={`text-sm ${getStatusColor(results.salesJoin?.success)}`}>
                {results.salesJoin?.count || 0} ventes avec clients
              </p>
              {results.salesJoin?.error && (
                <p className="text-xs text-red-600">{results.salesJoin.error}</p>
              )}
              {results.salesJoin?.sample && results.salesJoin.sample.length > 0 && (
                <div className="text-xs text-gray-600">
                  <p>Exemple: {results.salesJoin.sample[0].client?.first_name} {results.salesJoin.sample[0].client?.last_name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Table Payments */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {getStatusIcon(results.payments?.success)} Table Payments
            </h2>
            <div className="space-y-2">
              <p className={`text-sm ${getStatusColor(results.payments?.success)}`}>
                {results.payments?.count || 0} paiements trouvés
              </p>
              {results.payments?.error && (
                <p className="text-xs text-red-600">{results.payments.error}</p>
              )}
            </div>
          </div>

          {/* Test d'insertion */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {getStatusIcon(results.insertTest?.success)} Test d'insertion
            </h2>
            <div className="space-y-2">
              <p className={`text-sm ${getStatusColor(results.insertTest?.success)}`}>
                {results.insertTest?.success ? 'Insertion réussie' : 'Échec insertion'}
              </p>
              {results.insertTest?.error && (
                <p className="text-xs text-red-600">{results.insertTest.error}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};



import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Eye, CreditCard } from 'lucide-react';
import { SaleForm } from './SaleForm';
import { PaymentForm } from '../Payments/PaymentForm';
import { supabase } from '../../lib/supabase';
import { Sale } from '../../types';

export const SalesList: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ongoing' | 'paid'>('all');
  const [showForm, setShowForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSales();
  }, []);

  useEffect(() => {
    let filtered = sales;
    
    // Si il y a un terme de recherche, filtrer
    if (searchTerm.trim()) {
      filtered = filtered.filter(sale =>
        sale.client && (
          `${sale.client.first_name} ${sale.client.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
          sale.client.phone.includes(searchTerm) ||
          sale.description.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Si il y a un filtre de statut, filtrer
    if (statusFilter !== 'all') {
      filtered = filtered.filter(sale => sale.status === statusFilter);
    }

    setFilteredSales(filtered);
  }, [sales, searchTerm, statusFilter]);

  const fetchSales = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // D'abord, récupérer les ventes sans jointure pour voir les client_id
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });

      if (salesError) {
        setError(`Erreur de récupération: ${salesError.message}`);
        return;
      }

      // Ensuite, récupérer les clients séparément
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*');

      if (clientsError) {
        setError(`Erreur de récupération clients: ${clientsError.message}`);
        return;
      }

      // Créer un map des clients par ID
      const clientsMap = new Map(clientsData?.map(client => [client.id, client]) || []);

      // Associer les clients aux ventes
      const salesWithClients = salesData?.map(sale => ({
        ...sale,
        client: clientsMap.get(sale.client_id) || null
      })) || [];

      setSales(salesWithClients);
    } catch (error: any) {
      setError(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };



  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'MGA',
    }).format(amount);
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'paid':
        return { label: 'Réglée', className: 'text-green-600 bg-green-100' };
      case 'ongoing':
        return { label: 'En cours', className: 'text-yellow-600 bg-yellow-100' };
      default:
        return { label: 'Inconnue', className: 'text-gray-600 bg-gray-100' };
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des ventes...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestion des Ventes</h1>
                  <div className="flex items-center space-x-3">
            <button
              onClick={fetchSales}
              className="flex items-center space-x-2 px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              <span>🔄</span>
              <span>Actualiser</span>
            </button>

            <button
              onClick={() => {
                setSelectedSale(null);
                setShowForm(true);
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              <span>Nouvelle Vente</span>
            </button>
          </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par client, téléphone ou description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        <div className="flex space-x-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Tous les statuts</option>
            <option value="ongoing">En cours</option>
            <option value="paid">Réglées</option>
          </select>
          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
            }}
            className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
          >
            Effacer filtres
          </button>
        </div>
      </div>

      {/* Status Display */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-blue-600 font-medium">Ventes totales:</span>
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
                {sales.length}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-blue-600 font-medium">Affichées:</span>
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
                {filteredSales.length}
              </span>
            </div>
          </div>
          <div className="text-sm text-blue-600">
            Dernière mise à jour: {new Date().toLocaleTimeString('fr-FR')}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Erreur de récupération des données</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    fetchSales();
                  }}
                  className="mt-2 px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                >
                  Réessayer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Sales List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montants
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSales.map((sale) => {
                const statusDisplay = getStatusDisplay(sale.status);
                return (
                  <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-medium text-sm">
                            {sale.client ? `${sale.client.first_name?.[0] || ''}${sale.client.last_name?.[0] || ''}` : 'NC'}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {sale.client ? `${sale.client.first_name || ''} ${sale.client.last_name || ''}` : 'Client non trouvé'}
                          </div>
                          <div className="text-sm text-gray-500">{sale.client?.phone || 'Téléphone non disponible'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {sale.description}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          Total: {formatCurrency(sale.total_amount)}
                        </div>
                        <div className="text-gray-500">
                          Acompte: {formatCurrency(sale.deposit)}
                        </div>
                        <div className={`font-medium ${sale.remaining_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          Reste: {formatCurrency(sale.remaining_balance)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusDisplay.className}`}>
                        {statusDisplay.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(sale.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {sale.status === 'ongoing' && (
                          <button
                            onClick={() => {
                              setSelectedSale(sale);
                              setShowPaymentForm(true);
                            }}
                            className="text-green-600 hover:text-green-800 transition-colors"
                            title="Ajouter un paiement"
                          >
                            <CreditCard size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedSale(sale);
                            setShowForm(true);
                          }}
                          className="text-yellow-600 hover:text-yellow-800 transition-colors"
                          title="Modifier"
                        >
                          <Edit size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredSales.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">
              {searchTerm || statusFilter !== 'all' ? 'Aucune vente trouvée pour ces critères' : 'Aucune vente enregistrée'}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Ventes totales: {sales.length} | Ventes filtrées: {filteredSales.length}
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <SaleForm
          sale={selectedSale}
          onClose={() => {
            setShowForm(false);
            setSelectedSale(null);
          }}
          onSubmit={() => {
            setShowForm(false);
            setSelectedSale(null);
            fetchSales();
          }}
        />
      )}

      {showPaymentForm && selectedSale && (
        <PaymentForm
          sale={selectedSale}
          onClose={() => {
            setShowPaymentForm(false);
            setSelectedSale(null);
          }}
          onSubmit={() => {
            setShowPaymentForm(false);
            setSelectedSale(null);
            fetchSales();
          }}
        />
      )}
    </div>
  );
};
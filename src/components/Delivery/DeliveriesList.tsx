import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Delivery, User } from '../../types';
import { Plus, Search, Truck, MapPin, Clock, Eye, Edit, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DeliveryForm } from './DeliveryForm';
import { DeliveryDetails } from './DeliveryDetails';
import { DeliverySchedule } from './DeliverySchedule';
import { DeliveryReport } from './DeliveryReport';

interface DeliveriesListProps {
  user: User;
}

export const DeliveriesList: React.FC<DeliveriesListProps> = ({ user }) => {
  const { t } = useTranslation();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'list' | 'schedule' | 'report'>('list');

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const fetchDeliveries = async () => {
    try {
      setLoading(true);

      // Première approche : requête simple sans relations
      const { data: deliveriesData, error: deliveriesError } = await supabase
        .from('deliveries')
        .select('*')
        .order('delivery_date', { ascending: false });

      if (deliveriesError) throw deliveriesError;

      if (!deliveriesData || deliveriesData.length === 0) {
        setDeliveries([]);
        return;
      }

      // Récupérer les IDs uniques des clients et ventes
      const clientIds = [...new Set(deliveriesData.map(d => d.client_id).filter(Boolean))];
      const saleIds = [...new Set(deliveriesData.map(d => d.sale_id).filter(Boolean))];

      // Récupérer les données des clients
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, first_name, last_name, phone')
        .in('id', clientIds);

      // Récupérer les données des ventes
      const { data: salesData } = await supabase
        .from('sales')
        .select('id, description, total_amount')
        .in('id', saleIds);

      // Combiner les données
      const enrichedDeliveries = deliveriesData.map(delivery => ({
        ...delivery,
        clients: clientsData?.find(c => c.id === delivery.client_id),
        sales: salesData?.find(s => s.id === delivery.sale_id)
      }));

      setDeliveries(enrichedDeliveries);
    } catch (error) {
      console.error('Erreur lors du chargement des livraisons:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateDeliveryStatus = async (deliveryId: string, newStatus: string) => {
    try {
      setUpdatingStatus(deliveryId);

      const { error } = await supabase
        .from('deliveries')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
          ...(newStatus === 'delivered' && { delivered_at: new Date().toISOString() })
        })
        .eq('id', deliveryId);

      if (error) throw error;

      // Rafraîchir la liste
      await fetchDeliveries();
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      alert('Erreur lors de la mise à jour du statut de la livraison');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleStatusChange = (deliveryId: string, newStatus: string, statusText: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir marquer cette livraison comme "${statusText}" ?`)) {
      updateDeliveryStatus(deliveryId, newStatus);
    }
  };

  const filteredDeliveries = deliveries.filter(delivery => {
    const matchesSearch = 
      delivery.delivery_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      delivery.clients?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      delivery.clients?.last_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || delivery.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'preparing': return 'bg-blue-100 text-blue-800';
      case 'in_transit': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'En attente';
      case 'preparing': return 'Préparation';
      case 'in_transit': return 'En transit';
      case 'delivered': return 'Livré';
      case 'failed': return 'Échec';
      case 'cancelled': return 'Annulé';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('deliveries.title')}</h1>
          <p className="text-sm sm:text-base text-gray-600">{t('deliveries.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm sm:text-base whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          {t('deliveries.newDelivery')}
        </button>
      </div>

      {/* Navigation des vues */}
      <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
        <div className="flex flex-wrap gap-2 sm:gap-4">
          <button
            onClick={() => setActiveView('list')}
            className={`px-3 sm:px-4 py-2 rounded-md font-medium transition-colors text-xs sm:text-sm ${activeView === 'list'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            <Truck className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Liste des livraisons</span>
            <span className="sm:hidden">Liste</span>
          </button>
          <button
            onClick={() => setActiveView('schedule')}
            className={`px-3 sm:px-4 py-2 rounded-md font-medium transition-colors text-xs sm:text-sm ${activeView === 'schedule'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            <Clock className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1 sm:mr-2" />
            <span className="hidden sm:inline">{t('deliveries.deliverySchedule')}</span>
            <span className="sm:hidden">Planning</span>
          </button>
          <button
            onClick={() => setActiveView('report')}
            className={`px-3 sm:px-4 py-2 rounded-md font-medium transition-colors text-xs sm:text-sm ${activeView === 'report'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1 sm:mr-2" />
            <span className="hidden sm:inline">{t('deliveries.deliveryReport')}</span>
            <span className="sm:hidden">Rapport</span>
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder={t('deliveries.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">{t('deliveries.filters.allStatuses')}</option>
            <option value="pending">{t('deliveries.status.pending')}</option>
            <option value="preparing">{t('deliveries.status.preparing')}</option>
            <option value="in_transit">{t('deliveries.status.in_transit')}</option>
            <option value="delivered">{t('deliveries.status.delivered')}</option>
            <option value="failed">{t('deliveries.status.failed')}</option>
            <option value="cancelled">{t('deliveries.status.cancelled')}</option>
          </select>
        </div>
      </div>

      {/* Contenu conditionnel selon la vue active */}
      {activeView === 'list' && (
        <>
          {/* Liste des livraisons - Mobile Card View */}
          <div className="md:hidden space-y-3">
            {filteredDeliveries.map((delivery) => (
              <div key={delivery.id} className="bg-white rounded-lg shadow-md p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <Truck className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate">{delivery.delivery_number}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {delivery.clients?.first_name} {delivery.clients?.last_name}
                      </div>
                    </div>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ml-2 flex-shrink-0 ${getStatusColor(delivery.status)}`}>
                    {t(`deliveries.status.${delivery.status}`)}
                  </span>
                </div>
                <div className="space-y-2 text-xs pt-2 border-t border-gray-100">
                  {delivery.sales && (
                    <div>
                      <div className="text-gray-900 font-medium truncate">{delivery.sales.description}</div>
                      <div className="text-gray-500">
                        {new Intl.NumberFormat('fr-FR', {
                          style: 'currency',
                          currency: 'MGA',
                        }).format(delivery.sales.total_amount)}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center text-gray-600">
                    <Clock className="h-3 w-3 mr-1" />
                    <span>{new Date(delivery.delivery_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-start text-gray-600">
                    <MapPin className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                    <span className="truncate">{delivery.delivery_address}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedDeliveryId(delivery.id)}
                        className="text-blue-600 hover:text-blue-900 text-xs font-medium"
                      >
                        <Eye className="h-3 w-3 inline mr-1" />
                        Voir
                      </button>
                      {delivery.status !== 'delivered' && (
                        <>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => setSelectedDeliveryId(delivery.id)}
                            className="text-indigo-600 hover:text-indigo-900 text-xs font-medium"
                          >
                            <Edit className="h-3 w-3 inline mr-1" />
                            Modifier
                          </button>
                        </>
                      )}
                    </div>
                    {delivery.status !== 'delivered' && delivery.status !== 'failed' && delivery.status !== 'cancelled' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleStatusChange(delivery.id, 'delivered', 'Livrée')}
                          disabled={updatingStatus === delivery.id}
                          className="bg-green-100 text-green-700 hover:bg-green-200 px-2 py-1 rounded text-xs disabled:opacity-50"
                        >
                          <CheckCircle className="h-3 w-3 inline" />
                        </button>
                        <button
                          onClick={() => handleStatusChange(delivery.id, 'failed', 'Échouée')}
                          disabled={updatingStatus === delivery.id}
                          className="bg-red-100 text-red-700 hover:bg-red-200 px-2 py-1 rounded text-xs disabled:opacity-50"
                        >
                          <XCircle className="h-3 w-3 inline" />
                        </button>
                      </div>
                    )}
                  </div>
                  {updatingStatus === delivery.id && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 pt-1">
                      <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-500"></div>
                      Mise à jour...
                    </div>
                  )}
                </div>
              </div>
            ))}
            {filteredDeliveries.length === 0 && (
              <div className="text-center py-8 bg-white rounded-lg shadow-md">
                <p className="text-gray-500 text-sm">Aucune livraison trouvée</p>
              </div>
            )}
          </div>

          {/* Liste des livraisons - Desktop Table View */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('deliveries.table.number')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('deliveries.table.client')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('deliveries.table.sale')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('deliveries.table.date')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('deliveries.table.address')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('deliveries.table.status')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDeliveries.map((delivery) => (
                    <tr key={delivery.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Truck className="h-5 w-5 text-gray-400 mr-2" />
                          <span className="text-sm font-medium text-gray-900">{delivery.delivery_number}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {delivery.clients?.first_name} {delivery.clients?.last_name}
                        </div>
                        <div className="text-sm text-gray-500">{delivery.clients?.phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {delivery.sales ? (
                          <div className="text-sm">
                            <div className="text-gray-900 font-medium truncate max-w-xs" title={delivery.sales.description}>
                              {delivery.sales.description}
                            </div>
                            <div className="text-gray-500">
                              {new Intl.NumberFormat('fr-FR', {
                                style: 'currency',
                                currency: 'MGA',
                              }).format(delivery.sales.total_amount)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 italic">Aucune vente</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 text-gray-400 mr-1" />
                          <span className="text-sm text-gray-900">
                            {new Date(delivery.delivery_date).toLocaleDateString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 text-gray-400 mr-1" />
                          <span className="text-sm text-gray-900 truncate max-w-xs">
                            {delivery.delivery_address}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(delivery.status)}`}>
                          {t(`deliveries.status.${delivery.status}`)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSelectedDeliveryId(delivery.id)}
                              className="text-blue-600 hover:text-blue-900 flex items-center gap-1 text-xs"
                            >
                              <Eye className="h-3 w-3" />
                              {t('deliveries.viewDetails')}
                            </button>
                            <button
                              onClick={() => setSelectedDeliveryId(delivery.id)}
                              disabled={delivery.status === 'delivered'}
                              className={`flex items-center gap-1 text-xs ${delivery.status === 'delivered'
                                  ? 'text-gray-400 cursor-not-allowed'
                                  : 'text-indigo-600 hover:text-indigo-900'
                                }`}
                              title={delivery.status === 'delivered' ? 'Impossible de modifier une livraison livrée' : 'Modifier la livraison'}
                            >
                              <Edit className="h-3 w-3" />
                              {t('app.edit')}
                            </button>
                          </div>
                          {delivery.status !== 'delivered' && delivery.status !== 'failed' && delivery.status !== 'cancelled' && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleStatusChange(delivery.id, 'delivered', 'Livrée')}
                                disabled={updatingStatus === delivery.id}
                                className="bg-green-100 text-green-700 hover:bg-green-200 px-2 py-1 rounded text-xs flex items-center gap-1 disabled:opacity-50"
                                title="Marquer comme livrée"
                              >
                                <CheckCircle className="h-3 w-3" />
                                Livrée
                              </button>
                              <button
                                onClick={() => handleStatusChange(delivery.id, 'failed', 'Échouée')}
                                disabled={updatingStatus === delivery.id}
                                className="bg-red-100 text-red-700 hover:bg-red-200 px-2 py-1 rounded text-xs flex items-center gap-1 disabled:opacity-50"
                                title="Marquer comme échouée"
                              >
                                <XCircle className="h-3 w-3" />
                                Échouée
                              </button>
                            </div>
                          )}
                          {updatingStatus === delivery.id && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-500"></div>
                              Mise à jour...
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeView === 'schedule' && (
        <DeliverySchedule user={user} />
      )}

      {activeView === 'report' && (
        <DeliveryReport user={user} />
      )}

      {/* Modal de création */}
      {showForm && (
        <DeliveryForm
          onClose={() => setShowForm(false)}
          onSave={() => {
            fetchDeliveries();
            setShowForm(false);
          }}
          user={user}
        />
      )}

      {/* Modal de détails/modification */}
      {selectedDeliveryId && (
        <DeliveryDetails
          deliveryId={selectedDeliveryId}
          onClose={() => setSelectedDeliveryId(null)}
          onSave={() => {
            fetchDeliveries();
            setSelectedDeliveryId(null);
          }}
          user={user}
        />
      )}
    </div>
  );
};

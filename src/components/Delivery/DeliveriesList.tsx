import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Delivery, User } from '../../types';
import { Plus, Search, Truck, MapPin, Clock, Eye, Edit, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DeliveryForm } from './DeliveryForm';
import { DeliveryDetails } from './DeliveryDetails';

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
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('deliveries.title')}</h1>
          <p className="text-gray-600">{t('deliveries.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {t('deliveries.newDelivery')}
        </button>
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

      {/* Liste des livraisons */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('deliveries.table.number')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('deliveries.table.client')}</th>
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
                      {/* Actions principales */}
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

                      {/* Actions rapides de statut */}
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

                      {/* Indicateur de chargement */}
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

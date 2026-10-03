import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Delivery, User } from '../../types';
import { Plus, Truck, MapPin, Clock, Eye, Edit, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { SearchField } from '../ui/SearchField';
import { useTranslation } from 'react-i18next';
import { DeliveryForm } from './DeliveryForm';
import { DeliveryDetails } from './DeliveryDetails';
import { DeliverySchedule } from './DeliverySchedule';
import { DeliveryReport } from './DeliveryReport';
import { DataTable, dtTh, dtTd, dtTdMuted, dtTdWrap } from '../ui/DataTable';
import { formatDateDisplay } from '../../lib/dateUtils';

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

  // Flag pour éviter les chargements multiples au montage
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    // Ne charger qu'une seule fois au montage
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      fetchDeliveries();
    }
  }, []);

  const fetchDeliveries = async () => {
    try {
      setLoading(true);

      // OPTIMISÉ: Une seule requête avec jointures au lieu de 3 requêtes séparées
      const { data: deliveriesData, error: deliveriesError } = await supabase
        .from('deliveries')
        .select(`
          *,
          clients:client_id(id, first_name, last_name, phone),
          sales:sale_id(id, description, total_amount)
        `)
        .order('delivery_date', { ascending: false });

      if (deliveriesError) throw deliveriesError;

      setDeliveries(deliveriesData || []);
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
      case 'pending': return 'app-badge bg-yellow-100 text-yellow-800';
      case 'preparing': return 'app-badge app-badge-info';
      case 'in_transit': return 'app-badge bg-purple-100 text-purple-800';
      case 'delivered': return 'app-badge app-badge-success';
      case 'failed': return 'app-badge app-badge-danger';
      case 'cancelled': return 'app-badge';
      default: return 'app-badge';
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--app-primary)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="app-sticky-chrome space-y-2">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="app-page-title">{t('deliveries.title')}</h1>
          <p className="app-page-subtitle">{t('deliveries.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setShowForm(true)}
            className="app-btn app-btn-primary app-btn-sm whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('deliveries.newDelivery')}
          </button>
        </div>
      </div>

      {/* Navigation des vues */}
      <div className="app-toolbar">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveView('list')}
            className={`app-btn app-btn-sm ${activeView === 'list'
                ? 'app-btn-primary'
                : 'app-btn-secondary'
              }`}
          >
            <Truck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Liste des livraisons</span>
            <span className="sm:hidden">Liste</span>
          </button>
          <button
            onClick={() => setActiveView('schedule')}
            className={`app-btn app-btn-sm ${activeView === 'schedule'
                ? 'app-btn-primary'
                : 'app-btn-secondary'
              }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('deliveries.deliverySchedule')}</span>
            <span className="sm:hidden">Planning</span>
          </button>
          <button
            onClick={() => setActiveView('report')}
            className={`app-btn app-btn-sm ${activeView === 'report'
                ? 'app-btn-primary'
                : 'app-btn-secondary'
              }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('deliveries.deliveryReport')}</span>
            <span className="sm:hidden">Rapport</span>
          </button>
        </div>
      </div>

      {/* Filtres */}
        <div className="app-toolbar">
          <SearchField
            className="min-w-[12rem]"
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t('deliveries.searchPlaceholder')}
            inputClassName="text-xs py-1.5"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="app-input text-xs py-1.5 w-auto md:min-w-[12rem]"
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
              <div key={delivery.id} className="app-list-card">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <Truck className="h-5 w-5 app-text-muted flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium app-text truncate">{delivery.delivery_number}</div>
                      <div className="text-xs app-text-muted truncate">
                        {delivery.clients?.first_name} {delivery.clients?.last_name}
                      </div>
                    </div>
                  </div>
                  <span className={`ml-2 flex-shrink-0 ${getStatusColor(delivery.status)}`}>
                    {t(`deliveries.status.${delivery.status}`)}
                  </span>
                </div>
                <div className="space-y-2 text-xs pt-2 border-t app-divider">
                  {delivery.sales && (
                    <div>
                      <div className="app-text font-medium truncate">{delivery.sales.description}</div>
                      <div className="app-text-muted">
                        {new Intl.NumberFormat('fr-FR', {
                          style: 'currency',
                          currency: 'MGA',
                        }).format(delivery.sales.total_amount)}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center app-text-muted">
                    <Clock className="h-3 w-3 mr-1" />
                    <span>{formatDateDisplay(delivery.delivery_date)}</span>
                  </div>
                  <div className="flex items-start app-text-muted">
                    <MapPin className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                    <span className="truncate">{delivery.delivery_address}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t app-divider">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedDeliveryId(delivery.id)}
                        className="app-text-link hover:opacity-80 text-xs font-medium"
                      >
                        <Eye className="h-3 w-3 inline mr-1" />
                        Voir
                      </button>
                      {delivery.status !== 'delivered' && (
                        <>
                          <span className="app-text-muted opacity-40">|</span>
                          <button
                            onClick={() => setSelectedDeliveryId(delivery.id)}
                            className="app-text-link hover:opacity-80 text-xs font-medium"
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
                          className="app-btn app-btn-sm app-btn-success disabled:opacity-50"
                        >
                          <CheckCircle className="h-3 w-3 inline" />
                        </button>
                        <button
                          onClick={() => handleStatusChange(delivery.id, 'failed', 'Échouée')}
                          disabled={updatingStatus === delivery.id}
                          className="app-btn app-btn-sm app-btn-danger disabled:opacity-50"
                        >
                          <XCircle className="h-3 w-3 inline" />
                        </button>
                      </div>
                    )}
                  </div>
                  {updatingStatus === delivery.id && (
                    <div className="flex items-center gap-1 text-xs app-text-muted pt-1">
                      <div className="animate-spin rounded-full h-3 w-3 border-b border-[var(--app-ink-muted)]"></div>
                      Mise à jour...
                    </div>
                  )}
                </div>
              </div>
            ))}
            {filteredDeliveries.length === 0 && (
              <div className="app-empty">
                <p className="app-empty-text">Aucune livraison trouvée</p>
              </div>
            )}
          </div>

          {/* Liste des livraisons - Desktop Table View */}
          <div className="hidden md:block app-table-wrap">
            <DataTable>
                <thead className="app-bg-muted">
                  <tr>
                    <th className={dtTh}>{t('deliveries.table.number')}</th>
                    <th className={dtTh}>{t('deliveries.table.client')}</th>
                    <th className={dtTh}>{t('deliveries.table.sale')}</th>
                    <th className={dtTh}>{t('deliveries.table.date')}</th>
                    <th className={dtTh}>{t('deliveries.table.address')}</th>
                    <th className={dtTh}>{t('deliveries.table.status')}</th>
                    <th className={dtTh}>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-[var(--app-border)]">
                  {filteredDeliveries.map((delivery) => (
                    <tr key={delivery.id} className="hover:bg-[var(--app-surface-muted)]">
                      <td className={dtTd}>
                        <div className="flex items-center">
                          <Truck className="h-3.5 w-3.5 app-text-muted mr-1.5 flex-shrink-0" />
                          <span className="font-medium">{delivery.delivery_number}</span>
                        </div>
                      </td>
                      <td className={dtTdWrap}>
                        <div className="app-text">
                          {delivery.clients?.first_name} {delivery.clients?.last_name}
                        </div>
                        <div className="app-text-muted">{delivery.clients?.phone}</div>
                      </td>
                      <td className={dtTdWrap}>
                        {delivery.sales ? (
                          <div>
                            <div className="app-text font-medium truncate max-w-xs" title={delivery.sales.description}>
                              {delivery.sales.description}
                            </div>
                            <div className="app-text-muted">
                              {new Intl.NumberFormat('fr-FR', {
                                style: 'currency',
                                currency: 'MGA',
                              }).format(delivery.sales.total_amount)}
                            </div>
                          </div>
                        ) : (
                          <span className="app-text-muted italic">Aucune vente</span>
                        )}
                      </td>
                      <td className={dtTd}>
                        <div className="flex items-center">
                          <Clock className="h-3.5 w-3.5 app-text-muted mr-1 flex-shrink-0" />
                          <span>
                            {formatDateDisplay(delivery.delivery_date)}
                          </span>
                        </div>
                      </td>
                      <td className={dtTdWrap}>
                        <div className="flex items-center">
                          <MapPin className="h-3.5 w-3.5 app-text-muted mr-1 flex-shrink-0" />
                          <span className="truncate max-w-xs">
                            {delivery.delivery_address}
                          </span>
                        </div>
                      </td>
                      <td className={dtTd}>
                        <span className={`${getStatusColor(delivery.status)}`}>
                          {t(`deliveries.status.${delivery.status}`)}
                        </span>
                      </td>
                      <td className={`${dtTd} font-medium`}>
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSelectedDeliveryId(delivery.id)}
                              className="app-text-link hover:opacity-80 flex items-center gap-1 text-xs"
                            >
                              <Eye className="h-3 w-3" />
                              {t('deliveries.viewDetails')}
                            </button>
                            <button
                              onClick={() => setSelectedDeliveryId(delivery.id)}
                              disabled={delivery.status === 'delivered'}
                              className={`flex items-center gap-1 text-xs ${delivery.status === 'delivered'
                                  ? 'app-text-muted cursor-not-allowed'
                                  : 'app-text-link hover:opacity-80'
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
                                className="app-btn app-btn-sm app-btn-success flex items-center gap-1 disabled:opacity-50"
                                title="Marquer comme livrée"
                              >
                                <CheckCircle className="h-3 w-3" />
                                Livrée
                              </button>
                              <button
                                onClick={() => handleStatusChange(delivery.id, 'failed', 'Échouée')}
                                disabled={updatingStatus === delivery.id}
                                className="app-btn app-btn-sm app-btn-danger flex items-center gap-1 disabled:opacity-50"
                                title="Marquer comme échouée"
                              >
                                <XCircle className="h-3 w-3" />
                                Échouée
                              </button>
                            </div>
                          )}
                          {updatingStatus === delivery.id && (
                            <div className="flex items-center gap-1 text-xs app-text-muted">
                              <div className="animate-spin rounded-full h-3 w-3 border-b border-[var(--app-ink-muted)]"></div>
                              Mise à jour...
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
            </DataTable>
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

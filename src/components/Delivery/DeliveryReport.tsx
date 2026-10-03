import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Delivery, User } from '../../types';
import { Calendar, Truck, MapPin, Clock, CheckCircle, XCircle, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDateToLocalString, formatDateDisplay } from '../../lib/dateUtils';

interface DeliveryReportProps {
  user: User;
}

interface DeliveryStats {
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
  cancelled: number;
  totalRevenue: number;
  averageDeliveryTime: number;
}

export const DeliveryReport: React.FC<DeliveryReportProps> = ({ user }) => {
  const { t } = useTranslation();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return formatDateToLocalString(today);
  });
  const [stats, setStats] = useState<DeliveryStats>({
    total: 0,
    completed: 0,
    pending: 0,
    inProgress: 0,
    cancelled: 0,
    totalRevenue: 0,
    averageDeliveryTime: 0
  });

  useEffect(() => {
    fetchDeliveriesForDate(selectedDate);
  }, [selectedDate]);

  const fetchDeliveriesForDate = async (date: string) => {
    try {
      setLoading(true);
      
      // Récupérer les livraisons pour la date sélectionnée
      const { data: deliveriesData, error: deliveriesError } = await supabase
        .from('deliveries')
        .select(`
          *,
          clients:client_id (
            id,
            first_name,
            last_name,
            phone,
            address
          ),
          sales:sale_id (
            id,
            description,
            total_amount
          )
        `)
        .eq('delivery_date', date)
        .order('created_at', { ascending: true });

      if (deliveriesError) throw deliveriesError;

      setDeliveries(deliveriesData || []);
      calculateStats(deliveriesData || []);
    } catch (error) {
      console.error('Erreur lors de la récupération des livraisons:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (deliveriesData: Delivery[]) => {
    const newStats: DeliveryStats = {
      total: deliveriesData.length,
      completed: deliveriesData.filter(d => d.status === 'completed').length,
      pending: deliveriesData.filter(d => d.status === 'pending').length,
      inProgress: deliveriesData.filter(d => d.status === 'in_progress').length,
      cancelled: deliveriesData.filter(d => d.status === 'cancelled').length,
      totalRevenue: 0,
      averageDeliveryTime: 0
    };

    // Calculer le revenu total des ventes associées
    deliveriesData.forEach(delivery => {
      if (delivery.sales && delivery.status === 'completed') {
        newStats.totalRevenue += delivery.sales.total_amount || 0;
      }
    });

    // Calculer le temps moyen de livraison (simulation)
    const completedDeliveries = deliveriesData.filter(d => d.status === 'completed');
    if (completedDeliveries.length > 0) {
      // Simulation du temps de livraison basé sur la distance (exemple)
      newStats.averageDeliveryTime = 45; // minutes
    }

    setStats(newStats);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'in_progress':
        return <Truck className="h-5 w-5 app-text-link" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 app-text-muted" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Terminée';
      case 'in_progress':
        return 'En cours';
      case 'pending':
        return 'En attente';
      case 'cancelled':
        return 'Annulée';
      default:
        return 'Inconnu';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'app-badge app-badge-success';
      case 'in_progress':
        return 'app-badge app-badge-info';
      case 'pending':
        return 'app-badge bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'app-badge app-badge-danger';
      default:
        return 'app-badge';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'MGA',
    }).format(amount);
  };

  const getCompletionRate = () => {
    if (stats.total === 0) return 0;
    return Math.round((stats.completed / stats.total) * 100);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold app-text">{t('deliveries.deliveryReport')}</h1>
          <p className="app-text-muted mt-1">Analyse et statistiques des livraisons</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 app-text-muted" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border app-border rounded-md px-3 py-2 "
            />
          </div>
        </div>
      </div>

      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="app-surface p-6">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-[color-mix(in_srgb,var(--app-primary)_12%,var(--app-surface))]">
              <Truck className="h-6 w-6 app-text-link" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium app-text-muted">Total des livraisons</p>
              <p className="text-2xl font-bold app-text">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="app-surface p-6">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-[color-mix(in_srgb,var(--app-success)_12%,var(--app-surface))]">
              <CheckCircle className="h-6 w-6 app-text-success" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium app-text-muted">Taux de réussite</p>
              <p className="text-2xl font-bold app-text-success">{getCompletionRate()}%</p>
            </div>
          </div>
        </div>

        <div className="app-surface p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium app-text-muted">Revenus générés</p>
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(stats.totalRevenue)}</p>
            </div>
          </div>
        </div>

        <div className="app-surface p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium app-text-muted">Temps moyen</p>
              <p className="text-2xl font-bold text-orange-600">{stats.averageDeliveryTime} min</p>
            </div>
          </div>
        </div>
      </div>

      {/* Répartition par statut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="app-surface p-6">
          <h3 className="text-lg font-medium app-text mb-4">Répartition par statut</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                <span className="text-sm app-text-muted">Terminées</span>
              </div>
              <span className="text-sm font-medium app-text">{stats.completed}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Truck className="h-5 w-5 app-text-link mr-2" />
                <span className="text-sm app-text-muted">En cours</span>
              </div>
              <span className="text-sm font-medium app-text">{stats.inProgress}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-yellow-500 mr-2" />
                <span className="text-sm app-text-muted">En attente</span>
              </div>
              <span className="text-sm font-medium app-text">{stats.pending}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <XCircle className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-sm app-text-muted">Annulées</span>
              </div>
              <span className="text-sm font-medium app-text">{stats.cancelled}</span>
            </div>
          </div>
        </div>

        <div className="app-surface p-6">
          <h3 className="text-lg font-medium app-text mb-4">Graphique de répartition</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Terminées</span>
              <span>{getCompletionRate()}%</span>
            </div>
            <div className="w-full app-bg-muted rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full" 
                style={{ width: `${getCompletionRate()}%` }}
              ></div>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span>En cours</span>
              <span>{stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0}%</span>
            </div>
            <div className="w-full app-bg-muted rounded-full h-2">
              <div 
                className="h-2 rounded-full bg-[var(--app-primary)]" 
                style={{ width: `${stats.total > 0 ? (stats.inProgress / stats.total) * 100 : 0}%` }}
              ></div>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span>En attente</span>
              <span>{stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0}%</span>
            </div>
            <div className="w-full app-bg-muted rounded-full h-2">
              <div 
                className="bg-yellow-500 h-2 rounded-full" 
                style={{ width: `${stats.total > 0 ? (stats.pending / stats.total) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Détail des livraisons */}
      <div className="app-surface">
        <div className="px-6 py-4 border-b border app-divider">
          <h3 className="text-lg font-medium app-text">
            Détail des livraisons du {formatDateDisplay(selectedDate)}
          </h3>
        </div>
        
        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--app-primary)] mx-auto"></div>
            <p className="mt-2 app-text-muted">Chargement du rapport...</p>
          </div>
        ) : deliveries.length === 0 ? (
          <div className="p-6 text-center">
            <Truck className="h-12 w-12 app-text-muted mx-auto mb-4" />
            <p className="app-text-muted">Aucune livraison pour cette date</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="app-table-striped min-w-full divide-y divide-[var(--app-border)]">
              <thead className="app-bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium app-text-muted uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium app-text-muted uppercase tracking-wider">
                    Vente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium app-text-muted uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium app-text-muted uppercase tracking-wider">
                    Adresse
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium app-text-muted uppercase tracking-wider">
                    Montant
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-[var(--app-border)]">
                {deliveries.map((delivery) => (
                  <tr key={delivery.id} className="hover:bg-[var(--app-surface-muted)]">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium app-text">
                          {delivery.clients?.first_name} {delivery.clients?.last_name}
                        </div>
                        <div className="text-sm app-text-muted">
                          {delivery.clients?.phone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm app-text">
                        {delivery.sales?.description || 'Aucune vente associée'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(delivery.status)}
                        <span className={`ml-2 ${getStatusColor(delivery.status)}`}>
                          {getStatusText(delivery.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm app-text-muted">
                        <MapPin className="h-4 w-4 mr-1" />
                        {delivery.delivery_address || 'Non spécifiée'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm app-text">
                      {delivery.sales ? formatCurrency(delivery.sales.total_amount) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

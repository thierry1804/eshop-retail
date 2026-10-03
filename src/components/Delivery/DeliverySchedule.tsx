import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Delivery, User } from '../../types';
import { Calendar, Truck, MapPin, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDateToLocalString, formatDateDisplay } from '../../lib/dateUtils';

interface DeliveryScheduleProps {
  user: User;
}

export const DeliverySchedule: React.FC<DeliveryScheduleProps> = ({ user }) => {
  const { t } = useTranslation();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return formatDateToLocalString(today);
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
    } catch (error) {
      console.error('Erreur lors de la récupération des livraisons:', error);
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold app-text">{t('deliveries.deliverySchedule')}</h1>
          <p className="app-text-muted mt-1">Planification des livraisons par date</p>
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

      {/* Statistiques du jour */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="app-surface p-4">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-yellow-500" />
            <div className="ml-3">
              <p className="text-sm font-medium app-text-muted">En attente</p>
              <p className="text-2xl font-bold text-yellow-600">
                {deliveries.filter(d => d.status === 'pending').length}
              </p>
            </div>
          </div>
        </div>
        <div className="app-surface p-4">
          <div className="flex items-center">
            <Truck className="h-8 w-8 app-text-link" />
            <div className="ml-3">
              <p className="text-sm font-medium app-text-muted">En cours</p>
              <p className="text-2xl font-bold app-text-link">
                {deliveries.filter(d => d.status === 'in_progress').length}
              </p>
            </div>
          </div>
        </div>
        <div className="app-surface p-4">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div className="ml-3">
              <p className="text-sm font-medium app-text-muted">Terminées</p>
              <p className="text-2xl font-bold app-text-success">
                {deliveries.filter(d => d.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>
        <div className="app-surface p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 app-text-muted" />
            <div className="ml-3">
              <p className="text-sm font-medium app-text-muted">Total</p>
              <p className="text-2xl font-bold app-text-muted">{deliveries.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Liste des livraisons */}
      <div className="app-surface">
        <div className="px-6 py-4 border-b border app-divider">
          <h3 className="text-lg font-medium app-text">
            Livraisons du {formatDateDisplay(selectedDate)}
          </h3>
        </div>
        
        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--app-primary)] mx-auto"></div>
            <p className="mt-2 app-text-muted">Chargement des livraisons...</p>
          </div>
        ) : deliveries.length === 0 ? (
          <div className="p-6 text-center">
            <Truck className="h-12 w-12 app-text-muted mx-auto mb-4" />
            <p className="app-text-muted">Aucune livraison prévue pour cette date</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--app-border)]">
            {deliveries.map((delivery) => (
              <div key={delivery.id} className="p-6 hover:bg-[var(--app-surface-muted)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {getStatusIcon(delivery.status)}
                    <div>
                      <h4 className="text-lg font-medium app-text">
                        {delivery.clients?.first_name} {delivery.clients?.last_name}
                      </h4>
                      <p className="text-sm app-text-muted">
                        {delivery.clients?.phone}
                      </p>
                      {delivery.sales && (
                        <p className="text-sm app-text-muted mt-1">
                          Vente: {delivery.sales.description} - {formatCurrency(delivery.sales.total_amount)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className={`${getStatusColor(delivery.status)}`}>
                        {getStatusText(delivery.status)}
                      </div>
                      {delivery.delivery_address && (
                        <div className="flex items-center mt-2 text-sm app-text-muted">
                          <MapPin className="h-4 w-4 mr-1" />
                          {delivery.delivery_address}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

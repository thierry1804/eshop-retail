import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Delivery, Client, Sale, User } from '../../types';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Edit, Save, X, Truck, MapPin, Clock, User as UserIcon, Package, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { Offcanvas, OffcanvasHeader, OffcanvasBody } from '../ui/Offcanvas';
import { formatDateDisplay } from '../../lib/dateUtils';

interface DeliveryDetailsProps {
  deliveryId: string;
  onClose: () => void;
  onSave: () => void;
  user: User;
}

export const DeliveryDetails: React.FC<DeliveryDetailsProps> = ({ deliveryId, onClose, onSave, user }) => {
  const { t } = useTranslation();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [formData, setFormData] = useState({
    delivery_date: '',
    delivery_method: '',
    delivery_type: '',
    delivery_address: '',
    delivery_notes: '',
    delivery_fee: 0,
    status: '',
    tracking_number: '',
    driver_name: '',
    driver_phone: '',
    vehicle_info: ''
  });

  useEffect(() => {
    fetchDeliveryDetails();
  }, [deliveryId]);

  const fetchDeliveryDetails = async () => {
    try {
      setLoading(true);
      
      // Récupérer la livraison
      const { data: deliveryData, error: deliveryError } = await supabase
        .from('deliveries')
        .select('*')
        .eq('id', deliveryId)
        .single();

      if (deliveryError) throw deliveryError;

      setDelivery(deliveryData);

      // Récupérer le client
      if (deliveryData.client_id) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('*')
          .eq('id', deliveryData.client_id)
          .single();
        setClient(clientData);
      }

      // Récupérer la vente
      if (deliveryData.sale_id) {
        const { data: saleData } = await supabase
          .from('sales')
          .select('*')
          .eq('id', deliveryData.sale_id)
          .single();
        setSale(saleData);
      }

      // Initialiser le formulaire
      setFormData({
        delivery_date: deliveryData.delivery_date ? new Date(deliveryData.delivery_date).toISOString().split('T')[0] : '',
        delivery_method: deliveryData.delivery_method || '',
        delivery_type: deliveryData.delivery_type || '',
        delivery_address: deliveryData.delivery_address || '',
        delivery_notes: deliveryData.delivery_notes || '',
        delivery_fee: deliveryData.delivery_fee || 0,
        status: deliveryData.status || '',
        tracking_number: deliveryData.tracking_number || '',
        driver_name: deliveryData.driver_name || '',
        driver_phone: deliveryData.driver_phone || '',
        vehicle_info: deliveryData.vehicle_info || ''
      });

    } catch (error) {
      console.error('Erreur lors du chargement des détails:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Vérification de sécurité : empêcher la modification des livraisons livrées
    if (delivery && delivery.status === 'delivered') {
      alert('Impossible de modifier une livraison qui a été livrée.');
      setEditing(false);
      return;
    }

    try {
      setSaving(true);
      
      const updateData = {
        ...formData,
        delivery_date: new Date(formData.delivery_date).toISOString(),
        updated_by: user.id,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('deliveries')
        .update(updateData)
        .eq('id', deliveryId);

      if (error) throw error;

      setEditing(false);
      onSave();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateDeliveryStatus = async (newStatus: string) => {
    try {
      setUpdatingStatus(true);

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

      // Rafraîchir les données
      await fetchDeliveryDetails();
      onSave();
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      alert('Erreur lors de la mise à jour du statut de la livraison');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleStatusChange = (newStatus: string, statusText: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir marquer cette livraison comme "${statusText}" ?`)) {
      updateDeliveryStatus(newStatus);
    }
  };

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
      <Offcanvas onClose={onClose} width="lg">
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--app-primary)]"></div>
        </div>
      </Offcanvas>
    );
  }

  if (!delivery) {
    return (
      <Offcanvas onClose={onClose} width="lg">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <p className="app-text-muted">Livraison non trouvée</p>
          <button
            onClick={onClose}
            className="app-btn app-btn-primary mt-4"
          >
            Fermer
          </button>
        </div>
      </Offcanvas>
    );
  }

  return (
    <Offcanvas onClose={onClose} width="lg">
        <OffcanvasHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={onClose}
              className="app-icon-btn flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-semibold app-text truncate">
                {t('deliveries.details.title')} - {delivery.delivery_number}
              </h2>
              <span className={`mt-1 ${getStatusColor(delivery.status)}`}>
                {getStatusText(delivery.status)}
              </span>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="app-btn app-btn-secondary"
                >
                  <X className="h-4 w-4" />
                  {t('app.cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="app-btn app-btn-success"
                >
                  <Save className="h-4 w-4" />
                  {saving ? t('app.saving') : t('app.save')}
                </button>
              </>
            ) : (
                <>
                  {/* Actions rapides de statut */}
                  {delivery && delivery.status !== 'delivered' && delivery.status !== 'failed' && delivery.status !== 'cancelled' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStatusChange('delivered', 'Livrée')}
                        disabled={updatingStatus}
                        className="app-btn app-btn-sm app-btn-success disabled:opacity-50"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Marquer comme livrée
                      </button>
                      <button
                        onClick={() => handleStatusChange('failed', 'Échouée')}
                        disabled={updatingStatus}
                        className="app-btn app-btn-sm app-btn-danger disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Marquer comme échouée
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (delivery && delivery.status === 'delivered') {
                        alert('Impossible de modifier une livraison qui a été livrée.');
                        return;
                      }
                      setEditing(true);
                    }}
                    disabled={delivery.status === 'delivered'}
                    className={`app-btn ${delivery.status === 'delivered'
                        ? 'app-btn-secondary opacity-50 cursor-not-allowed'
                        : 'app-btn-primary'
                      }`}
                    title={delivery.status === 'delivered' ? 'Impossible de modifier une livraison livrée' : 'Modifier la livraison'}
                  >
                    <Edit className="h-4 w-4" />
                    {t('app.edit')}
                  </button>
                </>
            )}
          </div>
        </div>
        </OffcanvasHeader>

        <OffcanvasBody>
        {/* Message d'information pour les livraisons livrées */}
        {delivery && delivery.status === 'delivered' && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 app-text-success" />
              <p className="app-text-success text-sm">
                Cette livraison a été marquée comme livrée le {delivery.delivered_at ? formatDateDisplay(delivery.delivered_at) : 'N/A'}.
                Elle ne peut plus être modifiée.
              </p>
            </div>
          </div>
        )}

        {/* Contenu */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Informations générales */}
          <div className="space-y-6">
            <div className="app-bg-muted p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Truck className="h-5 w-5" />
                {t('deliveries.details.generalInfo')}
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="app-label">{t('deliveries.deliveryDate')}</label>
                  {editing ? (
                    <input
                      type="date"
                      value={formData.delivery_date}
                      onChange={(e) => setFormData({...formData, delivery_date: e.target.value})}
                      className="mt-1 block w-full app-input"
                    />
                  ) : (
                    <p className="mt-1 text-sm app-text">
                      {formatDateDisplay(delivery.delivery_date)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="app-label">{t('deliveries.deliveryMethod')}</label>
                  {editing ? (
                    <select
                      value={formData.delivery_method}
                      onChange={(e) => setFormData({...formData, delivery_method: e.target.value})}
                      className="mt-1 block w-full app-input"
                    >
                      <option value="home_delivery">{t('deliveries.methods.home_delivery')}</option>
                      <option value="pickup">{t('deliveries.methods.pickup')}</option>
                      <option value="express">{t('deliveries.methods.express')}</option>
                      <option value="standard">{t('deliveries.methods.standard')}</option>
                    </select>
                  ) : (
                    <p className="mt-1 text-sm app-text">
                      {delivery.delivery_method ? t(`deliveries.methods.${delivery.delivery_method}`) || delivery.delivery_method : '-'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="app-label">{t('deliveries.deliveryType')}</label>
                  {editing ? (
                    <select
                      value={formData.delivery_type}
                      onChange={(e) => setFormData({...formData, delivery_type: e.target.value})}
                      className="mt-1 block w-full app-input"
                    >
                      <option value="delivery">{t('deliveries.types.delivery')}</option>
                    </select>
                  ) : (
                    <p className="mt-1 text-sm app-text">
                      {delivery.delivery_type ? t(`deliveries.types.${delivery.delivery_type}`) || delivery.delivery_type : '-'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="app-label">{t('deliveries.deliveryFee')}</label>
                  {editing ? (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.delivery_fee}
                      onChange={(e) => setFormData({...formData, delivery_fee: parseFloat(e.target.value) || 0})}
                      onFocus={(e) => e.target.select()}
                      className="mt-1 block w-full app-input"
                    />
                  ) : (
                    <p className="mt-1 text-sm app-text">{delivery.delivery_fee ? `${delivery.delivery_fee} €` : '-'}</p>
                  )}
                </div>

                <div>
                  <label className="app-label">{t('deliveries.statusLabel')}</label>
                  {editing ? (
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="mt-1 block w-full app-input"
                    >
                      <option value="pending">{t('deliveries.status.pending')}</option>
                      <option value="preparing">{t('deliveries.status.preparing')}</option>
                      <option value="in_transit">{t('deliveries.status.in_transit')}</option>
                      <option value="delivered">{t('deliveries.status.delivered')}</option>
                      <option value="failed">{t('deliveries.status.failed')}</option>
                      <option value="cancelled">{t('deliveries.status.cancelled')}</option>
                    </select>
                  ) : (
                    <span className={`${getStatusColor(delivery.status)}`}>
                      {getStatusText(delivery.status)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Informations client */}
            {client && (
              <div className="app-bg-muted p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <UserIcon className="h-5 w-5" />
                  {t('deliveries.details.clientInfo')}
                </h3>
                <div className="space-y-2">
                  <p><strong>{t('common.name')}:</strong> {client.first_name} {client.last_name}</p>
                  <p><strong>{t('common.phone')}:</strong> {client.phone}</p>
                  <p><strong>{t('common.address')}:</strong> {client.address}</p>
                </div>
              </div>
            )}
          </div>

          {/* Informations de livraison */}
          <div className="space-y-6">
            <div className="app-bg-muted p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {t('deliveries.details.deliveryInfo')}
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="app-label">{t('deliveries.deliveryAddress')}</label>
                  {editing ? (
                    <textarea
                      value={formData.delivery_address}
                      onChange={(e) => setFormData({...formData, delivery_address: e.target.value})}
                      className="mt-1 block w-full app-input"
                      rows={3}
                    />
                  ) : (
                    <p className="mt-1 text-sm app-text">{delivery.delivery_address || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="app-label">{t('deliveries.deliveryNotes')}</label>
                  {editing ? (
                    <textarea
                      value={formData.delivery_notes}
                      onChange={(e) => setFormData({...formData, delivery_notes: e.target.value})}
                      className="mt-1 block w-full app-input"
                      rows={3}
                    />
                  ) : (
                    <p className="mt-1 text-sm app-text">{delivery.delivery_notes || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="app-label">{t('deliveries.trackingNumber')}</label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.tracking_number}
                      onChange={(e) => setFormData({...formData, tracking_number: e.target.value})}
                      className="mt-1 block w-full app-input"
                    />
                  ) : (
                    <p className="mt-1 text-sm app-text">{delivery.tracking_number || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="app-label">{t('deliveries.driverName')}</label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.driver_name}
                      onChange={(e) => setFormData({...formData, driver_name: e.target.value})}
                      className="mt-1 block w-full app-input"
                    />
                  ) : (
                    <p className="mt-1 text-sm app-text">{delivery.driver_name || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="app-label">{t('deliveries.driverPhone')}</label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.driver_phone}
                      onChange={(e) => setFormData({...formData, driver_phone: e.target.value})}
                      className="mt-1 block w-full app-input"
                    />
                  ) : (
                    <p className="mt-1 text-sm app-text">{delivery.driver_phone || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="app-label">{t('deliveries.vehicleInfo')}</label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.vehicle_info}
                      onChange={(e) => setFormData({...formData, vehicle_info: e.target.value})}
                      className="mt-1 block w-full app-input"
                    />
                  ) : (
                    <p className="mt-1 text-sm app-text">{delivery.vehicle_info || '-'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Informations de vente */}
            {sale && (
              <div className="app-bg-muted p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  {t('deliveries.details.saleInfo')}
                </h3>
                <div className="space-y-2">
                  <p><strong>{t('common.description')}:</strong> {sale.description}</p>
                  <p><strong>{t('sales.amounts.total')}:</strong> {sale.total_amount.toLocaleString()} MGA</p>
                  <p><strong>{t('sales.saleStatus')}:</strong> {t(`sales.status.${sale.status}`) || sale.status}</p>
                </div>
              </div>
            )}
          </div>
        </div>
        </OffcanvasBody>
    </Offcanvas>
  );
};

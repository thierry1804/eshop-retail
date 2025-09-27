import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Delivery, Client, Sale, User } from '../../types';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Edit, Save, X, Truck, MapPin, Clock, User as UserIcon, Package, DollarSign } from 'lucide-react';

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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="text-center">
            <p className="text-gray-500">Livraison non trouvée</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* En-tête */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {t('deliveries.details.title')} - {delivery.delivery_number}
              </h2>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(delivery.status)}`}>
                {getStatusText(delivery.status)}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  {t('app.cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {saving ? t('app.saving') : t('app.save')}
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                {t('app.edit')}
              </button>
            )}
          </div>
        </div>

        {/* Contenu */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Informations générales */}
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Truck className="h-5 w-5" />
                {t('deliveries.details.generalInfo')}
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('deliveries.deliveryDate')}</label>
                  {editing ? (
                    <input
                      type="date"
                      value={formData.delivery_date}
                      onChange={(e) => setFormData({...formData, delivery_date: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  ) : (
                    <p className="mt-1 text-sm text-gray-900">
                      {delivery.delivery_date ? new Date(delivery.delivery_date).toLocaleDateString() : '-'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('deliveries.deliveryMethod')}</label>
                  {editing ? (
                    <select
                      value={formData.delivery_method}
                      onChange={(e) => setFormData({...formData, delivery_method: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="home_delivery">{t('deliveries.methods.home_delivery')}</option>
                      <option value="pickup">{t('deliveries.methods.pickup')}</option>
                      <option value="express">{t('deliveries.methods.express')}</option>
                      <option value="standard">{t('deliveries.methods.standard')}</option>
                    </select>
                  ) : (
                    <p className="mt-1 text-sm text-gray-900">{delivery.delivery_method || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('deliveries.deliveryType')}</label>
                  {editing ? (
                    <select
                      value={formData.delivery_type}
                      onChange={(e) => setFormData({...formData, delivery_type: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="delivery">{t('deliveries.types.delivery')}</option>
                    </select>
                  ) : (
                    <p className="mt-1 text-sm text-gray-900">{delivery.delivery_type || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('deliveries.deliveryFee')}</label>
                  {editing ? (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.delivery_fee}
                      onChange={(e) => setFormData({...formData, delivery_fee: parseFloat(e.target.value) || 0})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  ) : (
                    <p className="mt-1 text-sm text-gray-900">{delivery.delivery_fee ? `${delivery.delivery_fee} €` : '-'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('deliveries.status')}</label>
                  {editing ? (
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="pending">{t('deliveries.status.pending')}</option>
                      <option value="preparing">{t('deliveries.status.preparing')}</option>
                      <option value="in_transit">{t('deliveries.status.in_transit')}</option>
                      <option value="delivered">{t('deliveries.status.delivered')}</option>
                      <option value="failed">{t('deliveries.status.failed')}</option>
                      <option value="cancelled">{t('deliveries.status.cancelled')}</option>
                    </select>
                  ) : (
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(delivery.status)}`}>
                      {getStatusText(delivery.status)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Informations client */}
            {client && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <UserIcon className="h-5 w-5" />
                  {t('deliveries.details.clientInfo')}
                </h3>
                <div className="space-y-2">
                  <p><strong>{t('clients.name')}:</strong> {client.first_name} {client.last_name}</p>
                  <p><strong>{t('clients.phone')}:</strong> {client.phone}</p>
                  <p><strong>{t('clients.address')}:</strong> {client.address}</p>
                </div>
              </div>
            )}
          </div>

          {/* Informations de livraison */}
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {t('deliveries.details.deliveryInfo')}
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('deliveries.deliveryAddress')}</label>
                  {editing ? (
                    <textarea
                      value={formData.delivery_address}
                      onChange={(e) => setFormData({...formData, delivery_address: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      rows={3}
                    />
                  ) : (
                    <p className="mt-1 text-sm text-gray-900">{delivery.delivery_address || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('deliveries.deliveryNotes')}</label>
                  {editing ? (
                    <textarea
                      value={formData.delivery_notes}
                      onChange={(e) => setFormData({...formData, delivery_notes: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      rows={3}
                    />
                  ) : (
                    <p className="mt-1 text-sm text-gray-900">{delivery.delivery_notes || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('deliveries.trackingNumber')}</label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.tracking_number}
                      onChange={(e) => setFormData({...formData, tracking_number: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  ) : (
                    <p className="mt-1 text-sm text-gray-900">{delivery.tracking_number || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('deliveries.driverName')}</label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.driver_name}
                      onChange={(e) => setFormData({...formData, driver_name: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  ) : (
                    <p className="mt-1 text-sm text-gray-900">{delivery.driver_name || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('deliveries.driverPhone')}</label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.driver_phone}
                      onChange={(e) => setFormData({...formData, driver_phone: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  ) : (
                    <p className="mt-1 text-sm text-gray-900">{delivery.driver_phone || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('deliveries.vehicleInfo')}</label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.vehicle_info}
                      onChange={(e) => setFormData({...formData, vehicle_info: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  ) : (
                    <p className="mt-1 text-sm text-gray-900">{delivery.vehicle_info || '-'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Informations de vente */}
            {sale && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  {t('deliveries.details.saleInfo')}
                </h3>
                <div className="space-y-2">
                  <p><strong>{t('sales.description')}:</strong> {sale.description}</p>
                  <p><strong>{t('sales.totalAmount')}:</strong> {sale.total_amount} €</p>
                  <p><strong>{t('sales.status')}:</strong> {sale.status}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

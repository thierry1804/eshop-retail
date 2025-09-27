import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { User, Client } from '../../types';
import { useTranslation } from 'react-i18next';

interface DeliveryFormProps {
  onClose: () => void;
  onSave: () => void;
  user: User;
}

export const DeliveryForm: React.FC<DeliveryFormProps> = ({ onClose, onSave, user }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    client_id: '',
    delivery_date: new Date().toISOString().split('T')[0],
    delivery_method: 'home_delivery',
    delivery_address: '',
    delivery_notes: '',
    delivery_cost: 0,
    delivery_fee: 0
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('*').order('first_name');
    setClients(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await supabase.from('deliveries').insert({
        ...formData,
        status: 'pending',
        created_by: user.id
      });
      onSave();
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <h2 className="text-xl font-bold mb-4">{t('deliveries.newDelivery')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('deliveries.table.client')} *</label>
            <select
              required
              value={formData.client_id}
              onChange={(e) => setFormData({...formData, client_id: e.target.value})}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">{t('app.select')} {t('deliveries.table.client').toLowerCase()}</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.first_name} {client.last_name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('deliveries.deliveryDate')} *</label>
            <input
              type="date"
              required
              value={formData.delivery_date}
              onChange={(e) => setFormData({...formData, delivery_date: e.target.value})}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">{t('deliveries.deliveryMethod')}</label>
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
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">{t('deliveries.deliveryAddress')} *</label>
            <textarea
              required
              value={formData.delivery_address}
              onChange={(e) => setFormData({...formData, delivery_address: e.target.value})}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('deliveries.deliveryCost')}</label>
              <input
                type="number"
                value={formData.delivery_cost}
                onChange={(e) => setFormData({...formData, delivery_cost: parseFloat(e.target.value)})}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('deliveries.deliveryFee')}</label>
              <input
                type="number"
                value={formData.delivery_fee}
                onChange={(e) => setFormData({...formData, delivery_fee: parseFloat(e.target.value)})}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              {t('app.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? t('deliveries.saving') : t('app.add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

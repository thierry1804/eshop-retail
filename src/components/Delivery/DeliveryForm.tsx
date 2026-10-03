import React, { useState, useEffect } from 'react';
import { devLog } from '../../lib/devLog';
import { supabase } from '../../lib/supabase';
import { User, Client, Sale } from '../../types';
import { useTranslation } from 'react-i18next';
import { X, Truck } from 'lucide-react';
import { getAvailableSalesForClient } from '../../lib/deliveryUtils';
import { DatePickerWithSales } from '../Common/DatePickerWithSales';
import { Offcanvas, OffcanvasHeader, OffcanvasBody, OffcanvasFooter } from '../ui/Offcanvas';

interface DeliveryFormProps {
  onClose: () => void;
  onSave: () => void;
  user: User;
  prefillData?: {
    client_id?: string;
    sale_id?: string;
    delivery_date?: string;
    client_address?: string;
  };
}

export const DeliveryForm: React.FC<DeliveryFormProps> = ({ onClose, onSave, user, prefillData }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    client_id: '',
    sale_id: '',
    delivery_date: new Date().toISOString().split('T')[0],
    delivery_method: 'home_delivery',
    delivery_type: 'delivery',
    delivery_address: '',
    delivery_notes: '',
    delivery_fee: 0
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    // Pré-remplir le formulaire avec les données fournies
    if (prefillData) {
      setFormData(prev => ({
        ...prev,
        client_id: prefillData.client_id || prev.client_id,
        sale_id: prefillData.sale_id || prev.sale_id,
        delivery_date: prefillData.delivery_date || prev.delivery_date,
        delivery_address: prefillData.client_address || prev.delivery_address
      }));

      // Si un client est pré-rempli, charger ses ventes
      if (prefillData.client_id) {
        fetchSalesForClient(prefillData.client_id);
      }
    }
  }, [prefillData]);

  // Effet pour s'assurer que la vente est sélectionnée une fois les ventes chargées
  useEffect(() => {
    if (prefillData?.sale_id && sales.length > 0) {
      // Vérifier que la vente pré-remplie est bien dans la liste des ventes disponibles
      const saleExists = sales.some(sale => sale.id === prefillData.sale_id);
      if (saleExists && formData.sale_id !== prefillData.sale_id) {
        setFormData(prev => ({
          ...prev,
          sale_id: prefillData.sale_id
        }));
      }
    }
  }, [sales, prefillData, formData.sale_id]);

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('*').order('first_name');
    setClients(data || []);
  };

  const fetchSalesForClient = async (clientId: string) => {
    if (!clientId) {
      setSales([]);
      return;
    }

    try {
      const availableSales = await getAvailableSalesForClient(clientId);
      devLog(`Ventes disponibles pour le client: ${availableSales.length}`);
      setSales(availableSales);
    } catch (error) {
      console.error('Erreur lors du filtrage des ventes:', error);
      setSales([]);
    }
  };

  const handleClientChange = (clientId: string) => {
    const selectedClient = clients.find(client => client.id === clientId);
    setFormData({
      ...formData,
      client_id: clientId,
      sale_id: '', // Réinitialiser la vente sélectionnée
      delivery_address: selectedClient?.address || ''
    });
    // Récupérer les ventes du client sélectionné
    fetchSalesForClient(clientId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Ne pas inclure delivery_number - il sera généré automatiquement par le trigger
      const deliveryData = {
        client_id: formData.client_id,
        sale_id: formData.sale_id || null,
        delivery_date: new Date(formData.delivery_date).toISOString(),
        delivery_method: formData.delivery_method,
        delivery_type: formData.delivery_type,
        delivery_address: formData.delivery_address,
        delivery_notes: formData.delivery_notes || null,
        delivery_cost: 0,
        delivery_fee: formData.delivery_fee,
        status: 'pending',
        created_by: user.id
      };

      devLog('Données à insérer:', deliveryData);

      const { data, error } = await supabase
        .from('deliveries')
        .insert(deliveryData)
        .select();

      if (error) {
        console.error('Erreur détaillée:', error);
        throw error;
      }

      devLog('Livraison créée avec succès:', data);
      onSave();
    } catch (error) {
      console.error('Erreur lors de la création de la livraison:', error);
      alert('Erreur lors de la création de la livraison. Vérifiez la console pour plus de détails.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Offcanvas onClose={onClose} width="lg" ariaLabel={t('deliveries.newDelivery')}>
      <OffcanvasHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Truck className="app-text-link flex-shrink-0 h-5 w-5" />
            <h2 className="app-page-title truncate">{t('deliveries.newDelivery')}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="app-icon-btn flex-shrink-0"
            aria-label={t('app.cancel')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </OffcanvasHeader>

      <form id="delivery-form" onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <OffcanvasBody className="space-y-6">
            <div>
              <label className="app-label">
                {t('deliveries.table.client')} *
              </label>
              <select
                required
                value={formData.client_id}
                onChange={(e) => handleClientChange(e.target.value)}
                className="app-input"
              >
                <option value="">{t('app.select')} {t('deliveries.table.client').toLowerCase()}</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.first_name} {client.last_name}
                  </option>
                ))}
              </select>
            </div>

            {formData.client_id && (
              <div>
                <label className="app-label">
                  {t('deliveries.associatedSale')}
                  <span className="text-xs app-text-muted ml-2">
                    ({t('deliveries.availableSales')})
                  </span>
                </label>
                <select
                  value={formData.sale_id}
                  onChange={(e) => setFormData({ ...formData, sale_id: e.target.value })}
                  className="app-input"
                >
                  <option value="">{t('deliveries.selectSale')}</option>
                  {sales.length > 0 ? (
                    sales.map(sale => (
                      <option key={sale.id} value={sale.id}>
                        {sale.description} - {new Intl.NumberFormat('fr-FR', {
                          style: 'currency',
                          currency: 'MGA',
                        }).format(sale.total_amount)} ({sale.status === 'paid' ? 'Payée' : 'En cours'})
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>
                      {t('deliveries.noAvailableSales')}
                    </option>
                  )}
                </select>
                {sales.length > 0 && (
                  <p className="text-xs text-green-600 mt-1">
                    {sales.length} vente{sales.length > 1 ? 's' : ''} disponible{sales.length > 1 ? 's' : ''} pour la livraison
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="app-label">
                {t('deliveries.deliveryDate')} *
              </label>
              <DatePickerWithSales
                value={formData.delivery_date}
                onChange={(date) => setFormData({ ...formData, delivery_date: date })}
                salesByDate={{}} // Pas de données de ventes pour le formulaire de livraison
                placeholder={t('deliveries.deliveryDate')}
                className="w-full"
              />
            </div>

            <div>
              <label className="app-label">
                {t('deliveries.deliveryMethod')}
              </label>
              <select
                value={formData.delivery_method}
                onChange={(e) => setFormData({ ...formData, delivery_method: e.target.value })}
                className="app-input"
              >
                <option value="home_delivery">{t('deliveries.methods.home_delivery')}</option>
                <option value="pickup">{t('deliveries.methods.pickup')}</option>
                <option value="express">{t('deliveries.methods.express')}</option>
                <option value="standard">{t('deliveries.methods.standard')}</option>
              </select>
            </div>

            <div className="hidden">
              <label className="app-label">
                {t('deliveries.deliveryType')}
              </label>
              <select
                value={formData.delivery_type}
                onChange={(e) => setFormData({ ...formData, delivery_type: e.target.value })}
                className="app-input"
              >
                <option value="delivery">{t('deliveries.types.delivery')}</option>
              </select>
            </div>

            <div>
              <label className="app-label">
                {t('deliveries.deliveryAddress')} *
              </label>
              <textarea
                required
                value={formData.delivery_address}
                onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                className="app-input"
                rows={3}
                placeholder={t('deliveries.addressPlaceholder')}
              />
            </div>

            <div>
              <label className="app-label">
                {t('deliveries.deliveryFee')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.delivery_fee}
                onChange={(e) => setFormData({ ...formData, delivery_fee: parseFloat(e.target.value) || 0 })}
                onFocus={(e) => e.target.select()}
                className="app-input"
              />
            </div>

            <div>
              <label className="app-label">
                {t('deliveries.deliveryNotes')}
              </label>
              <textarea
                value={formData.delivery_notes}
                onChange={(e) => setFormData({ ...formData, delivery_notes: e.target.value })}
                className="app-input"
                rows={3}
                placeholder={t('deliveries.notesPlaceholder')}
              />
            </div>
        </OffcanvasBody>

        <OffcanvasFooter>
          <div className="app-actions w-full">
            <button
              type="button"
              onClick={onClose}
              className="app-btn app-btn-secondary flex-1"
            >
              {t('app.cancel')}
            </button>
            <button
              type="submit"
              form="delivery-form"
              disabled={loading}
              className="app-btn app-btn-primary flex-1"
            >
              {loading ? t('deliveries.saving') : t('app.add')}
            </button>
          </div>
        </OffcanvasFooter>
      </form>
    </Offcanvas>
  );
};

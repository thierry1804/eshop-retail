import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { TrackingNumber, PurchaseOrder, User } from '../../types';
import { useTranslation } from 'react-i18next';
import { X, Calculator, Ruler, Weight, DollarSign } from 'lucide-react';
import { Offcanvas, OffcanvasHeader, OffcanvasBody, OffcanvasFooter } from '../ui/Offcanvas';

interface TrackingNumberFormProps {
  trackingNumber?: TrackingNumber | null;
  onClose: () => void;
  onSave: () => void;
  user: User;
}

export const TrackingNumberForm: React.FC<TrackingNumberFormProps> = ({
  trackingNumber,
  onClose,
  onSave,
  user
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    purchase_order_id: trackingNumber?.purchase_order_id || '',
    tracking_number: trackingNumber?.tracking_number || '',
    length: trackingNumber?.length?.toString() || '',
    width: trackingNumber?.width?.toString() || '',
    height: trackingNumber?.height?.toString() || '',
    weight_kg: trackingNumber?.weight_kg?.toString() || '',
    rate_per_m3: trackingNumber?.rate_per_m3?.toString() || '',
    rate_per_kg: trackingNumber?.rate_per_kg?.toString() || '',
    exchange_rate_mga: trackingNumber?.exchange_rate_mga?.toString() || '',
    status: trackingNumber?.status || 'pending',
    notes: trackingNumber?.notes || ''
  });
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    fetchPurchaseOrders();
  }, []);

  const fetchPurchaseOrders = async () => {
    try {
      setLoadingOrders(true);
      
      // En mode édition uniquement, on charge la commande associée
      if (trackingNumber) {
        const { data, error } = await supabase
          .from('purchase_orders')
          .select('id, order_number, supplier_name, tracking_number')
          .eq('id', trackingNumber.purchase_order_id)
          .single();
        
        if (error) throw error;
        if (data) setOrders([data]);
      } else {
        // Ne pas permettre la création manuelle
        setOrders([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des commandes:', error);
    } finally {
      setLoadingOrders(false);
    }
  };


  // Calculs automatiques
  const length = formData.length ? Number(formData.length) : 0;
  const width = formData.width ? Number(formData.width) : 0;
  const height = formData.height ? Number(formData.height) : 0;
  
  const volumeM3 = length && width && height
    ? (length * width * height) / 1000000
    : 0;

  const ratePerM3 = formData.rate_per_m3 ? Number(formData.rate_per_m3) : 0;
  const costByVolume = volumeM3 && ratePerM3
    ? volumeM3 * ratePerM3
    : 0;

  const weightKg = formData.weight_kg ? Number(formData.weight_kg) : 0;
  const ratePerKg = formData.rate_per_kg ? Number(formData.rate_per_kg) : 0;
  const costByWeight = weightKg && ratePerKg
    ? weightKg * ratePerKg
    : 0;

  const totalCostUSD = Math.max(costByVolume, costByWeight);

  const exchangeRate = formData.exchange_rate_mga ? Number(formData.exchange_rate_mga) : 0;
  const totalCostMGA = exchangeRate && totalCostUSD
    ? totalCostUSD * exchangeRate
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Ne permettre que l'édition, pas la création
    if (!trackingNumber) {
      alert(t('tracking.editOnly'));
      return;
    }

    setLoading(true);

    try {
      const data: any = {
        length: formData.length ? Number(formData.length) : null,
        width: formData.width ? Number(formData.width) : null,
        height: formData.height ? Number(formData.height) : null,
        weight_kg: formData.weight_kg ? Number(formData.weight_kg) : null,
        rate_per_m3: formData.rate_per_m3 ? Number(formData.rate_per_m3) : null,
        rate_per_kg: formData.rate_per_kg ? Number(formData.rate_per_kg) : null,
        exchange_rate_mga: formData.exchange_rate_mga ? Number(formData.exchange_rate_mga) : null,
        status: formData.status,
        notes: formData.notes || null,
        updated_by: user.id
      };

      const { error } = await supabase
        .from('tracking_numbers')
        .update(data)
        .eq('id', trackingNumber.id);
      
      if (error) throw error;

      onSave();
    } catch (error: any) {
      console.error('Erreur:', error);
      alert(error.message || t('tracking.saveError'));
    } finally {
      setLoading(false);
    }
  };

  if (loadingOrders) {
    return (
      <Offcanvas onClose={onClose} width="lg">
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--app-primary)]"></div>
        </div>
      </Offcanvas>
    );
  }

  return (
    <Offcanvas onClose={onClose} width="lg">
        <OffcanvasHeader>
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">
            {trackingNumber ? t('tracking.editTracking') : t('tracking.newTracking')}
          </h2>
          <button onClick={onClose} className="app-text-muted hover:text-[var(--app-ink-muted)]">
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>
        </OffcanvasHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <OffcanvasBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Commande d'achat (lecture seule) */}
            <div className="md:col-span-2">
              <label className="app-label">
                {t('tracking.purchaseOrder')}
              </label>
              <div className="app-input app-bg-muted">
                {trackingNumber?.purchase_order_number || '-'}
              </div>
            </div>

            {/* Tracking number (lecture seule) */}
            <div className="md:col-span-2">
              <label className="app-label">
                {t('tracking.trackingNumber')}
              </label>
              <div className="app-input app-bg-muted">
                {formData.tracking_number || '-'}
              </div>
            </div>

            {/* Dimensions */}
            <div>
              <label className="app-label flex items-center gap-2">
                <Ruler className="h-4 w-4" />
                {t('tracking.length')} (cm)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.length}
                onChange={(e) => setFormData({...formData, length: e.target.value})}
                onFocus={(e) => e.target.select()}
                className="app-input"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="app-label">
                {t('tracking.width')} (cm)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.width}
                onChange={(e) => setFormData({...formData, width: e.target.value})}
                onFocus={(e) => e.target.select()}
                className="app-input"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="app-label">
                {t('tracking.height')} (cm)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.height}
                onChange={(e) => setFormData({...formData, height: e.target.value})}
                onFocus={(e) => e.target.select()}
                className="app-input"
                placeholder="0.00"
              />
            </div>

            {/* Volume calculé */}
            <div>
              <label className="app-label">
                {t('tracking.volume')} (m³)
              </label>
              <div className="app-input app-bg-muted">
                {volumeM3 > 0 ? volumeM3.toFixed(6) : '0.000000'} m³
              </div>
            </div>

            {/* Poids */}
            <div>
              <label className="app-label flex items-center gap-2">
                <Weight className="h-4 w-4" />
                {t('tracking.weight')} (kg)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.weight_kg}
                onChange={(e) => setFormData({...formData, weight_kg: e.target.value})}
                onFocus={(e) => e.target.select()}
                className="app-input"
                placeholder="0.00"
              />
            </div>

            {/* Tarifs */}
            <div>
              <label className="app-label flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                {t('tracking.ratePerM3')} (USD/m³)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.rate_per_m3}
                onChange={(e) => setFormData({...formData, rate_per_m3: e.target.value})}
                onFocus={(e) => e.target.select()}
                className="app-input"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="app-label">
                {t('tracking.ratePerKg')} (USD/kg)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.rate_per_kg}
                onChange={(e) => setFormData({...formData, rate_per_kg: e.target.value})}
                onFocus={(e) => e.target.select()}
                className="app-input"
                placeholder="0.00"
              />
            </div>

            {/* Taux de change */}
            <div>
              <label className="app-label">
                {t('tracking.exchangeRate')} (USD → MGA)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.exchange_rate_mga}
                onChange={(e) => setFormData({...formData, exchange_rate_mga: e.target.value})}
                onFocus={(e) => e.target.select()}
                className="app-input"
                placeholder="0.00"
              />
            </div>

            {/* Statut */}
            <div>
              <label className="app-label">
                {t('tracking.statusLabel')}
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                className="app-input"
              >
                <option value="pending">{t('tracking.status.pending')}</option>
                <option value="in_transit">{t('tracking.status.in_transit')}</option>
                <option value="arrived">{t('tracking.status.arrived')}</option>
                <option value="received">{t('tracking.status.received')}</option>
              </select>
            </div>

            {/* Résultats calculés */}
            <div className="md:col-span-2 app-badge-info p-4 rounded-lg">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                {t('tracking.calculatedCosts')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm app-text-muted">{t('tracking.costByVolume')}</div>
                  <div className="text-lg font-bold text-green-600">
                    ${costByVolume.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm app-text-muted">{t('tracking.costByWeight')}</div>
                  <div className="text-lg font-bold text-green-600">
                    ${costByWeight.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm app-text-muted">{t('tracking.totalCostUSD')}</div>
                  <div className="text-xl font-bold text-green-600">
                    ${totalCostUSD.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm app-text-muted">{t('tracking.totalCostMGA')}</div>
                  <div className="text-xl font-bold app-text-link">
                    {totalCostMGA.toLocaleString('fr-FR')} MGA
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="app-label">
                {t('tracking.notes')}
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="app-input"
                rows={3}
                placeholder={t('tracking.notesPlaceholder')}
              />
            </div>
          </div>
        </OffcanvasBody>
        <OffcanvasFooter>
          <div className="app-actions">
            <button
              type="button"
              onClick={onClose}
              className="app-btn app-btn-secondary"
            >
              {t('app.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || !trackingNumber}
              className="app-btn app-btn-primary"
            >
              {loading ? t('app.saving') : t('app.save')}
            </button>
          </div>
        </OffcanvasFooter>
        </form>
    </Offcanvas>
  );
};


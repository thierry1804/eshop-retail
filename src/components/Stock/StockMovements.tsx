import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Product, StockMovement, User } from '../../types';
import { Plus, TrendingUp, TrendingDown, Package, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Offcanvas, OffcanvasHeader, OffcanvasBody, OffcanvasFooter } from '../ui/Offcanvas';
import { formatDateDisplay } from '../../lib/dateUtils';

interface StockMovementsProps {
  product: Product;
  user: User;
  onMovementsChange: () => void;
}

export const StockMovements: React.FC<StockMovementsProps> = ({ product, user, onMovementsChange }) => {
  const { t } = useTranslation();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchMovements();
  }, [product.id]);

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMovements(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des mouvements:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMovementTypeLabel = (type: string) => {
    return t(`stock.movements.types.${type}`);
  };

  const getMovementIcon = (type: string) => {
    return type === 'in' ? (
      <TrendingUp className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
    ) : (
      <TrendingDown className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
    );
  };

  const formatSignedQty = (movement: StockMovement) => {
    const sign =
      movement.movement_type === 'in' ||
      (movement.movement_type === 'adjustment' && movement.quantity > 0)
        ? '+'
        : '-';
    const qty =
      movement.movement_type === 'adjustment'
        ? Math.abs(movement.quantity)
        : movement.quantity;
    return `${sign}${qty} ${product.unit}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-3">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--app-primary)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center gap-2">
        <h3 className="text-sm font-semibold flex items-center app-text">
          <Package className="h-4 w-4 mr-1.5" />
          {t('stock.movements.title')}
        </h3>
        <button
          onClick={() => setShowForm(true)}
          className="app-btn app-btn-primary text-xs py-1 px-2.5"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('stock.movements.addMovement')}
        </button>
      </div>

      {movements.length === 0 ? (
        <div className="text-center py-4 app-text-muted text-xs">
          <Package className="h-8 w-8 mx-auto mb-1 app-text-muted opacity-60" />
          <p>Aucun mouvement enregistré</p>
        </div>
      ) : (
        <div className="border app-border rounded-md overflow-hidden divide-y divide-[var(--app-border)]">
          {movements.map((movement) => (
            <div
              key={movement.id}
              className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-[var(--app-surface)] hover:bg-[var(--app-surface-muted)]"
            >
              <div className="flex items-center gap-2 min-w-0">
                {getMovementIcon(movement.movement_type)}
                <span className="text-xs font-medium app-text whitespace-nowrap">
                  {getMovementTypeLabel(movement.movement_type)}
                </span>
                <span
                  className={`text-xs whitespace-nowrap ${
                    movement.movement_type === 'in' ||
                    (movement.movement_type === 'adjustment' && movement.quantity > 0)
                      ? 'text-green-700'
                      : 'text-red-600'
                  }`}
                >
                  {formatSignedQty(movement)}
                </span>
                {movement.reason && (
                  <span className="text-[11px] app-text-muted truncate">
                    {movement.reason}
                  </span>
                )}
              </div>
              <div className="text-[11px] app-text-muted whitespace-nowrap flex-shrink-0">
                {formatDateDisplay(movement.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <MovementForm
          product={product}
          onClose={() => setShowForm(false)}
          onSave={() => {
            fetchMovements();
            onMovementsChange();
            setShowForm(false);
          }}
          user={user}
        />
      )}
    </div>
  );
};

interface MovementFormProps {
  product: Product;
  onClose: () => void;
  onSave: () => void;
  user: User;
}

const MovementForm: React.FC<MovementFormProps> = ({ product, onClose, onSave, user }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    movement_type: 'in' as const,
    quantity: '',
    reason: '',
    reference_type: 'manual' as const,
    reference_id: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        product_id: product.id,
        movement_type: formData.movement_type,
        quantity: parseInt(formData.quantity),
        reason: formData.reason || null,
        reference_type: formData.reference_type,
        reference_id: formData.reference_id || null,
        notes: formData.notes || null,
        created_by: user.id
      };

      const { error } = await supabase
        .from('stock_movements')
        .insert(data);
      
      if (error) throw error;
      onSave();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du mouvement:', error);
      alert('Erreur lors de la sauvegarde du mouvement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Offcanvas onClose={onClose} width="md" panelZ={85} backdropZ={80}>
      <OffcanvasHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold app-text">
            {t('stock.movements.addMovement')}
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[var(--app-surface-muted)] app-text-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
      </OffcanvasHeader>
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <OffcanvasBody className="space-y-4">
          <div>
            <label className="app-label">
              {t('stock.movements.movementType')}
            </label>
            <select
              value={formData.movement_type}
              onChange={(e) => setFormData({...formData, movement_type: e.target.value as any})}
              className="mt-1 block w-full border app-border rounded-md px-3 py-2"
            >
              <option value="in">{t('stock.movements.types.in')}</option>
              <option value="out">{t('stock.movements.types.out')}</option>
            </select>
          </div>

          <div>
            <label className="app-label">
              {t('stock.movements.quantity')}
            </label>
            <input
              type="number"
              required
              min="1"
              value={formData.quantity}
              onChange={(e) => setFormData({...formData, quantity: e.target.value})}
              onFocus={(e) => e.target.select()}
              className="mt-1 block w-full border app-border rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="app-label">
              {t('stock.movements.reason')}
            </label>
            <input
              type="text"
              value={formData.reason}
              onChange={(e) => setFormData({...formData, reason: e.target.value})}
              className="mt-1 block w-full border app-border rounded-md px-3 py-2"
              placeholder="Raison du mouvement"
            />
          </div>

          <div>
            <label className="app-label">
              {t('stock.movements.notes')}
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="mt-1 block w-full border app-border rounded-md px-3 py-2"
              rows={3}
              placeholder="Notes supplémentaires"
            />
          </div>
        </OffcanvasBody>
        <OffcanvasFooter>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="app-btn app-btn-secondary"
            >
              {t('app.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="app-btn app-btn-primary disabled:opacity-50"
            >
              {loading ? t('app.saving') : t('app.save')}
            </button>
          </div>
        </OffcanvasFooter>
      </form>
    </Offcanvas>
  );
};

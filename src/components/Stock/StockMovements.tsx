import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Product, StockMovement, User } from '../../types';
import { Plus, TrendingUp, TrendingDown, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
      <TrendingUp className="h-5 w-5 text-green-600" />
    ) : (
      <TrendingDown className="h-5 w-5 text-red-600" />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center">
          <Package className="h-5 w-5 mr-2" />
          {t('stock.movements.title')}
        </h3>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 flex items-center gap-1 text-sm"
        >
          <Plus className="h-4 w-4" />
          {t('stock.movements.addMovement')}
        </button>
      </div>

      {movements.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Package className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p>Aucun mouvement enregistré</p>
        </div>
      ) : (
        <div className="space-y-3">
          {movements.map((movement) => (
            <div key={movement.id} className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  {getMovementIcon(movement.movement_type)}
                  <div>
                    <div className="font-medium">
                      {getMovementTypeLabel(movement.movement_type)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {movement.movement_type === 'in' ? '+' : '-'}{movement.quantity} {product.unit}
                    </div>
                    {movement.reason && (
                      <div className="text-sm text-gray-500 mt-1">
                        {movement.reason}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(movement.created_at).toLocaleDateString()}
                </div>
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-bold mb-4">
          {t('stock.movements.addMovement')}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('stock.movements.movementType')}
            </label>
            <select
              value={formData.movement_type}
              onChange={(e) => setFormData({...formData, movement_type: e.target.value as any})}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="in">{t('stock.movements.types.in')}</option>
              <option value="out">{t('stock.movements.types.out')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('stock.movements.quantity')}
            </label>
            <input
              type="number"
              required
              min="1"
              value={formData.quantity}
              onChange={(e) => setFormData({...formData, quantity: e.target.value})}
              onFocus={(e) => e.target.select()}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('stock.movements.reason')}
            </label>
            <input
              type="text"
              value={formData.reason}
              onChange={(e) => setFormData({...formData, reason: e.target.value})}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Raison du mouvement"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('stock.movements.notes')}
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              rows={3}
              placeholder="Notes supplémentaires"
            />
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
              {loading ? t('app.saving') : t('app.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

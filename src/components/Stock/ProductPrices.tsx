import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Product, ProductPrice, User } from '../../types';
import { Plus, Edit, Trash2, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ProductPricesProps {
  product: Product;
  user: User;
  onPricesChange: () => void;
}

export const ProductPrices: React.FC<ProductPricesProps> = ({ product, user, onPricesChange }) => {
  const { t } = useTranslation();
  const [prices, setPrices] = useState<ProductPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPrice, setEditingPrice] = useState<ProductPrice | null>(null);

  useEffect(() => {
    fetchPrices();
  }, [product.id]);

  const fetchPrices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('product_prices')
        .select('*')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPrices(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des prix:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePrice = async (priceId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce prix ?')) return;

    try {
      const { error } = await supabase
        .from('product_prices')
        .delete()
        .eq('id', priceId);

      if (error) throw error;
      fetchPrices();
      onPricesChange();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression du prix');
    }
  };

  const getPriceTypeLabel = (type: string) => {
    return t(`stock.prices.types.${type}`);
  };

  const formatPrice = (price: number, currency: string) => {
    return `${price.toLocaleString()} ${currency}`;
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
          <DollarSign className="h-5 w-5 mr-2" />
          {t('stock.prices.title')}
        </h3>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 flex items-center gap-1 text-sm"
        >
          <Plus className="h-4 w-4" />
          {t('stock.prices.addPrice')}
        </button>
      </div>

      {prices.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <DollarSign className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p>Aucun prix défini pour ce produit</p>
        </div>
      ) : (
        <div className="space-y-2">
          {prices.map((price) => (
            <div key={price.id} className="bg-gray-50 p-3 rounded-lg flex justify-between items-center">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{getPriceTypeLabel(price.price_type)}</span>
                  <span className="text-lg font-bold text-blue-600">
                    {formatPrice(price.price, price.currency)}
                  </span>
                  {price.is_active && (
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                      Actif
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  Valide du {new Date(price.valid_from).toLocaleDateString()}
                  {price.valid_to && ` au ${new Date(price.valid_to).toLocaleDateString()}`}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingPrice(price);
                    setShowForm(true);
                  }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeletePrice(price.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <PriceForm
          product={product}
          price={editingPrice}
          onClose={() => {
            setShowForm(false);
            setEditingPrice(null);
          }}
          onSave={() => {
            fetchPrices();
            onPricesChange();
            setShowForm(false);
            setEditingPrice(null);
          }}
          user={user}
        />
      )}
    </div>
  );
};

interface PriceFormProps {
  product: Product;
  price?: ProductPrice | null;
  onClose: () => void;
  onSave: () => void;
  user: User;
}

const PriceForm: React.FC<PriceFormProps> = ({ product, price, onClose, onSave, user }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    price_type: 'retail' as const,
    price: '',
    currency: 'MGA',
    valid_from: new Date().toISOString().split('T')[0],
    valid_to: '',
    is_active: true
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (price) {
      setFormData({
        price_type: price.price_type,
        price: price.price.toString(),
        currency: price.currency,
        valid_from: price.valid_from.split('T')[0],
        valid_to: price.valid_to ? price.valid_to.split('T')[0] : '',
        is_active: price.is_active
      });
    }
  }, [price]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        product_id: product.id,
        price_type: formData.price_type,
        price: parseFloat(formData.price),
        currency: formData.currency,
        valid_from: formData.valid_from,
        valid_to: formData.valid_to || null,
        is_active: formData.is_active,
        created_by: user.id
      };

      if (price) {
        const { error } = await supabase
          .from('product_prices')
          .update(data)
          .eq('id', price.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('product_prices')
          .insert(data);
        if (error) throw error;
      }
      onSave();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du prix:', error);
      alert('Erreur lors de la sauvegarde du prix');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-bold mb-4">
          {price ? t('stock.prices.editPrice') : t('stock.prices.addPrice')}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('stock.prices.priceType')}</label>
            <select
              value={formData.price_type}
              onChange={(e) => setFormData({...formData, price_type: e.target.value as any})}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="retail">{t('stock.prices.types.retail')}</option>
              <option value="wholesale">{t('stock.prices.types.wholesale')}</option>
              <option value="distributor">{t('stock.prices.types.distributor')}</option>
              <option value="reseller">{t('stock.prices.types.reseller')}</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('stock.prices.price')}</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.price}
                onChange={(e) => setFormData({...formData, price: e.target.value})}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('stock.prices.currency')}</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({...formData, currency: e.target.value})}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="MGA">MGA</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('stock.prices.validFrom')}</label>
              <input
                type="date"
                required
                value={formData.valid_from}
                onChange={(e) => setFormData({...formData, valid_from: e.target.value})}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('stock.prices.validTo')}</label>
              <input
                type="date"
                value={formData.valid_to}
                onChange={(e) => setFormData({...formData, valid_to: e.target.value})}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
              className="mr-2"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
              {t('stock.prices.isActive')}
            </label>
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

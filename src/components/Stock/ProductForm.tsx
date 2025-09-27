import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Product, User, Category, Supplier } from '../../types';
import { useTranslation } from 'react-i18next';
import { generateIncrementalSKU } from '../../lib/skuGenerator';

interface ProductFormProps {
  product?: Product | null;
  onClose: () => void;
  onSave: () => void;
  user: User;
}

export const ProductForm: React.FC<ProductFormProps> = ({ product, onClose, onSave, user }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    barcode: '',
    category_id: '',
    supplier_id: '',
    unit: 'pièce',
    weight: '',
    dimensions: '',
    min_stock_level: 0,
    max_stock_level: '',
    current_stock: 0,
    status: 'active' as const
  });
  const [isNewProduct, setIsNewProduct] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCategoriesAndSuppliers();
    if (product) {
      setIsNewProduct(false);
      setFormData({
        name: product.name,
        description: product.description || '',
        sku: product.sku,
        barcode: product.barcode || '',
        category_id: product.category_id || '',
        supplier_id: product.supplier_id || '',
        unit: product.unit,
        weight: product.weight?.toString() || '',
        dimensions: product.dimensions || '',
        min_stock_level: product.min_stock_level,
        max_stock_level: product.max_stock_level?.toString() || '',
        current_stock: product.current_stock,
        status: product.status
      });
    } else {
      setIsNewProduct(true);
      generateSKU();
    }
  }, [product]);

  // Regénérer le SKU quand le nom du produit change (pour les nouveaux produits)
  useEffect(() => {
    if (isNewProduct && formData.name.length >= 3) {
      // Délai pour éviter trop de requêtes
      const timeoutId = setTimeout(() => {
        generateSKU();
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [formData.name, isNewProduct]);

  const fetchCategoriesAndSuppliers = async () => {
    const [categoriesRes, suppliersRes] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('suppliers').select('*').order('name')
    ]);
    setCategories(categoriesRes.data || []);
    setSuppliers(suppliersRes.data || []);
  };

  const generateSKU = async () => {
    if (formData.name.length < 3) {
      alert('Le nom du produit doit contenir au moins 3 caractères');
      return;
    }

    try {
      const newSku = await generateIncrementalSKU(formData.name);
      setFormData(prev => ({ ...prev, sku: newSku }));
    } catch (error) {
      console.error('Erreur lors de la génération du SKU:', error);
      alert('Erreur lors de la génération du SKU');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Vérifier que l'utilisateur a un ID valide
      if (!user.id || user.id === '00000000-0000-0000-0000-000000000000') {
        throw new Error('Utilisateur non authentifié. Veuillez vous reconnecter.');
      }

      const data = {
        ...formData,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        max_stock_level: formData.max_stock_level ? parseInt(formData.max_stock_level) : null,
        created_by: user.id,
        updated_by: user.id
      };

      // Nettoyer les champs vides qui pourraient causer des erreurs UUID
      if (data.category_id === '') {
        data.category_id = null;
      }
      if (data.supplier_id === '') {
        data.supplier_id = null;
      }

      console.log('Données à sauvegarder:', data);

      if (product) {
        const { error } = await supabase.from('products').update(data).eq('id', product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').insert(data);
        if (error) throw error;
      }
      onSave();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert(`Erreur lors de la sauvegarde du produit: ${error.message || 'Erreur inconnue'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {product ? t('stock.editProduct') : t('stock.newProduct')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('stock.productName')} *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('stock.productSku')} *</label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={(e) => setFormData({...formData, sku: e.target.value})}
                className={`mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 ${
                  isNewProduct ? 'bg-gray-100' : ''
                }`}
                readOnly={isNewProduct}
                title={isNewProduct ? t('stock.form.skuAutoGenerated') : ''}
                placeholder={isNewProduct ? "ABC-250118-00001" : ""}
              />
              {isNewProduct && (
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {t('stock.form.skuFormat')}
                  </span>
                  <button
                    type="button"
                    onClick={generateSKU}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {t('stock.form.generateNewSku')}
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('common.description')}</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('stock.productCategory')}</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">{t('app.select')}</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('stock.productSupplier')}</label>
              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData({...formData, supplier_id: e.target.value})}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">{t('app.select')}</option>
                {suppliers.map(supp => (
                  <option key={supp.id} value={supp.id}>{supp.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('stock.productUnit')}</label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({...formData, unit: e.target.value})}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('stock.minStockLevel')}</label>
              <input
                type="number"
                value={formData.min_stock_level}
                onChange={(e) => setFormData({...formData, min_stock_level: parseInt(e.target.value)})}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('stock.maxStockLevel')}</label>
              <input
                type="number"
                value={formData.max_stock_level}
                onChange={(e) => setFormData({...formData, max_stock_level: e.target.value})}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('stock.currentStock')}</label>
              <input
                type="number"
                value={formData.current_stock}
                onChange={(e) => setFormData({...formData, current_stock: parseInt(e.target.value)})}
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
              {loading ? t('stock.saving') : t('app.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

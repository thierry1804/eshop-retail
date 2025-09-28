import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Product, User } from '../../types';
import { X, Package, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { generateIncrementalSKU } from '../../lib/skuGenerator';

interface ProductQuickCreateProps {
  onClose: () => void;
  onProductCreated: (product: Product) => void;
  user: User;
}

export const ProductQuickCreate: React.FC<ProductQuickCreateProps> = ({ onClose, onProductCreated, user }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    unit: 'pièce',
    min_stock_level: 0,
    barcode: '',
    category_id: '',
    supplier_id: ''
  });
  const [isGeneratingSku, setIsGeneratingSku] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  React.useEffect(() => {
    fetchCategoriesAndSuppliers();
  }, []);

  // Fonction pour générer le SKU automatiquement quand le nom change
  const handleNameChange = async (name: string) => {
    setFormData(prev => ({ ...prev, name }));
    
    if (name.length >= 3 && !formData.sku) {
      // Délai pour éviter trop de requêtes
      setTimeout(async () => {
        setIsGeneratingSku(true);
        try {
          const generatedSku = await generateIncrementalSKU(name);
          setFormData(prev => ({ ...prev, sku: generatedSku }));
        } catch (error) {
          console.error('Erreur lors de la génération du SKU:', error);
        } finally {
          setIsGeneratingSku(false);
        }
      }, 500);
    }
  };

  const fetchCategoriesAndSuppliers = async () => {
    try {
      const [categoriesRes, suppliersRes] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('suppliers').select('*').order('name')
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (suppliersRes.error) throw suppliersRes.error;

      setCategories(categoriesRes.data || []);
      setSuppliers(suppliersRes.data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Le nom du produit est requis');
      return;
    }

    setLoading(true);
    try {
      // Générer le SKU si pas fourni
      const sku = formData.sku || await generateIncrementalSKU(formData.name);

      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        sku: sku,
        unit: formData.unit,
        min_stock_level: formData.min_stock_level,
        current_stock: 0,
        reserved_stock: 0,
        // available_stock est une colonne générée, on ne l'inclut pas
        barcode: formData.barcode.trim() || null,
        category_id: formData.category_id || null,
        supplier_id: formData.supplier_id || null,
        status: 'active',
        created_by: user.id !== '00000000-0000-0000-0000-000000000000' ? user.id : null,
        updated_by: user.id !== '00000000-0000-0000-0000-000000000000' ? user.id : null
      };

      const { data, error } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single();

      if (error) throw error;

      onProductCreated(data);
    } catch (error: any) {
      console.error('Erreur lors de la création du produit:', error);
      let errorMessage = 'Erreur lors de la création du produit';
      
      if (error?.code === '23505') {
        errorMessage = 'Un produit avec ce SKU existe déjà';
      } else if (error?.code === '23503') {
        errorMessage = 'Catégorie ou fournisseur invalide';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-lg font-bold flex items-center">
            <Package className="h-5 w-5 mr-2" />
            {t('supply.createProduct')}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('supply.productName')} *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Nom du produit"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('supply.sku')}
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({...formData, sku: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="SKU (généré automatiquement)"
              />
              {isGeneratingSku && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t('supply.skuAutoGenerated')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('supply.description')}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={2}
              placeholder="Description du produit"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('supply.unit')}
              </label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({...formData, unit: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="pièce">Pièce</option>
                <option value="kg">Kilogramme</option>
                <option value="g">Gramme</option>
                <option value="L">Litre</option>
                <option value="mL">Millilitre</option>
                <option value="m">Mètre</option>
                <option value="cm">Centimètre</option>
                <option value="m²">Mètre carré</option>
                <option value="m³">Mètre cube</option>
                <option value="boîte">Boîte</option>
                <option value="paquet">Paquet</option>
                <option value="lot">Lot</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('supply.minStock')}
              </label>
              <input
                type="number"
                min="0"
                value={formData.min_stock_level}
                onChange={(e) => setFormData({...formData, min_stock_level: parseInt(e.target.value) || 0})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('supply.barcode')}
            </label>
            <input
              type="text"
              value={formData.barcode}
              onChange={(e) => setFormData({...formData, barcode: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Code-barres (optionnel)"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('supply.category')}
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">{t('supply.selectCategory')}</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('supply.supplier')}
              </label>
              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData({...formData, supplier_id: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">{t('supply.selectSupplier')}</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
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
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {loading ? t('app.creating') : t('supply.createProduct')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

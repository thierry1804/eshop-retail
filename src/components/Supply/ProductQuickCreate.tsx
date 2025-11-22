import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { Product, Category, User } from '../../types';
import { X, Package, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { generateIncrementalSKU } from '../../lib/skuGenerator';
import { SupplierQuickCreate } from './SupplierQuickCreate';
import { CategoryQuickCreate } from './CategoryQuickCreate';

interface ProductQuickCreateProps {
  onClose: () => void;
  onProductCreated: (product: Product) => void;
  user: User;
  initialSupplierId?: string;
}

export const ProductQuickCreate: React.FC<ProductQuickCreateProps> = ({ onClose, onProductCreated, user, initialSupplierId }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    unit: 'pièce',
    min_stock_level: 0,
    barcode: '',
    category_id: '',
    supplier_id: initialSupplierId || ''
  });
  const [isGeneratingSku, setIsGeneratingSku] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [showCategoryCreate, setShowCategoryCreate] = useState(false);
  const [showSupplierCreate, setShowSupplierCreate] = useState(false);

  React.useEffect(() => {
    fetchCategoriesAndSuppliers();
  }, []);

  // Mettre à jour supplier_id si initialSupplierId change
  React.useEffect(() => {
    if (initialSupplierId) {
      setFormData(prev => ({ ...prev, supplier_id: initialSupplierId }));
    }
  }, [initialSupplierId]);

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

      // Filtrer côté client pour les catégories/fournisseurs qui contiennent 'stock' dans leur tableau modules
      const filteredCategories = (categoriesRes.data || []).filter(cat => {
        const modules = cat.modules || [];
        return Array.isArray(modules) && modules.includes('stock');
      });
      
      const filteredSuppliers = (suppliersRes.data || []).filter(supplier => {
        const modules = supplier.modules || [];
        return Array.isArray(modules) && modules.includes('stock');
      });

      setCategories(filteredCategories);
      setSuppliers(filteredSuppliers);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    }
  };

  const handleCategoryCreated = (category: Category) => {
    setCategories([...categories, category]);
    setFormData({
      ...formData,
      category_id: category.id
    });
    setShowCategoryCreate(false);
  };

  const handleSupplierCreated = (supplier: any) => {
    setSuppliers([...suppliers, supplier]);
    setFormData({
      ...formData,
      supplier_id: supplier.id
    });
    setShowSupplierCreate(false);
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

      const productData: any = {
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
        .insert(productData as any)
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

  const overlayContent = (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[60] transition-opacity"
        style={{ top: 0, left: 0, right: 0, bottom: 0, margin: 0, padding: 0 }}
        onClick={onClose}
      />

      {/* Offcanvas */}
      <div 
        className="fixed top-0 right-0 bottom-0 w-full max-w-4xl bg-white shadow-xl z-[70] transform transition-transform duration-300 ease-in-out flex flex-col"
        style={{ top: 0, right: 0, margin: 0, padding: 0 }}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b bg-gray-50 flex-shrink-0">
          <h3 className="text-xl font-bold flex items-center">
            <Package className="h-6 w-6 mr-2 text-blue-600" />
            {t('supply.createProduct')}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} id="product-form" className="space-y-6">
            {/* Section: Informations de base */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b pb-2">
                Informations de base
              </h4>

              <div className="grid grid-cols-1 gap-4">
                {/* Nom et SKU sur la même ligne */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('supply.productName')} *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Nom du produit"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('supply.sku')}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.sku}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('supply.description')}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Description du produit"
                  />
                </div>
              </div>
            </div>

            {/* Section: Stock et unité */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b pb-2">
                Stock et unité
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('supply.unit')}
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('supply.minStock')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.min_stock_level}
                    onChange={(e) => setFormData({ ...formData, min_stock_level: parseInt(e.target.value) || 0 })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Section: Catégorisation */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b pb-2">
                Catégorisation
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('supply.category')}
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">{t('supply.selectCategory')}</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowCategoryCreate(true)}
                      className="bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 flex items-center gap-1 transition-colors"
                      title={t('supply.createCategory') || 'Créer une nouvelle catégorie'}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('supply.supplier')}
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.supplier_id}
                      onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">{t('supply.selectSupplier')}</option>
                      {suppliers.map(supplier => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowSupplierCreate(true)}
                      className="bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 flex items-center gap-1 transition-colors"
                      title={t('supply.createSupplier') || 'Créer un nouveau fournisseur'}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Autres informations */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b pb-2">
                Autres informations
              </h4>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('supply.barcode')}
                </label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Code-barres (optionnel)"
                />
              </div>
            </div>
          </form>
        </div>

        {/* Footer avec boutons */}
        <div className="border-t bg-white p-6 flex-shrink-0">
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t('app.cancel')}
            </button>
            <button
              type="submit"
              form="product-form"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {loading ? t('app.creating') : t('supply.createProduct')}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de création rapide de catégorie */}
      {showCategoryCreate && (
        <CategoryQuickCreate
          onClose={() => setShowCategoryCreate(false)}
          onCategoryCreated={handleCategoryCreated}
          user={user}
        />
      )}

      {/* Modal de création rapide de fournisseur */}
      {showSupplierCreate && (
        <SupplierQuickCreate
          onClose={() => setShowSupplierCreate(false)}
          onSupplierCreated={handleSupplierCreated}
          user={user}
        />
      )}
    </>
  );

  return createPortal(overlayContent, document.body);
};

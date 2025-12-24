import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { Product, User, Category, Supplier } from '../../types';
import { useTranslation } from 'react-i18next';
import { generateIncrementalSKU } from '../../lib/skuGenerator';
import { X, Package, Upload, Image as ImageIcon } from 'lucide-react';

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
    status: 'active' as 'active' | 'inactive' | 'discontinued'
  });
  const [isNewProduct, setIsNewProduct] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
      setCurrentImageUrl(product.image_url || null);
      setImagePreview(null);
      setImageFile(null);
    } else {
      setIsNewProduct(true);
      generateSKU();
      setCurrentImageUrl(null);
      setImagePreview(null);
      setImageFile(null);
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
    
    // Filtrer côté client pour les catégories/fournisseurs qui contiennent 'stock' dans leur tableau modules
    const filteredCategories = (categoriesRes.data || []).filter((cat: any) => {
      const modules = cat.modules || [];
      return Array.isArray(modules) && modules.includes('stock');
    });
    
    const filteredSuppliers = (suppliersRes.data || []).filter((supplier: any) => {
      const modules = supplier.modules || [];
      return Array.isArray(modules) && modules.includes('stock');
    });
    
    setCategories(filteredCategories);
    setSuppliers(filteredSuppliers);
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

  // Gestion de l'upload d'image
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Vérifier le type de fichier
      if (!file.type.startsWith('image/')) {
        alert('Veuillez sélectionner un fichier image');
        return;
      }

      // Vérifier la taille (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('L\'image ne doit pas dépasser 5MB');
        return;
      }

      setImageFile(file);

      // Créer un aperçu
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setCurrentImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return currentImageUrl; // Garder l'image existante si pas de nouveau fichier

    setUploadingImage(true);
    try {
      // Si on modifie un produit et qu'il y a déjà une image, on peut la supprimer
      // (optionnel, on peut aussi garder l'ancienne)

      // Générer un nom de fichier unique
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      // Upload vers Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, imageFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Erreur lors de l\'upload:', uploadError);
        if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
          throw new Error('Le bucket "product-images" n\'existe pas dans Supabase Storage. Veuillez le créer d\'abord. Consultez le fichier supabase/storage_setup.md pour les instructions.');
        }
        throw uploadError;
      }

      // Récupérer l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      console.error('Erreur lors de l\'upload de l\'image:', error);
      const errorMessage = error?.message || 'Erreur lors de l\'upload de l\'image. Veuillez réessayer.';
      alert(errorMessage);
      return null;
    } finally {
      setUploadingImage(false);
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

      // Upload de l'image si présente
      let imageUrl: string | null = currentImageUrl;
      if (imageFile) {
        const uploadedUrl = await uploadImage();
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        } else {
          setLoading(false);
          return; // L'utilisateur a été alerté dans uploadImage
        }
      }

      const data: any = {
        ...formData,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        max_stock_level: formData.max_stock_level ? parseInt(formData.max_stock_level) : null,
        image_url: imageUrl,
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
        // @ts-ignore - Types Supabase non générés pour la table products
        const { error } = await supabase.from('products').update(data).eq('id', product.id);
        if (error) throw error;
      } else {
        // @ts-ignore - Types Supabase non générés pour la table products
        const { error } = await supabase.from('products').insert(data);
        if (error) throw error;
      }
      onSave();
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert(`Erreur lors de la sauvegarde du produit: ${error.message || 'Erreur inconnue'}`);
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
        className="fixed top-0 right-0 bottom-0 w-full sm:max-w-lg md:max-w-2xl lg:max-w-4xl bg-white shadow-xl z-[70] transform transition-transform duration-300 ease-in-out flex flex-col"
        style={{ top: 0, right: 0, margin: 0, padding: 0 }}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-3 sm:p-4 md:p-6 border-b bg-gray-50 flex-shrink-0">
          <h3 className="text-base sm:text-lg md:text-xl font-bold flex items-center">
            <Package className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-blue-600" />
            <span className="truncate">{product ? t('stock.editProduct') : t('stock.newProduct')}</span>
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 ml-2"
          >
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <form onSubmit={handleSubmit} id="product-form" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('stock.productName')} *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('stock.productSku')} *</label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={(e) => setFormData({...formData, sku: e.target.value})}
                  className={`w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
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
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.description')}</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
          </div>

            {/* Upload d'image */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Photo du produit
              </label>
              <div className="space-y-3">
                {(imagePreview || currentImageUrl) ? (
                  <div className="relative">
                    <img
                      src={imagePreview || currentImageUrl || ''}
                      alt={formData.name || 'Aperçu'}
                      className="w-full h-48 object-cover rounded-md border border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full hover:bg-red-700 transition-colors"
                      title="Supprimer l'image"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    <ImageIcon className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600 mb-1">
                      Cliquez pour ajouter une photo
                    </p>
                    <p className="text-xs text-gray-400">
                      PNG, JPG jusqu'à 5MB
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                {!(imagePreview || currentImageUrl) && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 flex items-center justify-center gap-2 transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    Choisir une image
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('stock.productCategory')}</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">{t('app.select')}</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('stock.productSupplier')}</label>
              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData({...formData, supplier_id: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">{t('app.select')}</option>
                {suppliers.map(supp => (
                  <option key={supp.id} value={supp.id}>{supp.name}</option>
                ))}
              </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('stock.productUnit')}</label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({...formData, unit: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('stock.minStockLevel')}</label>
              <input
                type="number"
                value={formData.min_stock_level}
                  onChange={(e) => setFormData({ ...formData, min_stock_level: parseInt(e.target.value) || 0 })}
                  onFocus={(e) => e.target.select()}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('stock.maxStockLevel')}</label>
              <input
                type="number"
                value={formData.max_stock_level}
                onChange={(e) => setFormData({...formData, max_stock_level: e.target.value})}
                  onFocus={(e) => e.target.select()}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('stock.currentStock')}</label>
              <input
                type="number"
                value={formData.current_stock}
                  onChange={(e) => setFormData({ ...formData, current_stock: parseInt(e.target.value) || 0 })}
                  onFocus={(e) => e.target.select()}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Code-barres</label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Code-barres (optionnel)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Poids</label>
                <input
                  type="number"
                  step="0.001"
                  value={formData.weight}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Poids (optionnel)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Dimensions</label>
                <input
                  type="text"
                  value={formData.dimensions}
                  onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Dimensions (optionnel)"
              />
            </div>
          </div>

          </form>
        </div>

        {/* Footer avec boutons */}
        <div className="border-t bg-white p-3 sm:p-4 md:p-6 flex-shrink-0">
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 sm:px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors text-sm sm:text-base"
            >
              {t('app.cancel')}
            </button>
            <button
              type="submit"
              form="product-form"
              disabled={loading || uploadingImage}
              className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors text-sm sm:text-base"
            >
              {loading || uploadingImage ? (uploadingImage ? 'Upload de l\'image...' : t('stock.saving')) : t('app.save')}
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(overlayContent, document.body);
};

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { Product, Category, User } from '../../types';
import { X, Package, Plus, ChevronDown, ChevronUp, Upload, Image as ImageIcon } from 'lucide-react';
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
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const nameInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    fetchCategoriesAndSuppliers();
    // Focus automatique sur le champ nom
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 100);
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;

    setUploadingImage(true);
    try {
      // Générer un nom de fichier unique
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      // Upload vers Supabase Storage
      const { error: uploadError, data } = await supabase.storage
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

  // Raccourci clavier : Entrée pour créer
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter ou Cmd+Enter pour créer rapidement
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const form = document.getElementById('product-form') as HTMLFormElement;
        if (form && formData.name.trim()) {
          form.requestSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formData.name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Le nom du produit est requis');
      return;
    }
    if (!formData.description.trim()) {
      alert('La description du produit est requise');
      return;
    }
    if (!formData.category_id) {
      alert('La catégorie du produit est requise');
      return;
    }

    setLoading(true);
    try {
      // Upload de l'image si présente
      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadImage();
        if (!imageUrl) {
          setLoading(false);
          return; // L'utilisateur a été alerté dans uploadImage
        }
      }

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
        image_url: imageUrl,
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 p-4 sm:p-6 border-b bg-gray-50 flex-shrink-0">
          <h3 className="text-lg sm:text-xl font-bold flex items-center min-w-0 flex-1">
            <Package className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-blue-600 flex-shrink-0" />
            <span className="truncate">{t('supply.createProduct')}</span>
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          >
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
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
                      ref={nameInputRef}
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && formData.name.trim() && formData.description.trim() && formData.category_id) {
                          e.preventDefault();
                          const form = document.getElementById('product-form') as HTMLFormElement;
                          if (form) {
                            form.requestSubmit();
                          }
                        }
                      }}
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

                {/* Description - obligatoire */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('supply.description')} *
                  </label>
                  <textarea
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Description du produit (obligatoire)"
                  />
                </div>

                {/* Upload d'image */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Photo du produit
                  </label>
                  <div className="space-y-3">
                    {imagePreview ? (
                      <div className="relative">
                        <img
                          src={imagePreview}
                          alt="Aperçu"
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
                    {!imagePreview && (
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
              </div>
            </div>

            {/* Section: Unité et Catégorie - toujours visibles */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                {/* Catégorie - obligatoire */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('supply.category')} *
                  </label>
                  <div className="flex gap-2">
                    <select
                      required
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">{t('supply.selectCategory')} *</option>
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
              </div>
            </div>

            {/* Champs optionnels - masqués par défaut */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvancedFields(!showAdvancedFields)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                {showAdvancedFields ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Masquer les champs optionnels
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Afficher les champs optionnels (catégorie, fournisseur, etc.)
                  </>
                )}
              </button>

              {showAdvancedFields && (
                <div className="mt-4 space-y-4 pt-4 border-t border-gray-200">
                  {/* Fournisseur - pré-rempli si disponible */}
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

                  {/* Stock minimum */}
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

                  {/* Code-barres */}
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
              )}
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
              disabled={loading || uploadingImage}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {loading || uploadingImage ? (uploadingImage ? 'Upload de l\'image...' : t('app.creating')) : t('supply.createProduct')}
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

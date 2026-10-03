import React, { useState, useEffect } from 'react';
import { devLog } from '../../lib/devLog';
import { supabase } from '../../lib/supabase';
import { Product, User, Category, Supplier } from '../../types';
import { useTranslation } from 'react-i18next';
import { generateIncrementalSKU } from '../../lib/skuGenerator';
import { X, Package, Upload, Image as ImageIcon } from 'lucide-react';
import { Offcanvas, OffcanvasHeader, OffcanvasBody, OffcanvasFooter } from '../ui/Offcanvas';

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
    status: 'active' as 'active' | 'inactive' | 'discontinued',
    is_published_to_store: false
  });
  const [isNewProduct, setIsNewProduct] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
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
        status: product.status,
        is_published_to_store: product.is_published_to_store ?? false
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

  const checkProductNameExists = async (name: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name')
        .ilike('name', name.trim());
      
      if (error) throw error;
      
      // Si on modifie un produit, exclure le produit actuel de la vérification
      if (product && data) {
        return data.some(p => p.id !== product.id);
      }
      
      return (data && data.length > 0) || false;
    } catch (error) {
      console.error('Erreur lors de la vérification du nom:', error);
      return false; // En cas d'erreur, on laisse passer pour ne pas bloquer l'utilisateur
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNameError(null);
    
    try {
      // Vérifier que l'utilisateur a un ID valide
      if (!user.id || user.id === '00000000-0000-0000-0000-000000000000') {
        throw new Error('Utilisateur non authentifié. Veuillez vous reconnecter.');
      }

      // Vérifier si le nom existe déjà
      if (formData.name.trim()) {
        // Pour les nouveaux produits, toujours vérifier
        // Pour les produits existants, vérifier seulement si le nom a changé
        const shouldCheck = isNewProduct || (product && product.name.toLowerCase().trim() !== formData.name.toLowerCase().trim());
        
        if (shouldCheck) {
          const nameExists = await checkProductNameExists(formData.name);
          if (nameExists) {
            setNameError(t('stock.form.nameExists'));
            setLoading(false);
            return;
          }
        }
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

      devLog('Données à sauvegarder:', data);

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

  return (
    <Offcanvas
      onClose={onClose}
      width="xl"
      ariaLabel={product ? t('stock.editProduct') : t('stock.newProduct')}
    >
      <OffcanvasHeader>
        <div className="flex justify-between items-center">
          <h3 className="text-base sm:text-lg md:text-xl font-bold flex items-center min-w-0">
            <Package className="h-5 w-5 sm:h-6 sm:w-6 mr-2 app-text-link flex-shrink-0" />
            <span className="truncate">{product ? t('stock.editProduct') : t('stock.newProduct')}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="app-icon-btn flex-shrink-0 ml-2"
            aria-label={t('app.cancel')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </OffcanvasHeader>

      <form id="product-form" onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <OffcanvasBody className="md:p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="app-label">{t('stock.productName')} *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => {
                  setFormData({...formData, name: e.target.value});
                  setNameError(null); // Réinitialiser l'erreur quand l'utilisateur modifie le nom
                }}
                  className={`app-input ${nameError ? 'border-red-500' : ''}`}
              />
              {nameError && (
                <p className="mt-1 text-sm text-red-600">{nameError}</p>
              )}
            </div>
            <div>
                <label className="app-label">{t('stock.productSku')} *</label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={(e) => setFormData({...formData, sku: e.target.value})}
                  className={`app-input ${
                  isNewProduct ? 'app-bg-muted' : ''
                }`}
                readOnly={isNewProduct}
                title={isNewProduct ? t('stock.form.skuAutoGenerated') : ''}
                placeholder={isNewProduct ? "ABC-250118-00001" : ""}
              />
              {isNewProduct && (
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs app-text-muted">
                    {t('stock.form.skuFormat')}
                  </span>
                  <button
                    type="button"
                    onClick={generateSKU}
                    className="text-sm app-text-link hover:text-[var(--app-primary-deep)]"
                  >
                    {t('stock.form.generateNewSku')}
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div>
              <label className="app-label">{t('common.description')}</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="app-input"
              rows={3}
            />
          </div>

            {/* Upload d'image */}
            <div>
              <label className="app-label">
                Photo du produit
              </label>
              <div className="space-y-3">
                {(imagePreview || currentImageUrl) ? (
                  <div className="relative">
                    <img
                      src={imagePreview || currentImageUrl || ''}
                      alt={formData.name || 'Aperçu'}
                      className="w-full h-48 object-cover rounded-md border app-border"
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
                    className="border-2 border-dashed border-[var(--app-border)] rounded-md p-6 text-center cursor-pointer hover:border-[var(--app-primary)] hover:bg-[color-mix(in_srgb,var(--app-primary)_10%,var(--app-surface))] transition-colors"
                  >
                    <ImageIcon className="h-12 w-12 mx-auto app-text-muted mb-2" />
                    <p className="text-sm app-text-muted mb-1">
                      Cliquez pour ajouter une photo
                    </p>
                    <p className="text-xs app-text-muted">
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
                    className="w-full app-badge px-4 py-2 rounded-md hover:bg-[var(--app-surface-muted)] flex items-center justify-center gap-2 transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    Choisir une image
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label className="app-label">{t('stock.productCategory')}</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                  className="app-input"
              >
                <option value="">{t('app.select')}</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
                <label className="app-label">{t('stock.productSupplier')}</label>
              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData({...formData, supplier_id: e.target.value})}
                  className="app-input"
              >
                <option value="">{t('app.select')}</option>
                {suppliers.map(supp => (
                  <option key={supp.id} value={supp.id}>{supp.name}</option>
                ))}
              </select>
            </div>
            <div>
                <label className="app-label">{t('stock.productUnit')}</label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({...formData, unit: e.target.value})}
                  className="app-input"
              />
            </div>
          </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label className="app-label">{t('stock.minStockLevel')}</label>
              <input
                type="number"
                value={formData.min_stock_level}
                  onChange={(e) => setFormData({ ...formData, min_stock_level: parseInt(e.target.value) || 0 })}
                  onFocus={(e) => e.target.select()}
                  className="app-input"
              />
            </div>
            <div>
                <label className="app-label">{t('stock.maxStockLevel')}</label>
              <input
                type="number"
                value={formData.max_stock_level}
                onChange={(e) => setFormData({...formData, max_stock_level: e.target.value})}
                  onFocus={(e) => e.target.select()}
                  className="app-input"
              />
            </div>
            <div>
                <label className="app-label">{t('stock.currentStock')}</label>
              <input
                type="number"
                value={formData.current_stock}
                  onChange={(e) => setFormData({ ...formData, current_stock: parseInt(e.target.value) || 0 })}
                  onFocus={(e) => e.target.select()}
                  className="app-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="app-label">Code-barres</label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="app-input"
                  placeholder="Code-barres (optionnel)"
                />
              </div>
              <div>
                <label className="app-label">Poids</label>
                <input
                  type="number"
                  step="0.001"
                  value={formData.weight}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  className="app-input"
                  placeholder="Poids (optionnel)"
                />
              </div>
              <div>
                <label className="app-label">Dimensions</label>
                <input
                  type="text"
                  value={formData.dimensions}
                  onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                  className="app-input"
                  placeholder="Dimensions (optionnel)"
              />
            </div>
          </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_published_to_store}
                  onChange={(e) =>
                    setFormData({ ...formData, is_published_to_store: e.target.checked })
                  }
                  className="w-4 h-4 app-text-link border-[var(--app-border)] rounded focus:ring-[var(--app-primary)]"
                />
                <span className="text-sm app-text">Publier sur le store</span>
              </label>
              <p className="mt-1 text-xs app-text-muted">
                Flag uniquement — aucune synchronisation e-commerce pour le moment.
              </p>
            </div>

        </OffcanvasBody>

        <OffcanvasFooter>
          <div className="app-actions flex-col-reverse sm:flex-row w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="app-btn app-btn-secondary w-full sm:w-auto"
            >
              {t('app.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || uploadingImage}
              className="app-btn app-btn-primary w-full sm:w-auto"
            >
              {loading || uploadingImage ? (uploadingImage ? 'Upload de l\'image...' : t('stock.saving')) : t('app.save')}
            </button>
          </div>
        </OffcanvasFooter>
      </form>
    </Offcanvas>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { PurchaseOrderItem, Product, User } from '../../types';
import { ArrowLeft, Plus, Trash2, Package, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ProductQuickCreate } from './ProductQuickCreate';
import { SupplierQuickCreate } from './SupplierQuickCreate';

interface CreatePurchaseOrderPageProps {
  user: User;
  onBack: () => void;
  onSave: () => void;
}

export const CreatePurchaseOrderPage: React.FC<CreatePurchaseOrderPageProps> = ({ user, onBack, onSave }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    supplier_id: '',
    supplier_name: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '',
    currency: 'MGA',
    tracking_number: '',
    notes: ''
  });
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showProductCreate, setShowProductCreate] = useState(false);
  const [showSupplierCreate, setShowSupplierCreate] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<Product[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S ou Cmd+S pour sauvegarder
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (items.length > 0 && !loading) {
          const form = document.querySelector('form');
          if (form) {
            form.requestSubmit();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items.length, loading]);

  // Mise à jour des suggestions de recherche
  useEffect(() => {
    if (productSearchTerm.trim().length > 0) {
      const filtered = products.filter(product => {
        const searchLower = productSearchTerm.toLowerCase();
        return (
          product.name.toLowerCase().includes(searchLower) ||
          product.sku.toLowerCase().includes(searchLower)
        );
      }).slice(0, 8); // Limiter à 8 suggestions
      setSearchSuggestions(filtered);
    } else {
      setSearchSuggestions([]);
    }
    setSelectedSuggestionIndex(-1);
  }, [productSearchTerm, products]);

  // Fermer les suggestions quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchSuggestions([]);
        setSelectedSuggestionIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = async () => {
    try {
      const [productsRes, suppliersRes] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('suppliers').select('*').order('name')
      ]);

      if (productsRes.error) throw productsRes.error;
      if (suppliersRes.error) throw suppliersRes.error;

      // Filtrer côté client pour les fournisseurs qui contiennent 'stock' dans leur tableau modules
      const filteredSuppliers = (suppliersRes.data || []).filter(supplier => {
        const modules = supplier.modules || [];
        return Array.isArray(modules) && modules.includes('stock');
      });

      setProducts(productsRes.data || []);
      setSuppliers(filteredSuppliers);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    }
  };

  // Récupérer le dernier prix pour un produit et un fournisseur
  const getLastPrice = async (productId: string, supplierId: string): Promise<number> => {
    if (!supplierId) return 0;
    
    try {
      // D'abord, récupérer les commandes du fournisseur
      const { data: orders, error: ordersError } = await supabase
        .from('purchase_orders')
        .select('id')
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false })
        .limit(10); // Limiter à 10 dernières commandes pour performance

      if (ordersError || !orders || orders.length === 0) return 0;

      const orderIds = orders.map(o => o.id);

      // Ensuite, récupérer les items de ces commandes pour ce produit
      const { data: items, error: itemsError } = await supabase
        .from('purchase_order_items')
        .select('unit_price, created_at')
        .eq('product_id', productId)
        .in('purchase_order_id', orderIds)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (itemsError || !items) return 0;
      return items.unit_price || 0;
    } catch (error) {
      console.error('Erreur lors de la récupération du prix:', error);
      return 0;
    }
  };

  const addItem = async (product: Product, quantity: number = 1) => {
    const existingItem = items.find(item => item.product_id === product.id);
    if (existingItem) {
      // Si le produit existe déjà, augmenter la quantité
      const index = items.findIndex(item => item.product_id === product.id);
      updateItem(index, 'quantity_ordered', existingItem.quantity_ordered + quantity);
      setProductSearchTerm('');
      setSearchSuggestions([]);
      return;
    }

    // Récupérer le dernier prix si un fournisseur est sélectionné
    let suggestedPrice = 0;
    if (formData.supplier_id) {
      suggestedPrice = await getLastPrice(product.id, formData.supplier_id);
    }

    const newItem: PurchaseOrderItem = {
      id: `temp-${Date.now()}`,
      purchase_order_id: '',
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku,
      quantity_ordered: quantity,
      quantity_received: 0,
      unit_price: suggestedPrice,
      total_price: suggestedPrice * quantity,
      notes: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setItems([...items, newItem]);
    setProductSearchTerm('');
    setSearchSuggestions([]);
    
    // Remettre le focus sur la recherche
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  // Gérer la recherche par SKU direct
  const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // Si une suggestion est sélectionnée, l'ajouter
      if (selectedSuggestionIndex >= 0 && searchSuggestions[selectedSuggestionIndex]) {
        await addItem(searchSuggestions[selectedSuggestionIndex]);
        return;
      }

      // Sinon, chercher par SKU exact
      const exactMatch = products.find(
        p => p.sku.toLowerCase() === productSearchTerm.trim().toLowerCase()
      );
      
      if (exactMatch) {
        await addItem(exactMatch);
      } else if (searchSuggestions.length > 0) {
        // Prendre le premier résultat
        await addItem(searchSuggestions[0]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev < searchSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Escape') {
      setSearchSuggestions([]);
      setProductSearchTerm('');
    }
  };

  const handleProductCreated = (product: Product) => {
    setProducts([...products, product]);
    addItem(product);
    setShowProductCreate(false);
  };

  const handleSupplierCreated = (supplier: any) => {
    setSuppliers([...suppliers, supplier]);
    setFormData({
      ...formData,
      supplier_id: supplier.id,
      supplier_name: supplier.name
    });
    setShowSupplierCreate(false);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    if (field === 'quantity_ordered' || field === 'unit_price') {
      updatedItems[index].total_price = updatedItems[index].quantity_ordered * updatedItems[index].unit_price;
    }
    
    setItems(updatedItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      alert('Veuillez ajouter au moins un article à la commande');
      return;
    }

    setLoading(true);
    try {
      const orderData: any = {
        order_number: null,
        supplier_id: formData.supplier_id && formData.supplier_id.trim() !== '' ? formData.supplier_id : null,
        supplier_name: formData.supplier_name,
        order_date: formData.order_date,
        expected_delivery_date: formData.expected_delivery_date || null,
        currency: formData.currency,
        tracking_number: formData.tracking_number || null,
        notes: formData.notes || null,
        created_by: user.id !== '00000000-0000-0000-0000-000000000000' ? user.id : null,
        updated_by: user.id !== '00000000-0000-0000-0000-000000000000' ? user.id : null
      };

      const { data, error } = await supabase
        .from('purchase_orders')
        .insert(orderData as any)
        .select()
        .single();

      if (error) throw error;

      const orderId = (data as any).id;

      const itemsToInsert = items.map(item => ({
        purchase_order_id: orderId,
        product_id: item.product_id,
        quantity_ordered: item.quantity_ordered,
        quantity_received: item.quantity_received,
        unit_price: item.unit_price,
        total_price: item.total_price,
        notes: item.notes || null
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(itemsToInsert as any);
      
      if (itemsError) throw itemsError;

      onSave();
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      let errorMessage = 'Erreur lors de la sauvegarde de la commande';
      
      if (error?.code === '42702') {
        errorMessage = 'Erreur de base de données - veuillez réessayer';
      } else if (error?.code === '23505') {
        errorMessage = 'Un numéro de commande similaire existe déjà';
      } else if (error?.code === '23503') {
        errorMessage = 'Fournisseur invalide';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);

  return (
    <div className="space-y-6">
      {/* En-tête avec bouton retour */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
        >
          <ArrowLeft className="h-5 w-5" />
          {t('app.back') || 'Retour'}
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {t('supply.createOrder')}
        </h1>
      </div>

      {/* Formulaire */}
      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations générales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('supply.supplier')}
              </label>
              <div className="flex gap-2">
                <select
                  value={formData.supplier_id}
                  onChange={(e) => {
                    const supplier = suppliers.find(s => s.id === e.target.value);
                    setFormData({
                      ...formData,
                      supplier_id: e.target.value,
                      supplier_name: supplier?.name || ''
                    });
                  }}
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2"
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
                  className="bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 flex items-center gap-1"
                  title={t('supply.createSupplier') || 'Créer un nouveau fournisseur'}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('supply.orderDate')}
              </label>
              <input
                type="date"
                required
                value={formData.order_date}
                onChange={(e) => setFormData({...formData, order_date: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>

          {/* Date de livraison prévue, Devise et Numéro de suivi sur la même ligne */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('supply.expectedDeliveryDate')}
              </label>
              <input
                type="date"
                value={formData.expected_delivery_date}
                onChange={(e) => setFormData({...formData, expected_delivery_date: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('supply.currency')}
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({...formData, currency: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="MGA">MGA</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="RMB">RMB</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('deliveries.trackingNumber')}
              </label>
              <input
                type="text"
                value={formData.tracking_number}
                onChange={(e) => setFormData({...formData, tracking_number: e.target.value})}
                placeholder={t('deliveries.trackingPlaceholder')}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('supply.notes')}
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={3}
            />
          </div>

          {/* Articles */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{t('supply.items')}</h3>
            </div>

            {/* Barre de recherche inline */}
            <div className="mb-4 relative" ref={searchContainerRef}>
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Rechercher un produit par nom ou SKU (appuyez sur Entrée pour ajouter)"
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    onFocus={() => {
                      if (productSearchTerm.trim().length > 0) {
                        const filtered = products.filter(product => {
                          const searchLower = productSearchTerm.toLowerCase();
                          return (
                            product.name.toLowerCase().includes(searchLower) ||
                            product.sku.toLowerCase().includes(searchLower)
                          );
                        }).slice(0, 8);
                        setSearchSuggestions(filtered);
                      }
                    }}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowProductCreate(true)}
                  className="bg-green-600 text-white px-4 py-3 rounded-md hover:bg-green-700 flex items-center gap-2 whitespace-nowrap"
                  title="Créer un nouveau produit"
                >
                  <Package className="h-5 w-5" />
                  <span className="hidden sm:inline">Nouveau produit</span>
                </button>
              </div>

              {/* Suggestions de recherche */}
              {searchSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-64 overflow-y-auto">
                  {searchSuggestions.map((product, index) => (
                    <div
                      key={product.id}
                      onClick={() => addItem(product)}
                      className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-blue-50 ${
                        index === selectedSuggestionIndex ? 'bg-blue-50' : ''
                      } ${index === searchSuggestions.length - 1 ? 'border-b-0' : ''}`}
                    >
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                      {product.current_stock !== undefined && (
                        <div className="text-xs text-gray-400">
                          Stock: {product.current_stock} {product.unit}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>{t('supply.noItems')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={item.id} className="bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('supply.product')}
                        </label>
                        <div className="text-sm font-medium">
                          {item.product_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.product_sku}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('supply.quantity')}
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity_ordered}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            updateItem(index, 'quantity_ordered', val);
                          }}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const nextInput = e.currentTarget.parentElement?.parentElement?.querySelector('input[type="number"][step="0.01"]') as HTMLInputElement;
                              nextInput?.focus();
                            }
                          }}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                          autoFocus={index === items.length - 1 && item.quantity_ordered === 1}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('supply.unitPrice')}
                          {item.unit_price > 0 && (
                            <span className="text-xs text-gray-500 ml-1">(suggéré)</span>
                          )}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && index === items.length - 1) {
                              e.preventDefault();
                              searchInputRef.current?.focus();
                            }
                          }}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('supply.total')}
                        </label>
                        <div className="text-sm font-medium">
                          {item.total_price.toLocaleString()} {formData.currency}
                        </div>
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Total */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">{t('supply.totalAmount')}:</span>
              <span className="text-xl font-bold text-blue-600">
                {totalAmount.toLocaleString()} {formData.currency}
              </span>
            </div>
          </div>

          {/* Boutons */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              {t('app.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || items.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? t('app.saving') : t('app.save')}
            </button>
          </div>
        </form>
      </div>


      {/* Modal de création rapide de produit */}
      {showProductCreate && (
        <ProductQuickCreate
          onClose={() => setShowProductCreate(false)}
          onProductCreated={handleProductCreated}
          user={user}
          initialSupplierId={formData.supplier_id}
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
    </div>
  );
};


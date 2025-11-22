import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { PurchaseOrder, PurchaseOrderItem, Product, User } from '../../types';
import { X, Edit, Package, Calendar, DollarSign, Truck, CheckCircle, Plus, Search, Image as ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ReceiptForm } from './ReceiptForm';
import { ProductQuickCreate } from './ProductQuickCreate';
import { DeliveryProgressBar } from './DeliveryProgressBar';

interface PurchaseOrderDetailsProps {
  order: PurchaseOrder;
  onClose: () => void;
  onEdit: () => void;
  user: User;
}

export const PurchaseOrderDetails: React.FC<PurchaseOrderDetailsProps> = ({ order, onClose, onEdit, user }) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [showProductCreate, setShowProductCreate] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [totalAmount, setTotalAmount] = useState(order.total_amount);
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>({});
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [productImages, setProductImages] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchOrderItems();
    fetchData();
    setTotalAmount(order.total_amount);
  }, [order.id, order.total_amount]);

  const fetchOrderItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select(`
          *,
          products (
            name,
            sku,
            unit,
            image_url
          )
        `)
        .eq('purchase_order_id', order.id);

      if (error) throw error;
      
      // Mapper les données de la jointure vers product_name et product_sku
      // Supabase peut retourner products comme un objet ou un tableau selon la relation
      const imagesMap: Record<string, string> = {};
      const mappedItems = (data || []).map((item: any) => {
        const product = Array.isArray(item.products) ? item.products[0] : item.products;
        const productImageUrl = product?.image_url;
        
        // Stocker l'image du produit si elle existe
        if (productImageUrl && item.product_id) {
          imagesMap[item.product_id] = productImageUrl;
        }
        
        return {
          ...item,
          product_name: product?.name || '',
          product_sku: product?.sku || ''
        };
      });
      
      setProductImages(imagesMap);
      setItems(mappedItems);
    } catch (error) {
      console.error('Erreur lors du chargement des articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'ordered': return 'bg-blue-100 text-blue-800';
      case 'partial': return 'bg-orange-100 text-orange-800';
      case 'received': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    return t(`supply.status.${status}`);
  };

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error);
    }
  };

  const addItem = async (product: Product) => {
    const existingItem = items.find(item => item.product_id === product.id);
    if (existingItem) {
      alert('Ce produit est déjà dans la commande');
      return;
    }

    try {
      // Créer le nouvel article dans la base de données
      const { data: newItem, error } = await supabase
        .from('purchase_order_items')
        .insert({
          purchase_order_id: order.id,
          product_id: product.id,
          quantity_ordered: 1,
          quantity_received: 0,
          unit_price: 0,
          total_price: 0
        })
        .select(`
          *,
          products (
            name,
            sku,
            unit
          )
        `)
        .single();

      if (error) throw error;

      // Mapper les données de la jointure
      const productData = Array.isArray(newItem.products) ? newItem.products[0] : newItem.products;
      const mappedItem = {
        ...newItem,
        product_name: productData?.name || '',
        product_sku: productData?.sku || ''
      };

      // Ajouter le nouvel article à la liste
      setItems([...items, mappedItem]);
      setShowProductSearch(false);
      setProductSearchTerm('');

      // Rafraîchir le montant total de la commande
      const { data: orderData } = await supabase
        .from('purchase_orders')
        .select('total_amount')
        .eq('id', order.id)
        .single();

      if (orderData) {
        setTotalAmount(orderData.total_amount);
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout du produit:', error);
      alert('Erreur lors de l\'ajout du produit à la commande');
    }
  };

  const handleProductCreated = (product: Product) => {
    setProducts([...products, product]);
    addItem(product);
    setShowProductCreate(false);
  };

  const updateItem = async (itemId: string, field: string, value: any) => {
    if (!canEditItems) return;

    try {
      const item = items.find(i => i.id === itemId);
      if (!item) return;

      // Convertir la virgule en point pour le prix unitaire
      let numericValue = value;
      if (field === 'unit_price' && typeof value === 'string') {
        numericValue = parseFloat(value.replace(',', '.')) || 0;
      }

      const updatedData: any = {
        [field]: numericValue
      };

      // Si on modifie la quantité ou le prix unitaire, recalculer le total_price
      if (field === 'quantity_ordered' || field === 'unit_price') {
        const newQuantity = field === 'quantity_ordered' ? numericValue : item.quantity_ordered;
        const newUnitPrice = field === 'unit_price' ? numericValue : item.unit_price;
        updatedData.total_price = newQuantity * newUnitPrice;
      }

      const { error } = await supabase
        .from('purchase_order_items')
        .update(updatedData)
        .eq('id', itemId);

      if (error) throw error;

      // Mettre à jour l'état local
      const updatedItems = items.map(i => {
        if (i.id === itemId) {
          const updated = { ...i, ...updatedData };
          return updated;
        }
        return i;
      });
      setItems(updatedItems);

      // Supprimer la valeur en cours d'édition
      if (field === 'unit_price') {
        const newEditingPrices = { ...editingPrices };
        delete newEditingPrices[itemId];
        setEditingPrices(newEditingPrices);
      }

      // Rafraîchir les données de la commande pour obtenir le nouveau total_amount
      // Le trigger en base de données met à jour automatiquement le total_amount
      const { data: orderData, error: orderError } = await supabase
        .from('purchase_orders')
        .select('total_amount')
        .eq('id', order.id)
        .single();

      if (!orderError && orderData) {
        setTotalAmount(orderData.total_amount);
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'article:', error);
      alert('Erreur lors de la mise à jour de l\'article');
    }
  };

  const canCreateReceipt = order.status === 'ordered' || order.status === 'partial';
  const hasUnreceivedItems = items.some(item => item.quantity_received < item.quantity_ordered);
  const canAddProducts = order.status !== 'received' && order.status !== 'cancelled';
  const canEditItems = order.status !== 'received' && order.status !== 'cancelled';

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-[60]"
        style={{ top: 0, left: 0, right: 0, bottom: 0, margin: 0, padding: 0 }}
      >
        <div 
          className="fixed right-0 top-0 h-full w-full md:w-[900px] lg:w-[1200px] bg-white shadow-xl z-[70] animate-slide-in-right"
          style={{ top: 0, right: 0, margin: 0, padding: 0 }}
        >
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-[60] animate-fade-in"
        style={{ top: 0, left: 0, right: 0, bottom: 0, margin: 0, padding: 0 }}
        onClick={onClose}
      />
      
      {/* Offcanvas */}
      <div 
        className="fixed right-0 top-0 h-full w-full md:w-[900px] lg:w-[1200px] bg-white shadow-xl z-[70] animate-slide-in-right flex flex-col"
        style={{ top: 0, right: 0, margin: 0, padding: 0 }}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 p-4 sm:p-6 border-b flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-bold truncate">{order.order_number}</h2>
            <p className="text-sm sm:text-base text-gray-600 truncate">{order.supplier_name || t('supply.noSupplier')}</p>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
            <span className={`inline-flex px-2 sm:px-3 py-1 text-xs sm:text-sm font-semibold rounded-full whitespace-nowrap ${getStatusColor(order.status)}`}>
              {getStatusLabel(order.status)}
            </span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            >
              <X className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          {/* Informations générales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center mb-2">
                <Calendar className="h-5 w-5 text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-700">{t('supply.orderDate')}</span>
              </div>
              <p className="text-lg font-semibold">
                {new Date(order.order_date).toLocaleDateString()}
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center mb-2">
                <Truck className="h-5 w-5 text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-700">{t('supply.expectedDeliveryDate')}</span>
              </div>
              {order.expected_delivery_date ? (
                <p className="text-lg font-semibold mb-2">
                  {new Date(order.expected_delivery_date).toLocaleDateString()}
                </p>
              ) : (
                <p className="text-lg font-semibold">
                  {t('supply.notSpecified')}
                </p>
              )}
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center mb-2">
                <Package className="h-5 w-5 text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-700">{t('deliveries.trackingNumber')}</span>
              </div>
              <p className="text-lg font-semibold">
                {order.tracking_number || t('supply.notSpecified')}
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center mb-2">
                <DollarSign className="h-5 w-5 text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-700">{t('supply.totalAmount')}</span>
              </div>
              <p className="text-lg font-semibold">
                {totalAmount.toLocaleString()} {order.currency}
              </p>
            </div>
          </div>

          {/* Barre de progression de livraison */}
          {order.expected_delivery_date && (
            <div className="mb-6">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <DeliveryProgressBar order={order} />
              </div>
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">{t('supply.notes')}</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-700">{order.notes}</p>
              </div>
            </div>
          )}

          {/* Articles */}
          <div className="mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-0 mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold">{t('supply.items')}</h3>
              <div className="flex flex-wrap gap-2">
                {canAddProducts && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowProductSearch(true)}
                      className="bg-blue-600 text-white px-2 sm:px-3 py-1 rounded-md hover:bg-blue-700 flex items-center gap-1 text-xs sm:text-sm whitespace-nowrap"
                    >
                      <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">{t('supply.addExistingItem')}</span>
                      <span className="sm:hidden">Ajouter</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowProductCreate(true)}
                      className="bg-green-600 text-white px-2 sm:px-3 py-1 rounded-md hover:bg-green-700 flex items-center gap-1 text-xs sm:text-sm whitespace-nowrap"
                    >
                      <Package className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">{t('supply.createNewProduct')}</span>
                      <span className="sm:hidden">Nouveau</span>
                    </button>
                  </>
                )}
                {canCreateReceipt && hasUnreceivedItems && (
                  <button
                    onClick={() => setShowReceiptForm(true)}
                    className="bg-green-600 text-white px-3 sm:px-4 py-1 sm:py-2 rounded-md hover:bg-green-700 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap"
                  >
                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">{t('supply.createReceipt')}</span>
                    <span className="sm:hidden">Réception</span>
                  </button>
                )}
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-3">
              {items.map((item) => {
                const isComplete = item.quantity_received >= item.quantity_ordered;
                const isPartial = item.quantity_received > 0 && item.quantity_received < item.quantity_ordered;
                
                return (
                  <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
                    <div className="flex items-start gap-3 mb-3">
                      {productImages[item.product_id] && !imageErrors[item.product_id] ? (
                        <img
                          src={productImages[item.product_id]}
                          alt={item.product_name}
                          className="h-16 w-16 object-cover rounded-md border border-gray-300 flex-shrink-0"
                          onError={() => {
                            setImageErrors(prev => ({ ...prev, [item.product_id]: true }));
                          }}
                        />
                      ) : (
                        <div className="h-16 w-16 bg-gray-100 rounded-md border border-gray-300 flex items-center justify-center flex-shrink-0">
                          <ImageIcon className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate mb-1">
                          {item.product_name}
                        </div>
                        <div className="text-xs text-gray-500">SKU: {item.product_sku}</div>
                        <div className="mt-2">
                          {isComplete ? (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              {t('supply.complete')}
                            </span>
                          ) : isPartial ? (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                              {t('supply.partial')}
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                              {t('supply.pending')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs pt-2 border-t border-gray-100">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-gray-600">Qté commandée:</span>
                          <div className="mt-1">
                            {canEditItems ? (
                              <input
                                type="number"
                                min="1"
                                value={item.quantity_ordered}
                                onChange={(e) => updateItem(item.id, 'quantity_ordered', parseInt(e.target.value) || 1)}
                                onBlur={(e) => {
                                  const value = parseInt(e.target.value);
                                  if (!value || value < 1) {
                                    updateItem(item.id, 'quantity_ordered', 1);
                                  }
                                }}
                                className="w-full px-2 py-1 border border-gray-300 rounded-md text-center text-sm"
                              />
                            ) : (
                              <span className="text-gray-900 font-medium">{item.quantity_ordered}</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-600">Qté reçue:</span>
                          <div className="mt-1 text-gray-900 font-medium">{item.quantity_received}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-gray-600">Prix unitaire:</span>
                          <div className="mt-1">
                            {canEditItems ? (
                              <input
                                type="text"
                                value={editingPrices[item.id] !== undefined ? editingPrices[item.id] : item.unit_price.toString().replace('.', ',')}
                                onChange={(e) => {
                                  const inputValue = e.target.value;
                                  if (/^[\d,.]*$/.test(inputValue) || inputValue === '') {
                                    setEditingPrices({ ...editingPrices, [item.id]: inputValue });
                                  }
                                }}
                                onBlur={(e) => {
                                  const inputValue = e.target.value.replace(',', '.');
                                  const numericValue = parseFloat(inputValue);
                                  if (isNaN(numericValue) || numericValue < 0) {
                                    updateItem(item.id, 'unit_price', 0);
                                  } else {
                                    updateItem(item.id, 'unit_price', inputValue);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                  }
                                }}
                                placeholder="0,00"
                                className="w-full px-2 py-1 border border-gray-300 rounded-md text-right text-sm"
                              />
                            ) : (
                              <span className="text-gray-900 font-medium">
                                {item.unit_price.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {order.currency}
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-600">Total:</span>
                          <div className="mt-1 text-gray-900 font-medium">
                            {item.total_price.toLocaleString()} {order.currency}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && (
                <div className="text-center py-8 bg-white border border-gray-200 rounded-lg">
                  <p className="text-gray-500 text-sm">Aucun article</p>
                </div>
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('supply.product')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('supply.quantityOrdered')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('supply.quantityReceived')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('supply.unitPrice')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('supply.total')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('supply.statut')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item) => {
                    const isComplete = item.quantity_received >= item.quantity_ordered;
                    const isPartial = item.quantity_received > 0 && item.quantity_received < item.quantity_ordered;
                    
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {/* Image du produit */}
                            {productImages[item.product_id] && !imageErrors[item.product_id] ? (
                              <img
                                src={productImages[item.product_id]}
                                alt={item.product_name}
                                className="h-12 w-12 object-cover rounded-md border border-gray-300 flex-shrink-0"
                                onError={() => {
                                  setImageErrors(prev => ({ ...prev, [item.product_id]: true }));
                                }}
                              />
                            ) : (
                              <div className="h-12 w-12 bg-gray-100 rounded-md border border-gray-300 flex items-center justify-center flex-shrink-0">
                                <ImageIcon className="h-6 w-6 text-gray-400" />
                              </div>
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {item.product_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                SKU: {item.product_sku}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {canEditItems ? (
                            <input
                              type="number"
                              min="1"
                              value={item.quantity_ordered}
                              onChange={(e) => updateItem(item.id, 'quantity_ordered', parseInt(e.target.value) || 1)}
                              onBlur={(e) => {
                                const value = parseInt(e.target.value);
                                if (!value || value < 1) {
                                  updateItem(item.id, 'quantity_ordered', 1);
                                }
                              }}
                              className="w-20 px-2 py-1 border border-gray-300 rounded-md text-center"
                            />
                          ) : (
                            item.quantity_ordered
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.quantity_received}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {canEditItems ? (
                            <input
                              type="text"
                              value={editingPrices[item.id] !== undefined ? editingPrices[item.id] : item.unit_price.toString().replace('.', ',')}
                              onChange={(e) => {
                                const inputValue = e.target.value;
                                // Accepter uniquement les chiffres, la virgule et le point
                                if (/^[\d,.]*$/.test(inputValue) || inputValue === '') {
                                  setEditingPrices({ ...editingPrices, [item.id]: inputValue });
                                }
                              }}
                              onBlur={(e) => {
                                const inputValue = e.target.value.replace(',', '.');
                                const numericValue = parseFloat(inputValue);
                                if (isNaN(numericValue) || numericValue < 0) {
                                  updateItem(item.id, 'unit_price', 0);
                                } else {
                                  updateItem(item.id, 'unit_price', inputValue);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                }
                              }}
                              placeholder="0,00"
                              className="w-24 px-2 py-1 border border-gray-300 rounded-md text-right"
                            />
                          ) : (
                            item.unit_price.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          )} {order.currency}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.total_price.toLocaleString()} {order.currency}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isComplete ? (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              {t('supply.complete')}
                            </span>
                          ) : isPartial ? (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                              {t('supply.partial')}
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                              {t('supply.pending')}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-3 sm:pt-4 border-t mt-4 sm:mt-6">
            <button
              onClick={onClose}
              className="px-3 sm:px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors text-sm sm:text-base"
            >
              {t('app.close')}
            </button>
            {order.status === 'draft' && (
              <button
                onClick={onEdit}
                className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors text-sm sm:text-base"
              >
                <Edit className="h-4 w-4" />
                {t('app.edit')}
              </button>
            )}
          </div>
        </div>

        {/* Formulaire de réception */}
        {showReceiptForm && (
          <ReceiptForm
            purchaseOrder={order}
            onClose={() => setShowReceiptForm(false)}
            onSave={() => {
              fetchOrderItems();
              setShowReceiptForm(false);
            }}
            user={user}
          />
        )}

        {/* Modal de recherche de produits */}
        {showProductSearch && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
              <div className="p-4 border-b">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">{t('supply.selectProduct')}</h3>
                  <button
                    onClick={() => {
                      setShowProductSearch(false);
                      setProductSearchTerm('');
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="mt-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder={t('supply.searchProducts')}
                      value={productSearchTerm}
                      onChange={(e) => setProductSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="mt-3">
                    <button
                      onClick={() => {
                        setShowProductSearch(false);
                        setShowProductCreate(true);
                      }}
                      className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center justify-center gap-2"
                    >
                      <Package className="h-4 w-4" />
                      {t('supply.createNewProduct')}
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                <div className="space-y-2">
                  {filteredProducts.map(product => (
                    <div
                      key={product.id}
                      onClick={() => addItem(product)}
                      className="p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                      <div className="text-sm text-gray-500">
                        Stock: {product.current_stock} {product.unit}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de création rapide de produit */}
        {showProductCreate && (
          <ProductQuickCreate
            onClose={() => setShowProductCreate(false)}
            onProductCreated={handleProductCreated}
            user={user}
            initialSupplierId={order.supplier_id}
          />
        )}
      </div>
    </>
  );
};

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { PurchaseOrder, PurchaseOrderItem, Product, User } from '../../types';
import { X, Edit, Package, Calendar, DollarSign, Truck, CheckCircle, Plus, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ReceiptForm } from './ReceiptForm';
import { ProductQuickCreate } from './ProductQuickCreate';

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

  useEffect(() => {
    fetchOrderItems();
    fetchData();
  }, [order.id]);

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
            unit
          )
        `)
        .eq('purchase_order_id', order.id);

      if (error) throw error;
      
      // Mapper les données de la jointure vers product_name et product_sku
      // Supabase peut retourner products comme un objet ou un tableau selon la relation
      const mappedItems = (data || []).map((item: any) => {
        const product = Array.isArray(item.products) ? item.products[0] : item.products;
        return {
          ...item,
          product_name: product?.name || '',
          product_sku: product?.sku || ''
        };
      });
      
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

  const canCreateReceipt = order.status === 'ordered' || order.status === 'partial';
  const hasUnreceivedItems = items.some(item => item.quantity_received < item.quantity_ordered);
  const canAddProducts = order.status !== 'received' && order.status !== 'cancelled';

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
        <div className="fixed right-0 top-0 h-full w-full md:w-[900px] lg:w-[1200px] bg-white shadow-xl animate-slide-in-right">
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
        className="fixed inset-0 bg-black bg-opacity-50 z-50 animate-fade-in"
        onClick={onClose}
      />
      
      {/* Offcanvas */}
      <div className="fixed right-0 top-0 h-full w-full md:w-[900px] lg:w-[1200px] bg-white shadow-xl z-50 animate-slide-in-right flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold">{order.order_number}</h2>
            <p className="text-gray-600">{order.supplier_name || t('supply.noSupplier')}</p>
          </div>
          <div className="flex items-center space-x-3">
            <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(order.status)}`}>
              {getStatusLabel(order.status)}
            </span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Informations générales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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
              <p className="text-lg font-semibold">
                {order.expected_delivery_date 
                  ? new Date(order.expected_delivery_date).toLocaleDateString()
                  : t('supply.notSpecified')
                }
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center mb-2">
                <DollarSign className="h-5 w-5 text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-700">{t('supply.totalAmount')}</span>
              </div>
              <p className="text-lg font-semibold">
                {order.total_amount.toLocaleString()} {order.currency}
              </p>
            </div>
          </div>

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
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{t('supply.items')}</h3>
              <div className="flex gap-2">
                {canAddProducts && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowProductSearch(true)}
                      className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 flex items-center gap-1 text-sm"
                    >
                      <Plus className="h-4 w-4" />
                      {t('supply.addExistingItem')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowProductCreate(true)}
                      className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 flex items-center gap-1 text-sm"
                    >
                      <Package className="h-4 w-4" />
                      {t('supply.createNewProduct')}
                    </button>
                  </>
                )}
                {canCreateReceipt && hasUnreceivedItems && (
                  <button
                    onClick={() => setShowReceiptForm(true)}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {t('supply.createReceipt')}
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
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
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {item.product_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              SKU: {item.product_sku}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.quantity_ordered}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.quantity_received}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.unit_price.toLocaleString()} {order.currency}
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
          <div className="flex justify-end space-x-3 pt-4 border-t mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t('app.close')}
            </button>
            {order.status === 'draft' && (
              <button
                onClick={onEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 transition-colors"
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

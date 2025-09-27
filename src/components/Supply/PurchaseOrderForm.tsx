import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { PurchaseOrder, PurchaseOrderItem, Product, User } from '../../types';
import { X, Plus, Trash2, Package, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ProductQuickCreate } from './ProductQuickCreate';

interface PurchaseOrderFormProps {
  order?: PurchaseOrder | null;
  onClose: () => void;
  onSave: () => void;
  user: User;
}

export const PurchaseOrderForm: React.FC<PurchaseOrderFormProps> = ({ order, onClose, onSave, user }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    supplier_id: '',
    supplier_name: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '',
    currency: 'MGA',
    notes: ''
  });
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [showProductCreate, setShowProductCreate] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');

  const isEditing = !!order;

  useEffect(() => {
    fetchData();
    if (order) {
      setFormData({
        supplier_id: order.supplier_id || '',
        supplier_name: order.supplier_name || '',
        order_date: order.order_date,
        expected_delivery_date: order.expected_delivery_date || '',
        currency: order.currency,
        notes: order.notes || ''
      });
      fetchOrderItems();
    }
  }, [order]);

  const fetchData = async () => {
    try {
      const [productsRes, suppliersRes] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('suppliers').select('*').order('name')
      ]);

      if (productsRes.error) throw productsRes.error;
      if (suppliersRes.error) throw suppliersRes.error;

      setProducts(productsRes.data || []);
      setSuppliers(suppliersRes.data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    }
  };

  const fetchOrderItems = async () => {
    if (!order) return;
    
    try {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select(`
          *,
          products (
            name,
            sku
          )
        `)
        .eq('purchase_order_id', order.id);

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des articles:', error);
    }
  };

  const addItem = (product: Product) => {
    const existingItem = items.find(item => item.product_id === product.id);
    if (existingItem) {
      alert('Ce produit est déjà dans la commande');
      return;
    }

    const newItem: PurchaseOrderItem = {
      id: `temp-${Date.now()}`,
      purchase_order_id: order?.id || '',
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku,
      quantity_ordered: 1,
      quantity_received: 0,
      unit_price: 0,
      total_price: 0,
      notes: ''
    };

    setItems([...items, newItem]);
    setShowProductSearch(false);
    setProductSearchTerm('');
  };

  const handleProductCreated = (product: Product) => {
    // Ajouter le nouveau produit à la liste
    setProducts([...products, product]);
    // Ajouter automatiquement le produit à la commande
    addItem(product);
    setShowProductCreate(false);
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
      const orderData = {
        order_number: null, // Laisser le trigger générer automatiquement
        supplier_id: formData.supplier_id || null,
        supplier_name: formData.supplier_name,
        order_date: formData.order_date,
        expected_delivery_date: formData.expected_delivery_date || null,
        currency: formData.currency,
        notes: formData.notes || null,
        created_by: user.id !== '00000000-0000-0000-0000-000000000000' ? user.id : null,
        updated_by: user.id !== '00000000-0000-0000-0000-000000000000' ? user.id : null
      };

      let orderId: string;

      if (isEditing) {
        const { error } = await supabase
          .from('purchase_orders')
          .update(orderData)
          .eq('id', order!.id);
        if (error) throw error;
        orderId = order!.id;
      } else {
        const { data, error } = await supabase
          .from('purchase_orders')
          .insert(orderData)
          .select()
          .single();
        if (error) throw error;
        orderId = data.id;
      }

      // Supprimer les anciens articles si on édite
      if (isEditing) {
        await supabase
          .from('purchase_order_items')
          .delete()
          .eq('purchase_order_id', orderId);
      }

      // Ajouter les nouveaux articles
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
        .insert(itemsToInsert);
      
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
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">
            {isEditing ? t('supply.editOrder') : t('supply.createOrder')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Informations générales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('supply.supplier')}
              </label>
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
              </select>
            </div>
          </div>

          <div className="mb-6">
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
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{t('supply.items')}</h3>
              <div className="flex gap-2">
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
              </div>
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
                          onChange={(e) => updateItem(index, 'quantity_ordered', parseInt(e.target.value))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('supply.unitPrice')}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value))}
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
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
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
              onClick={onClose}
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

        {/* Modal de recherche de produits */}
        {showProductSearch && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
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
          />
        )}
      </div>
    </div>
  );
};

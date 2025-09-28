import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { PurchaseOrder, PurchaseOrderItem, ReceiptItem, User } from '../../types';
import { X, Package, Calendar, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ReceiptFormProps {
  purchaseOrder: PurchaseOrder;
  onClose: () => void;
  onSave: () => void;
  user: User;
}

export const ReceiptForm: React.FC<ReceiptFormProps> = ({ purchaseOrder, onClose, onSave, user }) => {
  const { t } = useTranslation();
  const [orderItems, setOrderItems] = useState<PurchaseOrderItem[]>([]);
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [formData, setFormData] = useState({
    receipt_date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(true);

  useEffect(() => {
    fetchOrderItems();
  }, [purchaseOrder.id]);

  const fetchOrderItems = async () => {
    try {
      setItemsLoading(true);
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
        .eq('purchase_order_id', purchaseOrder.id);

      if (error) throw error;
      
      const items = data || [];
      setOrderItems(items);
      
      // Initialiser les articles de réception avec les quantités restantes à recevoir
      const initialReceiptItems: ReceiptItem[] = items
        .filter(item => item.quantity_received < item.quantity_ordered)
        .map(item => ({
          id: `temp-${item.id}`,
          receipt_id: '',
          purchase_order_item_id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          product_sku: item.product_sku,
          quantity_received: item.quantity_ordered - item.quantity_received,
          unit_price: item.unit_price,
          total_price: (item.quantity_ordered - item.quantity_received) * item.unit_price,
          batch_number: '',
          expiry_date: '',
          notes: ''
        }));
      
      setReceiptItems(initialReceiptItems);
    } catch (error) {
      console.error('Erreur lors du chargement des articles:', error);
    } finally {
      setItemsLoading(false);
    }
  };

  const updateReceiptItem = (index: number, field: string, value: any) => {
    const updatedItems = [...receiptItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    if (field === 'quantity_received' || field === 'unit_price') {
      updatedItems[index].total_price = updatedItems[index].quantity_received * updatedItems[index].unit_price;
    }
    
    setReceiptItems(updatedItems);
  };

  const removeReceiptItem = (index: number) => {
    setReceiptItems(receiptItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (receiptItems.length === 0) {
      alert('Veuillez ajouter au moins un article à la réception');
      return;
    }

    setLoading(true);
    try {
      // Créer la réception
      const receiptData = {
        receipt_number: null, // Laisser le trigger générer automatiquement
        purchase_order_id: purchaseOrder.id,
        supplier_id: purchaseOrder.supplier_id,
        supplier_name: purchaseOrder.supplier_name,
        receipt_date: formData.receipt_date,
        currency: purchaseOrder.currency,
        notes: formData.notes || null,
        created_by: user.id
      };

      const { data: receipt, error: receiptError } = await supabase
        .from('receipts')
        .insert(receiptData)
        .select()
        .single();
      
      if (receiptError) throw receiptError;

      // Créer les articles de réception
      const itemsToInsert = receiptItems.map(item => ({
        receipt_id: receipt.id,
        purchase_order_item_id: item.purchase_order_item_id,
        product_id: item.product_id,
        quantity_received: item.quantity_received,
        unit_price: item.unit_price,
        total_price: item.total_price,
        batch_number: item.batch_number || null,
        expiry_date: item.expiry_date || null,
        notes: item.notes || null
      }));

      const { error: itemsError } = await supabase
        .from('receipt_items')
        .insert(itemsToInsert);
      
      if (itemsError) throw itemsError;

      onSave();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la réception:', error);
      alert('Erreur lors de la sauvegarde de la réception');
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = receiptItems.reduce((sum, item) => sum + item.total_price, 0);

  if (itemsLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-xl font-bold">{t('supply.createReceipt')}</h2>
            <p className="text-gray-600">{purchaseOrder.order_number}</p>
          </div>
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
                {t('supply.receiptDate')}
              </label>
              <input
                type="date"
                required
                value={formData.receipt_date}
                onChange={(e) => setFormData({...formData, receipt_date: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('supply.supplier')}
              </label>
              <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">
                {purchaseOrder.supplier_name || t('supply.noSupplier')}
              </div>
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

          {/* Articles à recevoir */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">{t('supply.itemsToReceive')}</h3>

            {receiptItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>{t('supply.noItemsToReceive')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {receiptItems.map((item, index) => {
                  const orderItem = orderItems.find(oi => oi.id === item.purchase_order_item_id);
                  const maxQuantity = orderItem ? orderItem.quantity_ordered - orderItem.quantity_received : 0;
                  
                  return (
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
                            SKU: {item.product_sku}
                          </div>
                          <div className="text-xs text-gray-500">
                            {t('supply.maxQuantity')}: {maxQuantity}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('supply.quantityReceived')}
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={maxQuantity}
                            value={item.quantity_received}
                            onChange={(e) => updateReceiptItem(index, 'quantity_received', parseInt(e.target.value))}
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
                            onChange={(e) => updateReceiptItem(index, 'unit_price', parseFloat(e.target.value))}
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('supply.total')}
                          </label>
                          <div className="text-sm font-medium">
                            {item.total_price.toLocaleString()} {purchaseOrder.currency}
                          </div>
                        </div>

                        <div>
                          <button
                            type="button"
                            onClick={() => removeReceiptItem(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Informations supplémentaires - Optionnelles */}
                      <div className="mt-4 p-3 bg-blue-50 rounded-md">
                        <div className="text-sm text-blue-700 mb-2">
                          <strong>Informations optionnelles :</strong> Numéro de lot et date d'expiration (non obligatoires)
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('supply.batchNumber')} <span className="text-gray-400">(optionnel)</span>
                            </label>
                            <input
                              type="text"
                              value={item.batch_number}
                              onChange={(e) => updateReceiptItem(index, 'batch_number', e.target.value)}
                              className="w-full border border-gray-300 rounded-md px-3 py-2"
                              placeholder="Numéro de lot (optionnel)"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('supply.expiryDate')} <span className="text-gray-400">(optionnel)</span>
                            </label>
                            <input
                              type="date"
                              value={item.expiry_date}
                              onChange={(e) => updateReceiptItem(index, 'expiry_date', e.target.value)}
                              className="w-full border border-gray-300 rounded-md px-3 py-2"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('supply.notes')} <span className="text-gray-400">(optionnel)</span>
                            </label>
                            <input
                              type="text"
                              value={item.notes}
                              onChange={(e) => updateReceiptItem(index, 'notes', e.target.value)}
                              className="w-full border border-gray-300 rounded-md px-3 py-2"
                              placeholder="Notes (optionnel)"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Total */}
          <div className="bg-green-50 p-4 rounded-lg mb-6">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">{t('supply.totalAmount')}:</span>
              <span className="text-xl font-bold text-green-600">
                {totalAmount.toLocaleString()} {purchaseOrder.currency}
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
              disabled={loading || receiptItems.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              {loading ? t('app.saving') : t('supply.createReceipt')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

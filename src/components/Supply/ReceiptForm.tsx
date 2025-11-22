import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { PurchaseOrder, PurchaseOrderItem, ReceiptItem, User } from '../../types';
import { X, Package, Calendar, CheckCircle, Info } from 'lucide-react';
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
    exchange_rate_mga: undefined as number | undefined,
    notes: purchaseOrder.notes || ''
  });
  const [loading, setLoading] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(true);

  useEffect(() => {
    fetchOrderItems();
  }, [purchaseOrder.id]);

  // Mettre à jour les notes si la commande change
  useEffect(() => {
    if (purchaseOrder.notes) {
      setFormData(prev => ({ ...prev, notes: purchaseOrder.notes || '' }));
    }
  }, [purchaseOrder.notes]);

  // Recalculer automatiquement le prix unitaire quand le cours de change ou les frais de transit changent
  useEffect(() => {
    if (purchaseOrder.currency !== 'MGA' && formData.exchange_rate_mga && receiptItems.length > 0 && orderItems.length > 0) {
      setReceiptItems(prevItems => {
        let hasChanges = false;
        const updatedItems = prevItems.map(item => {
          const calculatedPrice = calculateUnitPriceWithTransit(item);
          
          if (calculatedPrice !== null) {
            // Vérifier si le prix actuel est différent du prix calculé (avec une petite tolérance pour éviter les boucles)
            if (Math.abs(item.unit_price - calculatedPrice) > 0.01) {
              hasChanges = true;
              return {
                ...item,
                unit_price: calculatedPrice,
                total_price: item.quantity_received * calculatedPrice
              };
            }
          }
          return item;
        });
        
        return hasChanges ? updatedItems : prevItems;
      });
    }
  }, [formData.exchange_rate_mga]);

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
      
      // Mapper les données de la jointure vers product_name et product_sku
      // Supabase peut retourner products comme un objet ou un tableau selon la relation
      const items = (data || []).map((item: any) => {
        const product = Array.isArray(item.products) ? item.products[0] : item.products;
        return {
          ...item,
          product_name: product?.name || '',
          product_sku: product?.sku || ''
        };
      });
      
      setOrderItems(items);
      
      // Initialiser les articles de réception avec les quantités restantes à recevoir
      // Note: transit_cost sera calculé automatiquement par le trigger SQL lors de la sauvegarde
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
          transit_cost: 0, // Sera calculé automatiquement par le trigger SQL
          batch_number: '',
          expiry_date: '',
          notes: ''
        }));
      
      setReceiptItems(initialReceiptItems);
      
      // Calculer et afficher le transit_cost pour prévisualisation si tracking_number existe
      // Note: On attend que le cours de change soit saisi avant de calculer le prix minimum
      // Le transit_cost sera calculé, mais le prix unitaire ne sera ajusté qu'après saisie du cours de change
      if (purchaseOrder.tracking_number) {
        calculateTransitCostPreview(purchaseOrder.tracking_number, initialReceiptItems);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des articles:', error);
    } finally {
      setItemsLoading(false);
    }
  };

  const updateReceiptItem = (index: number, field: string, value: any) => {
    const updatedItems = [...receiptItems];
    const currentItem = updatedItems[index];
    
    // Si on modifie le prix unitaire et qu'un cours de change est défini, 
    // la valeur saisie est en MGA, on doit la convertir en devise originale pour stockage
    if (field === 'unit_price') {
      let priceInOriginalCurrency: number;
      
      if (purchaseOrder.currency !== 'MGA' && formData.exchange_rate_mga) {
        // La valeur saisie est en MGA, on convertit en devise originale
        priceInOriginalCurrency = value / formData.exchange_rate_mga;
      } else {
        priceInOriginalCurrency = value;
      }
      
      // Calculer le prix unitaire attendu (prix d'achat × cours de change + frais de transit)
      const calculatedPrice = calculateUnitPriceWithTransit(currentItem);
      
      // S'assurer que le prix saisi n'est pas inférieur au prix calculé
      if (calculatedPrice !== null && priceInOriginalCurrency < calculatedPrice) {
        // Ajuster au prix calculé si inférieur
        priceInOriginalCurrency = calculatedPrice;
      }
      
      updatedItems[index] = { ...currentItem, unit_price: priceInOriginalCurrency };
    } else {
      updatedItems[index] = { ...currentItem, [field]: value };
    }
    
    if (field === 'quantity_received' || field === 'unit_price') {
      updatedItems[index].total_price = updatedItems[index].quantity_received * updatedItems[index].unit_price;
    }
    
    setReceiptItems(updatedItems);
  };

  // Calculer le prix unitaire avec frais de transit inclus (prix d'achat × cours de change + frais de transit)
  const calculateUnitPriceWithTransit = (item: ReceiptItem): number | null => {
    // Récupérer le prix d'achat original depuis la commande
    const orderItem = orderItems.find(oi => oi.id === item.purchase_order_item_id);
    if (!orderItem) {
      return null;
    }
    
    // Si pas de cours de change et devise n'est pas MGA, on ne peut pas calculer
    if (purchaseOrder.currency !== 'MGA' && !formData.exchange_rate_mga) {
      return null;
    }
    
    // Le prix d'achat original en MGA
    const purchasePriceInMGA = purchaseOrder.currency !== 'MGA' && formData.exchange_rate_mga
      ? orderItem.unit_price * formData.exchange_rate_mga
      : orderItem.unit_price;
    
    // Si pas de frais de transit, retourner juste le prix d'achat en MGA
    if (!item.transit_cost || item.transit_cost === 0) {
      // Convertir en devise originale si nécessaire pour le stockage
      if (purchaseOrder.currency !== 'MGA' && formData.exchange_rate_mga) {
        return purchasePriceInMGA / formData.exchange_rate_mga;
      }
      return purchasePriceInMGA;
    }
    
    // Prix unitaire = prix d'achat + frais de transit (tout en MGA)
    const unitPriceInMGA = purchasePriceInMGA + item.transit_cost;
    
    // Convertir en devise originale si nécessaire pour le stockage
    if (purchaseOrder.currency !== 'MGA' && formData.exchange_rate_mga) {
      return unitPriceInMGA / formData.exchange_rate_mga;
    }
    
    return unitPriceInMGA;
  };

  // Obtenir le prix unitaire calculé à afficher (en MGA)
  const getDisplayCalculatedUnitPrice = (item: ReceiptItem): number | null => {
    const calculatedPrice = calculateUnitPriceWithTransit(item);
    if (calculatedPrice === null) return null;
    
    // Convertir en MGA pour affichage
    if (purchaseOrder.currency !== 'MGA' && formData.exchange_rate_mga) {
      return calculatedPrice * formData.exchange_rate_mga;
    }
    return calculatedPrice;
  };

  // Obtenir le prix unitaire à afficher (en MGA si cours de change, sinon en devise originale)
  const getDisplayUnitPrice = (unitPrice: number): number => {
    if (purchaseOrder.currency !== 'MGA' && formData.exchange_rate_mga) {
      return unitPrice * formData.exchange_rate_mga;
    }
    return unitPrice;
  };

  // Le total est déjà en MGA si un cours de change est fourni, donc cette fonction n'est plus nécessaire
  // Le totalAmount est déjà calculé en MGA dans ce cas

  const removeReceiptItem = (index: number) => {
    setReceiptItems(receiptItems.filter((_, i) => i !== index));
  };

  // Fonction pour calculer le transit_cost en prévisualisation
  const calculateTransitCostPreview = async (trackingNumber: string, items: ReceiptItem[]) => {
    try {
      // Récupérer le coût total du tracking number
      const { data: trackingData, error: trackingError } = await supabase
        .from('tracking_numbers')
        .select('total_cost_mga')
        .eq('tracking_number', trackingNumber)
        .single();
      
      if (trackingError || !trackingData || !trackingData.total_cost_mga) {
        return; // Pas de coût disponible
      }
      
      // Compter le nombre total de produits dans toutes les commandes ayant ce tracking_number
      const { data: ordersData, error: ordersError } = await supabase
        .from('purchase_orders')
        .select('id')
        .eq('tracking_number', trackingNumber);
      
      if (ordersError || !ordersData || ordersData.length === 0) {
        return;
      }
      
      const orderIds = ordersData.map(o => o.id);
      
      const { count: productsCount, error: countError } = await supabase
        .from('purchase_order_items')
        .select('*', { count: 'exact', head: true })
        .in('purchase_order_id', orderIds);
      
      if (countError || !productsCount || productsCount === 0) {
        return;
      }
      
      // Calculer le frais de transit par produit
      const transitCostPerProduct = trackingData.total_cost_mga / productsCount;
      
      // Mettre à jour les items avec le transit_cost calculé
      // Le prix unitaire sera ajusté automatiquement si un cours de change est défini
      setReceiptItems(prevItems => 
        prevItems.map(item => {
          const updatedItem = {
            ...item,
            transit_cost: transitCostPerProduct
          };
          
          // Si un cours de change est défini, calculer automatiquement le nouveau prix unitaire
          if (purchaseOrder.currency !== 'MGA' && formData.exchange_rate_mga) {
            const calculatedPrice = calculateUnitPriceWithTransit(updatedItem);
            if (calculatedPrice !== null) {
              return {
                ...updatedItem,
                unit_price: calculatedPrice,
                total_price: item.quantity_received * calculatedPrice
              };
            }
          }
          
          return updatedItem;
        })
      );
    } catch (error) {
      console.error('Erreur lors du calcul du transit_cost:', error);
    }
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
        exchange_rate_mga: formData.exchange_rate_mga || null,
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
      // Note: transit_cost sera calculé automatiquement par le trigger SQL
      const itemsToInsert = receiptItems.map(item => ({
        receipt_id: receipt.id,
        purchase_order_item_id: item.purchase_order_item_id,
        product_id: item.product_id,
        quantity_received: item.quantity_received,
        unit_price: item.unit_price,
        total_price: item.total_price,
        // transit_cost sera calculé automatiquement par le trigger calculate_transit_cost()
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

  // Calculer le total en utilisant le prix unitaire affiché (qui inclut les frais de transit)
  const totalAmount = receiptItems.reduce((sum, item) => {
    const displayUnitPrice = getDisplayUnitPrice(item.unit_price);
    return sum + (item.quantity_received * displayUnitPrice);
  }, 0);

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 p-4 sm:p-6 border-b">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-bold truncate">{t('supply.createReceipt')}</h2>
            <p className="text-sm sm:text-base text-gray-600 truncate">{purchaseOrder.order_number}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-3 sm:p-4 md:p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Informations générales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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

            {purchaseOrder.currency !== 'MGA' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('supply.exchangeRateMGA')} ({purchaseOrder.currency} → MGA)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.exchange_rate_mga || ''}
                  onChange={(e) => setFormData({...formData, exchange_rate_mga: e.target.value ? parseFloat(e.target.value) : undefined})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder={`Taux de change ${purchaseOrder.currency} vers MGA`}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Taux de change {purchaseOrder.currency} vers MGA
                </div>
              </div>
            )}
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
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        {t('supply.product')}
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                        {t('supply.quantityReceived')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        {t('supply.unitPrice')} {purchaseOrder.currency !== 'MGA' && formData.exchange_rate_mga ? '(MGA)' : `(${purchaseOrder.currency})`}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                        {t('supply.total')} {purchaseOrder.currency !== 'MGA' && formData.exchange_rate_mga ? '(MGA)' : `(${purchaseOrder.currency})`}
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider w-16">
                        {t('common.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {receiptItems.map((item, index) => {
                      const orderItem = orderItems.find(oi => oi.id === item.purchase_order_item_id);
                      const maxQuantity = orderItem ? orderItem.quantity_ordered - orderItem.quantity_received : 0;
                      const calculatedPrice = getDisplayCalculatedUnitPrice(item);
                      const displayPrice = getDisplayUnitPrice(item.unit_price);
                      const isAtCalculated = calculatedPrice !== null && Math.abs(displayPrice - calculatedPrice) < 0.01;
                      const displayUnitPrice = getDisplayUnitPrice(item.unit_price);
                      const totalInDisplayCurrency = item.quantity_received * displayUnitPrice;
                      
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          {/* Produit */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">
                              {item.product_name}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              SKU: {item.product_sku}
                            </div>
                            <div className="text-xs text-gray-500">
                              {t('supply.maxQuantity')}: {maxQuantity}
                            </div>
                          </td>
                          
                          {/* Quantité */}
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            <input
                              type="number"
                              min="1"
                              max={maxQuantity}
                              value={item.quantity_received}
                              onChange={(e) => updateReceiptItem(index, 'quantity_received', parseInt(e.target.value))}
                              className="w-20 mx-auto border border-gray-300 rounded-md px-3 py-2 text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </td>
                          
                          {/* Prix unitaire */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="relative">
                              <input
                                type="number"
                                step="0.01"
                                min={calculatedPrice !== null ? calculatedPrice : 0}
                                value={displayPrice}
                                onChange={(e) => {
                                  const inputValue = parseFloat(e.target.value) || 0;
                                  updateReceiptItem(index, 'unit_price', inputValue);
                                }}
                                className={`w-full border rounded-md px-3 py-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                  calculatedPrice !== null && displayPrice < calculatedPrice
                                    ? 'border-red-500 bg-red-50'
                                    : isAtCalculated
                                    ? 'border-green-500 bg-green-50'
                                    : 'border-gray-300'
                                }`}
                              />
                              {(() => {
                                const orderItem = orderItems.find(oi => oi.id === item.purchase_order_item_id);
                                
                                if (calculatedPrice !== null && orderItem) {
                                  const purchasePriceInMGA = purchaseOrder.currency !== 'MGA' && formData.exchange_rate_mga
                                    ? orderItem.unit_price * formData.exchange_rate_mga
                                    : orderItem.unit_price;
                                  
                                  const tooltipText = `${orderItem.unit_price.toFixed(2)} ${purchaseOrder.currency}${
                                    purchaseOrder.currency !== 'MGA' && formData.exchange_rate_mga 
                                      ? ` × ${formData.exchange_rate_mga} = ${purchasePriceInMGA.toFixed(2)} MGA` 
                                      : ''
                                  }${item.transit_cost > 0 ? ` + ${item.transit_cost.toFixed(2)} MGA (transit) = ${calculatedPrice.toFixed(2)} MGA` : ''}`;
                                  
                                  return (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 group">
                                      <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
                                      <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block z-50 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg">
                                        {tooltipText}
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                            {calculatedPrice !== null && displayPrice < calculatedPrice && (
                              <div className="text-xs text-red-600 font-semibold mt-1">
                                ⚠ Min: {calculatedPrice.toFixed(2)} MGA
                              </div>
                            )}
                          </td>
                          
                          {/* Total */}
                          <td className="px-4 py-4 whitespace-nowrap text-right">
                            <div className="text-sm font-semibold text-gray-900">
                              {totalInDisplayCurrency.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {purchaseOrder.currency !== 'MGA' && formData.exchange_rate_mga ? 'MGA' : purchaseOrder.currency}
                            </div>
                          </td>
                          
                          {/* Actions */}
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            <button
                              type="button"
                              onClick={() => removeReceiptItem(index)}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-md transition-colors"
                              title={t('app.delete')}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Total */}
          <div className="bg-green-50 p-4 rounded-lg mb-6">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">{t('supply.totalAmount')}:</span>
              <span className="text-xl font-bold text-green-600">
                {totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {purchaseOrder.currency !== 'MGA' && formData.exchange_rate_mga ? 'MGA' : purchaseOrder.currency}
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

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { PurchaseOrder, PurchaseOrderItem, User } from '../../types';
import { X, Edit, Package, Calendar, DollarSign, Truck, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ReceiptForm } from './ReceiptForm';

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

  useEffect(() => {
    fetchOrderItems();
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

  const canCreateReceipt = order.status === 'ordered' || order.status === 'partial';
  const hasUnreceivedItems = items.some(item => item.quantity_received < item.quantity_ordered);

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
      </div>
    </>
  );
};

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { PurchaseOrder, User } from '../../types';
import { Plus, Search, Eye, Edit, Package, RefreshCw, DollarSign, AlertCircle, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PurchaseOrderForm } from './PurchaseOrderForm';
import { PurchaseOrderDetails } from './PurchaseOrderDetails';
import { DeliveryProgressBar } from './DeliveryProgressBar';

interface PurchaseOrdersListProps {
  user: User;
  onNavigateToCreate?: () => void;
}

export const PurchaseOrdersList: React.FC<PurchaseOrdersListProps> = ({ user, onNavigateToCreate }) => {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [viewingOrder, setViewingOrder] = useState<PurchaseOrder | null>(null);

  useEffect(() => {
    fetchOrders(true); // Chargement initial
  }, []);

  const fetchOrders = async (isInitialLoad = false) => {
    try {
      // Pour le chargement initial, on utilise loading (cache toute la page)
      // Pour les rafraîchissements, on utilise refreshing (cache seulement le tableau)
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          purchase_order_items (
            id,
            product_id,
            quantity_ordered,
            quantity_received,
            unit_price,
            total_price,
            products (
              name,
              sku
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des commandes:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const searchLower = searchTerm.toLowerCase();
    
    // Recherche dans les champs de base de la commande
    const matchesOrderFields = order.order_number.toLowerCase().includes(searchLower) ||
                               order.supplier_name?.toLowerCase().includes(searchLower) ||
                               order.tracking_number?.toLowerCase().includes(searchLower);
    
    // Recherche dans les produits de la commande
    const matchesProduct = order.purchase_order_items?.some((item: any) => {
      const product = Array.isArray(item.products) ? item.products[0] : item.products;
      if (!product) return false;
      return product.name?.toLowerCase().includes(searchLower) ||
             product.sku?.toLowerCase().includes(searchLower);
    }) || false;
    
    const matchesSearch = matchesOrderFields || matchesProduct;
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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

  // Calculer les statistiques
  const stats = {
    total: filteredOrders.length,
    totalAmount: filteredOrders.reduce((sum, order) => sum + order.total_amount, 0),
    overdue: filteredOrders.filter(order => {
      if (!order.expected_delivery_date) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expectedDate = new Date(order.expected_delivery_date);
      expectedDate.setHours(0, 0, 0, 0);
      return expectedDate < today && order.status !== 'received' && order.status !== 'cancelled';
    }).length,
    ordered: filteredOrders.filter(order => order.status === 'ordered').length,
  };

  // Devise la plus utilisée (ou MGA par défaut)
  const mainCurrency = filteredOrders.length > 0 
    ? filteredOrders[0].currency 
    : 'MGA';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{t('supply.title')}</h1>
          <p className="text-sm sm:text-base text-gray-600">{t('supply.subtitle')}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => fetchOrders(false)}
            disabled={refreshing}
            className="bg-gray-100 text-gray-700 px-2 sm:px-4 py-2 rounded-md hover:bg-gray-200 flex items-center gap-1 sm:gap-2 disabled:opacity-50"
            title={t('app.refresh') || 'Rafraîchir'}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('app.refresh')}</span>
          </button>
          <button
            onClick={() => {
              if (onNavigateToCreate) {
                onNavigateToCreate();
              } else {
                setShowForm(true);
              }
            }}
            className="bg-blue-600 text-white px-2 sm:px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-1 sm:gap-2 text-sm sm:text-base whitespace-nowrap"
          >
            <Plus className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">{t('supply.createOrder')}</span>
            <span className="sm:hidden">Créer</span>
          </button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{t('supply.totalOrders') || 'Total commandes'}</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="bg-blue-100 p-2 sm:p-3 rounded-full flex-shrink-0 ml-2">
              <Package className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{t('supply.totalAmount')}</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 truncate">
                {stats.totalAmount.toLocaleString()} {mainCurrency}
              </p>
            </div>
            <div className="bg-green-100 p-2 sm:p-3 rounded-full flex-shrink-0 ml-2">
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{t('supply.ordered') || 'Commandées'}</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stats.ordered}</p>
            </div>
            <div className="bg-blue-100 p-2 sm:p-3 rounded-full flex-shrink-0 ml-2">
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{t('supply.overdue') || 'En retard'}</p>
              <p className="text-xl sm:text-2xl font-bold text-red-600 mt-1">{stats.overdue}</p>
            </div>
            <div className="bg-red-100 p-2 sm:p-3 rounded-full flex-shrink-0 ml-2">
              <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder={t('supply.searchOrders') + ' (numéro, fournisseur, produit, SKU...)'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">{t('supply.allStatuses')}</option>
              <option value="draft">{t('supply.status.draft')}</option>
              <option value="pending">{t('supply.status.pending')}</option>
              <option value="ordered">{t('supply.status.ordered')}</option>
              <option value="partial">{t('supply.status.partial')}</option>
              <option value="received">{t('supply.status.received')}</option>
              <option value="cancelled">{t('supply.status.cancelled')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Liste des commandes - Mobile Card View */}
      <div className="md:hidden space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
              {t('supply.noOrders')}
            </h3>
            <p className="text-sm text-gray-500 mb-4 px-4">
              {t('supply.noOrdersDescription')}
            </p>
            <button
              onClick={() => {
                if (onNavigateToCreate) {
                  onNavigateToCreate();
                } else {
                  setShowForm(true);
                }
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
            >
              {t('supply.createFirstOrder')}
            </button>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div key={order.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{order.order_number}</div>
                  <div className="text-xs text-gray-500 mt-1 truncate">{order.supplier_name || t('supply.noSupplier')}</div>
                </div>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ml-2 flex-shrink-0 ${getStatusColor(order.status)}`}>
                  {getStatusLabel(order.status)}
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span className="text-gray-900">{new Date(order.order_date).toLocaleDateString()}</span>
                </div>
                {order.expected_delivery_date && (
                  <div className="pt-1">
                    <DeliveryProgressBar order={order} compact={true} />
                  </div>
                )}
                {order.tracking_number && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Suivi:</span>
                    <span className="font-mono text-gray-700 bg-gray-50 px-2 py-1 rounded border text-xs">
                      {order.tracking_number}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-1 text-gray-600">
                    <Package className="h-3 w-3" />
                    <span>{order.purchase_order_items?.length || 0} {t('supply.items')}</span>
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {order.total_amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {order.currency}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => setViewingOrder(order)}
                    className="text-blue-600 hover:text-blue-900 text-xs font-medium flex items-center gap-1"
                  >
                    <Eye className="h-4 w-4" />
                    {t('app.view')}
                  </button>
                  {order.status === 'draft' && (
                    <>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => {
                          setEditingOrder(order);
                          setShowForm(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-900 text-xs font-medium flex items-center gap-1"
                      >
                        <Edit className="h-4 w-4" />
                        {t('app.edit')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        {refreshing && (
          <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {/* Liste des commandes - Desktop Table View */}
      <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
        {refreshing && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {t('supply.noOrders')}
            </h3>
            <p className="text-gray-500 mb-4">
              {t('supply.noOrdersDescription')}
            </p>
            <button
              onClick={() => {
                if (onNavigateToCreate) {
                  onNavigateToCreate();
                } else {
                  setShowForm(true);
                }
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              {t('supply.createFirstOrder')}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    {t('supply.orderNumber')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    {t('supply.supplier')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      {t('supply.statut')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    {t('supply.orderDate')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    {t('deliveries.trackingNumber')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    {t('supply.totalAmount')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    {t('supply.items')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    {t('app.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-blue-50 transition-colors border-b border-gray-100">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {order.order_number}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {order.supplier_name || <span className="text-gray-400 italic">{t('supply.noSupplier')}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 mb-1">
                        {new Date(order.order_date).toLocaleDateString()}
                      </div>
                      {order.expected_delivery_date && (
                        <DeliveryProgressBar order={order} compact={true} />
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {order.tracking_number ? (
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-mono text-gray-700 bg-gray-50 px-2 py-1 rounded border">
                            {order.tracking_number}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {order.total_amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {order.currency}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 flex items-center gap-1">
                        <Package className="h-4 w-4 text-gray-400" />
                        {order.purchase_order_items?.length || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setViewingOrder(order)}
                          className="text-blue-600 hover:text-blue-900"
                          title={t('app.view')}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {order.status === 'draft' && (
                          <button
                            onClick={() => {
                              setEditingOrder(order);
                              setShowForm(true);
                            }}
                            className="text-indigo-600 hover:text-indigo-900"
                            title={t('app.edit')}
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Formulaires modaux */}
      {showForm && (
        <PurchaseOrderForm
          order={editingOrder}
          onClose={() => {
            setShowForm(false);
            setEditingOrder(null);
          }}
          onSave={() => {
            fetchOrders(false); // Rafraîchir seulement le tableau
            setShowForm(false);
            setEditingOrder(null);
          }}
          user={user}
        />
      )}

      {viewingOrder && (
        <PurchaseOrderDetails
          order={viewingOrder}
          onClose={() => {
            setViewingOrder(null);
            // Rafraîchir la liste après fermeture des détails (seulement le tableau)
            fetchOrders(false);
          }}
          onEdit={() => {
            setEditingOrder(viewingOrder);
            setViewingOrder(null);
            setShowForm(true);
          }}
          user={user}
        />
      )}
    </div>
  );
};

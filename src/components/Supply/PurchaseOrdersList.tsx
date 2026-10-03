import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { PurchaseOrder, User } from '../../types';
import { Plus, Eye, Edit, Package, RefreshCw, DollarSign, AlertCircle, TrendingUp, Archive } from 'lucide-react';
import { SearchField } from '../ui/SearchField';
import { useTranslation } from 'react-i18next';
import { PurchaseOrderForm } from './PurchaseOrderForm';
import { PurchaseOrderDetails } from './PurchaseOrderDetails';
import { PurchaseOrderCloseModal } from './PurchaseOrderCloseModal';
import { ReceiptForm } from './ReceiptForm';
import { DeliveryProgressBar } from './DeliveryProgressBar';
import { DataTable, dtTh, dtTd } from '../ui/DataTable';
import { formatDateDisplay } from '../../lib/dateUtils';

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
  const [closingOrder, setClosingOrder] = useState<PurchaseOrder | null>(null);
  const [closingOrders, setClosingOrders] = useState<PurchaseOrder[] | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<PurchaseOrder | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Flag pour éviter les chargements multiples au montage
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    // Ne charger qu'une seule fois au montage
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      fetchOrders(true); // Chargement initial
    }
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
          ),
          receipts (
            id,
            receipt_date,
            status
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
    const isOpen = order.status !== 'received' && order.status !== 'cancelled' && !order.closed_at;
    const isOverdue = (() => {
      if (!order.expected_delivery_date || !isOpen) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expectedDate = new Date(order.expected_delivery_date);
      expectedDate.setHours(0, 0, 0, 0);
      return expectedDate < today;
    })();
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'to_close'
          ? isOverdue && (order.status === 'ordered' || order.status === 'partial' || order.status === 'pending')
          : order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const canCloseOrder = (order: PurchaseOrder) =>
    (order.status === 'ordered' || order.status === 'partial' || order.status === 'pending') &&
    !order.closed_at;

  const closableFiltered = filteredOrders.filter(canCloseOrder);
  const selectedClosableOrders = filteredOrders.filter(
    (o) => selectedIds.has(o.id) && canCloseOrder(o)
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllClosable = () => {
    const allSelected =
      closableFiltered.length > 0 &&
      closableFiltered.every((o) => selectedIds.has(o.id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        closableFiltered.forEach((o) => next.delete(o.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        closableFiltered.forEach((o) => next.add(o.id));
        return next;
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-[var(--app-stripe)] app-text';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'ordered': return 'app-badge app-badge-info';
      case 'partial': return 'bg-orange-100 text-orange-800';
      case 'received': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-[var(--app-stripe)] app-text';
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
    totalItemsOrdered: filteredOrders.reduce((sum, order) => {
      const items = order.purchase_order_items || [];
      return sum + items.reduce((itemSum: number, item: any) => itemSum + (item.quantity_ordered || 0), 0);
    }, 0),
  };

  // Devise la plus utilisée (ou MGA par défaut)
  const mainCurrency = filteredOrders.length > 0 
    ? filteredOrders[0].currency 
    : 'MGA';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--app-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="app-sticky-chrome space-y-2">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="app-page-title truncate">{t('supply.title')}</h1>
          <p className="app-page-subtitle">{t('supply.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 flex-shrink-0 justify-end">
          {selectedClosableOrders.length > 0 && (
            <button
              type="button"
              onClick={() => setClosingOrders(selectedClosableOrders)}
              className="app-btn app-btn-sm"
              style={{ backgroundColor: 'var(--app-ink)', color: '#f8fafc' }}
            >
              <Archive className="h-3.5 w-3.5" />
              <span>
                {t('supply.close.bulkAction')} ({selectedClosableOrders.length})
              </span>
            </button>
          )}
          <button
            onClick={() => fetchOrders(false)}
            disabled={refreshing}
            className="app-btn app-btn-secondary app-btn-sm disabled:opacity-50"
            title={t('app.refresh') || 'Rafraîchir'}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
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
            className="app-btn app-btn-primary app-btn-sm whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">{t('supply.createOrder')}</span>
            <span className="sm:hidden">Créer</span>
          </button>
        </div>
      </div>

        <div className="app-toolbar">
          <SearchField
            className="min-w-[12rem]"
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t('supply.searchOrders') + ' (numéro, fournisseur, produit, SKU...)'}
            inputClassName="text-xs py-1.5"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="app-input text-xs py-1.5 w-auto sm:min-w-[12rem]"
          >
            <option value="all">{t('supply.allStatuses')}</option>
            <option value="to_close">{t('supply.toClose')}</option>
            <option value="draft">{t('supply.status.draft')}</option>
            <option value="pending">{t('supply.status.pending')}</option>
            <option value="ordered">{t('supply.status.ordered')}</option>
            <option value="partial">{t('supply.status.partial')}</option>
            <option value="received">{t('supply.status.received')}</option>
            <option value="cancelled">{t('supply.status.cancelled')}</option>
          </select>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="app-kpi">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--app-ink-muted)' }}>{t('supply.totalOrders') || 'Total commandes'}</p>
              <p className="text-lg font-semibold mt-0.5" style={{ color: 'var(--app-ink)' }}>{stats.total}</p>
            </div>
            <Package className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--app-ink-muted)' }} />
          </div>
        </div>

        <div className="app-kpi">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--app-ink-muted)' }}>{t('supply.totalAmount')}</p>
              <p className="text-lg font-semibold mt-0.5 truncate" style={{ color: 'var(--app-ink)' }}>
                {stats.totalAmount.toLocaleString()} {mainCurrency}
              </p>
            </div>
            <DollarSign className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--app-ink-muted)' }} />
          </div>
        </div>

        <div className="app-kpi">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--app-ink-muted)' }}>{t('supply.totalItemsOrdered') || 'Articles commandés'}</p>
              <p className="text-lg font-semibold mt-0.5" style={{ color: 'var(--app-ink)' }}>{stats.totalItemsOrdered}</p>
            </div>
            <TrendingUp className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--app-ink-muted)' }} />
          </div>
        </div>

        <div className="app-kpi">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--app-ink-muted)' }}>{t('supply.overdue') || 'En retard'}</p>
              <p className="text-lg font-semibold mt-0.5" style={{ color: 'var(--app-danger)' }}>{stats.overdue}</p>
            </div>
            <AlertCircle className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--app-danger)' }} />
          </div>
        </div>
      </div>

      {/* Liste des commandes - Mobile Card View */}
      <div className="md:hidden space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="app-empty">
            <Package className="h-12 w-12 app-text-muted mx-auto mb-4" />
            <h3 className="app-empty-title">
              {t('supply.noOrders')}
            </h3>
            <p className="app-empty-text mb-4">
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
              className="app-btn app-btn-primary"
            >
              {t('supply.createFirstOrder')}
            </button>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div key={order.id} className="app-list-card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold app-text truncate">{order.order_number}</div>
                  <div className="text-xs app-text-muted mt-1 truncate">{order.supplier_name || t('supply.noSupplier')}</div>
                </div>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ml-2 flex-shrink-0 ${getStatusColor(order.status)}`}>
                  {getStatusLabel(order.status)}
                </span>
              </div>
              <div className="space-y-2 text-xs pt-2 border-t app-divider">
                <div className="flex justify-between">
                  <span className="app-text-muted">Date:</span>
                  <span className="app-text">{formatDateDisplay(order.order_date)}</span>
                </div>
                {order.expected_delivery_date && (
                  <div className="pt-1">
                    <DeliveryProgressBar order={order} compact={true} />
                  </div>
                )}
                {order.tracking_number && (
                  <div className="flex justify-between items-center">
                    <span className="app-text-muted">Suivi:</span>
                    <span className="font-mono app-text-muted app-bg-muted px-2 py-1 rounded border text-xs">
                      {order.tracking_number}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t app-divider">
                  <div className="flex items-center gap-1 app-text-muted">
                    <Package className="h-3 w-3" />
                    <span>{order.purchase_order_items?.length || 0} {t('supply.items')}</span>
                  </div>
                  <div className="text-sm font-semibold app-text">
                    {order.total_amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {order.currency}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t app-divider">
                  <button
                    onClick={() => setViewingOrder(order)}
                    className="app-text-link text-xs font-medium flex items-center gap-1"
                  >
                    <Eye className="h-4 w-4" />
                    {t('app.view')}
                  </button>
                  {canCloseOrder(order) && (
                    <>
                      <span className="app-text-muted opacity-40">|</span>
                      <button
                        onClick={() => setClosingOrder(order)}
                        className="app-text hover:opacity-80 text-xs font-medium flex items-center gap-1"
                      >
                        <Archive className="h-4 w-4" />
                        {t('supply.close.action')}
                      </button>
                    </>
                  )}
                  {order.status === 'draft' && (
                    <>
                      <span className="app-text-muted opacity-40">|</span>
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--app-primary)]"></div>
          </div>
        )}
      </div>

      {/* Liste des commandes - Desktop Table View */}
      <div className="hidden md:block app-table-wrap relative">
        {refreshing && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--app-primary)]"></div>
          </div>
        )}
        {filteredOrders.length === 0 ? (
          <div className="app-empty">
            <Package className="h-12 w-12 app-text-muted mx-auto mb-4" />
            <h3 className="app-empty-title">
              {t('supply.noOrders')}
            </h3>
            <p className="app-empty-text mb-4">
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
              className="app-btn app-btn-primary"
            >
              {t('supply.createFirstOrder')}
            </button>
          </div>
        ) : (
          <DataTable>
              <thead className="app-bg-muted">
                <tr>
                  <th className={`${dtTh} w-10`}>
                    <input
                      type="checkbox"
                      checked={
                        closableFiltered.length > 0 &&
                        closableFiltered.every((o) => selectedIds.has(o.id))
                      }
                      onChange={toggleSelectAllClosable}
                      className="w-4 h-4 rounded border app-border accent-[var(--app-primary)]"
                      title={t('supply.close.selectClosable')}
                    />
                  </th>
                  <th className={dtTh}>{t('supply.orderNumber')}</th>
                  <th className={dtTh}>{t('supply.supplier')}</th>
                  <th className={dtTh}>{t('supply.statut')}</th>
                  <th className={dtTh}>{t('supply.orderDate')}</th>
                  <th className={dtTh}>{t('deliveries.trackingNumber')}</th>
                  <th className={dtTh}>{t('supply.totalAmount')}</th>
                  <th className={dtTh}>{t('supply.items')}</th>
                  <th className={dtTh}>{t('app.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--app-border)]">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-[var(--app-surface-muted)] transition-colors">
                    <td className={dtTd}>
                      {canCloseOrder(order) ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(order.id)}
                          onChange={() => toggleSelect(order.id)}
                          className="w-4 h-4 rounded border app-border accent-[var(--app-primary)]"
                        />
                      ) : (
                        <span className="inline-block w-4" />
                      )}
                    </td>
                    <td className={dtTd}>
                      <span className="font-semibold">{order.order_number}</span>
                    </td>
                    <td className={dtTd}>
                      {order.supplier_name || <span className="app-text-muted italic">{t('supply.noSupplier')}</span>}
                    </td>
                    <td className={dtTd}>
                      <span className={`inline-flex px-1.5 py-0.5 text-[11px] font-semibold rounded-full ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="text-xs app-text">
                        {formatDateDisplay(order.order_date)}
                      </div>
                      {order.expected_delivery_date && (
                        <DeliveryProgressBar order={order} compact={true} />
                      )}
                    </td>
                    <td className={dtTd}>
                      {order.tracking_number ? (
                        <span className="font-mono text-[11px] app-text-muted app-bg-muted px-1.5 py-0.5 rounded border">
                          {order.tracking_number}
                        </span>
                      ) : (
                        <span className="app-text-muted">-</span>
                      )}
                    </td>
                    <td className={dtTd}>
                      <span className="font-semibold">
                        {order.total_amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {order.currency}
                      </span>
                    </td>
                    <td className={dtTd}>
                      <span className="inline-flex items-center gap-1">
                        <Package className="h-3.5 w-3.5 app-text-muted" />
                        {order.purchase_order_items?.length || 0}
                      </span>
                    </td>
                    <td className={`${dtTd} font-medium`}>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setViewingOrder(order)}
                          className="app-text-link"
                          title={t('app.view')}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canCloseOrder(order) && (
                          <button
                            onClick={() => setClosingOrder(order)}
                            className="app-text-muted hover:app-text"
                            title={t('supply.close.action')}
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        )}
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
          </DataTable>
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

      {closingOrder && (
        <PurchaseOrderCloseModal
          order={closingOrder}
          items={(closingOrder.purchase_order_items || []) as any}
          user={user}
          onClose={() => setClosingOrder(null)}
          onComplete={() => {
            setClosingOrder(null);
            setSelectedIds((prev) => {
              const next = new Set(prev);
              next.delete(closingOrder.id);
              return next;
            });
            fetchOrders(false);
          }}
          onReceiveRemaining={() => {
            const order = closingOrder;
            setClosingOrder(null);
            setReceiptOrder(order);
          }}
        />
      )}

      {closingOrders && closingOrders.length > 0 && (
        <PurchaseOrderCloseModal
          orders={closingOrders}
          user={user}
          onClose={() => setClosingOrders(null)}
          onComplete={() => {
            const ids = new Set(closingOrders.map((o) => o.id));
            setClosingOrders(null);
            setSelectedIds((prev) => {
              const next = new Set(prev);
              ids.forEach((id) => next.delete(id));
              return next;
            });
            fetchOrders(false);
          }}
        />
      )}

      {receiptOrder && (
        <ReceiptForm
          purchaseOrder={receiptOrder}
          user={user}
          onClose={() => setReceiptOrder(null)}
          onSave={() => {
            setReceiptOrder(null);
            fetchOrders(false);
          }}
        />
      )}
    </div>
  );
};

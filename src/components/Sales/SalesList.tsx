import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit, CreditCard, Calendar as CalendarIcon, Truck, RotateCcw, RefreshCw } from 'lucide-react';
import { SearchField } from '../ui/SearchField';
import { useTranslation } from 'react-i18next';
import { SaleForm } from './SaleForm';
import { PaymentForm } from '../Payments/PaymentForm';
import { Calendar } from '../Common/Calendar';
import { DatePickerWithSales } from '../Common/DatePickerWithSales';
import { DeliveryForm } from '../Delivery/DeliveryForm';
import { ReturnItemsModal } from './ReturnItemsModal';
import { supabase } from '../../lib/supabase';
import { Sale, User } from '../../types';
import { formatDateToLocalString, formatDateDisplay, formatDateTimeDisplay } from '../../lib/dateUtils';
import { DataTable, dtTh, dtThRight, dtTd, dtTdMuted, dtTdWrap } from '../ui/DataTable';

interface SalesListProps {
  user: User;
}

export const SalesList: React.FC<SalesListProps> = ({ user }) => {
  const { t } = useTranslation();
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ongoing' | 'paid' | 'returned' | 'partially_returned'>('all');
  const [dateFilter, setDateFilter] = useState<string>(() => {
    // Par défaut, filtrer par la date du jour
    const today = new Date();
    return today.toISOString().split('T')[0]; // Format YYYY-MM-DD
  });
  const [showForm, setShowForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [salesByDate, setSalesByDate] = useState<Record<string, number>>({});

  // Flag pour éviter les chargements multiples au montage
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    // Ne charger qu'une seule fois au montage
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      fetchSales();
    }
  }, []);

  useEffect(() => {
    // Calculer les ventes par date pour le calendrier
    const salesByDateMap: Record<string, number> = {};
    sales.forEach(sale => {
      const date = formatDateToLocalString(new Date(sale.created_at));
      salesByDateMap[date] = (salesByDateMap[date] || 0) + 1;
    });
    setSalesByDate(salesByDateMap);
  }, [sales]);

  useEffect(() => {
    let filtered = sales;
    const hasSearchTerm = searchTerm.trim().length > 0;
    
    // Si il y a un terme de recherche, filtrer (client, téléphone, description ou produit)
    if (hasSearchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(sale => {
        // Recherche par client
        const clientMatch = sale.client && (
          `${sale.client.first_name} ${sale.client.last_name}`.toLowerCase().includes(lowerSearchTerm) ||
          sale.client.phone.includes(searchTerm)
        );
        
        // Recherche par description
        const descriptionMatch = sale.description.toLowerCase().includes(lowerSearchTerm);
        
        // Recherche par nom de produit dans les articles de vente
        const productMatch = sale.items?.some(item => 
          item.product_name?.toLowerCase().includes(lowerSearchTerm)
        );
        
        return clientMatch || descriptionMatch || productMatch;
      });
    }

    // Si il y a un filtre de statut, filtrer
    if (statusFilter !== 'all') {
      filtered = filtered.filter(sale => sale.status === statusFilter);
    }

    // Si il y a un filtre de date ET pas de terme de recherche, filtrer par date
    // Quand on recherche, on ignore le filtre de date pour permettre la recherche sur toutes les dates
    if (dateFilter && !hasSearchTerm) {
      filtered = filtered.filter(sale => {
        const saleDate = new Date(sale.created_at).toISOString().split('T')[0];
        return saleDate === dateFilter;
      });
    }

    setFilteredSales(filtered);
  }, [sales, searchTerm, statusFilter, dateFilter]);

  const fetchSales = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // D'abord, récupérer les ventes sans jointure pour voir les client_id
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });

      if (salesError) {
        setError(t('sales.fetchError') + ': ' + salesError.message);
        return;
      }

      // Ensuite, récupérer les clients séparément
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*');

      if (clientsError) {
        setError(t('sales.clientsFetchError') + ': ' + clientsError.message);
        return;
      }

      // Récupérer tous les paiements
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*');

      if (paymentsError) {
        setError(t('sales.paymentsFetchError') + ': ' + paymentsError.message);
        return;
      }

      // Récupérer toutes les livraisons
      const { data: deliveriesData, error: deliveriesError } = await supabase
        .from('deliveries')
        .select('*');

      if (deliveriesError) {
        console.error('Erreur lors de la récupération des livraisons:', deliveriesError.message);
      }

      // Récupérer tous les articles de vente (sale_items)
      const { data: saleItemsData, error: saleItemsError } = await supabase
        .from('sale_items')
        .select('*');

      if (saleItemsError) {
        console.error('Erreur lors de la récupération des articles de vente:', saleItemsError.message);
      }

      // Créer un map des clients par ID
      const clientsMap = new Map(clientsData?.map((client: any) => [client.id, client]) || []);

      // Créer un map des paiements par sale_id
      const paymentsMap = new Map();
      paymentsData?.forEach((payment: any) => {
        if (!paymentsMap.has(payment.sale_id)) {
          paymentsMap.set(payment.sale_id, []);
        }
        paymentsMap.get(payment.sale_id).push(payment);
      });

      // Créer un map des livraisons par sale_id (garder la plus récente)
      const deliveriesMap = new Map();
      deliveriesData?.forEach((delivery: any) => {
        const existing = deliveriesMap.get(delivery.sale_id);
        if (!existing || new Date(delivery.created_at) > new Date(existing.created_at)) {
          deliveriesMap.set(delivery.sale_id, delivery);
        }
      });

      // Créer un map des articles de vente par sale_id
      const saleItemsMap = new Map();
      saleItemsData?.forEach((item: any) => {
        if (!saleItemsMap.has(item.sale_id)) {
          saleItemsMap.set(item.sale_id, []);
        }
        saleItemsMap.get(item.sale_id).push(item);
      });

      // Associer les clients, paiements, livraisons et articles aux ventes
      const salesWithClients = salesData?.map((sale: any) => {
        const payments = paymentsMap.get(sale.id) || [];
        const totalPayments = payments.reduce((sum: number, payment: any) => sum + payment.amount, 0);

        return {
          ...sale,
          client: clientsMap.get(sale.client_id) || null,
          payments: payments,
          total_payments: totalPayments,
          delivery: deliveriesMap.get(sale.id) || null,
          items: saleItemsMap.get(sale.id) || []
        };
      }) || [];

      setSales(salesWithClients);
    } catch (error: any) {
      setError(t('sales.generalError') + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  };



  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'MGA',
    }).format(amount);
  };

  const handleCalendarDateClick = (date: Date) => {
    const dateStr = formatDateToLocalString(date);
    setDateFilter(dateStr);
    setShowCalendar(false);
  };

  const handleCreateDelivery = (sale: Sale) => {
    setSelectedSale(sale);
    setShowDeliveryForm(true);
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'paid':
        return { label: t('sales.status.paid'), className: 'app-badge app-badge-success' };
      case 'ongoing':
        return { label: t('sales.status.ongoing'), className: 'app-badge bg-yellow-100 text-yellow-800' };
      case 'returned':
        return { label: t('sales.status.returned'), className: 'app-badge app-badge-danger' };
      case 'partially_returned':
        return { label: t('sales.status.partially_returned'), className: 'app-badge bg-orange-100 text-orange-800' };
      default:
        return { label: t('sales.status.unknown'), className: 'app-badge' };
    }
  };

  const handleReturnSale = (sale: Sale) => {
    setSelectedSale(sale);
    setShowReturnModal(true);
  };

  const handleReturnSuccess = async () => {
    await fetchSales();
  };

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
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <div className="min-w-0">
            <h1 className="app-page-title">{t('sales.title')}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className={`app-btn app-btn-sm whitespace-nowrap ${showCalendar ? 'app-btn-primary' : 'app-btn-secondary'}`}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{showCalendar ? t('sales.calendar.hideCalendar') : t('sales.calendar.showCalendar')}</span>
            </button>

            <button
              onClick={fetchSales}
              className="app-btn app-btn-secondary app-btn-sm whitespace-nowrap"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('app.refresh')}</span>
            </button>

            <button
              onClick={() => {
                setSelectedSale(null);
                setShowForm(true);
              }}
              className="app-btn app-btn-primary app-btn-sm whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t('sales.newSale')}</span>
            </button>
          </div>
        </div>

        <div className="app-toolbar">
          <SearchField
            className="min-w-[12rem]"
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t('sales.searchPlaceholder')}
            inputClassName="text-xs py-1.5"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="app-input text-xs py-1.5 w-auto min-w-[10rem]"
          >
            <option value="all">{t('sales.filters.allStatuses')}</option>
            <option value="ongoing">{t('sales.status.ongoing')}</option>
            <option value="paid">{t('sales.status.paid')}</option>
            <option value="returned">{t('sales.status.returned')}</option>
            <option value="partially_returned">{t('sales.status.partially_returned')}</option>
          </select>
          <DatePickerWithSales
            value={dateFilter}
            onChange={setDateFilter}
            salesByDate={salesByDate}
            placeholder={t('sales.filters.dateFilter')}
            className="w-auto"
          />
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
              setDateFilter(new Date().toISOString().split('T')[0]);
            }}
            className="app-btn app-btn-secondary app-btn-sm whitespace-nowrap"
          >
            {t('sales.filters.clearFilters')}
          </button>
        </div>
      </div>

      {/* Calendrier des ventes */}
      {showCalendar && (
        <div className="mb-2">
          <Calendar
            dataByDate={salesByDate}
            onDateClick={handleCalendarDateClick}
            className="max-w-md mx-auto"
          />
        </div>
      )}

      {/* Status Display */}
      <div className="hidden md:flex app-surface px-3 py-2 items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 app-text-muted">
            <span>
              {t('sales.summary.totalSales')}: <span className="font-semibold app-text">{sales.length}</span>
            </span>
            <span>
              {t('sales.summary.displayed')}: <span className="font-semibold app-text">{filteredSales.length}</span>
            </span>
          </div>
          <div className="shrink-0 app-text-muted">
            {t('common.lastUpdate')}: {formatDateTimeDisplay(new Date())}
          </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-2 bg-red-50 border border-red-200 rounded-md p-3">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium app-text-danger">{t('sales.error.title')}</h3>
              <div className="mt-2 text-sm app-text-danger">
                <p>{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    fetchSales();
                  }}
                  className="mt-2 px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                >
                  {t('sales.error.retry')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Sales List - Mobile Card View */}
      <div className="md:hidden space-y-3">
        {filteredSales.map((sale) => {
          const statusDisplay = getStatusDisplay(sale.status);
          return (
            <div key={sale.id} className="app-list-card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[color-mix(in_srgb,var(--app-primary)_12%,var(--app-surface))] flex items-center justify-center flex-shrink-0">
                    <span className="app-text-link font-medium text-sm">
                      {sale.client ? `${sale.client.first_name?.[0] || ''}${sale.client.last_name?.[0] || ''}` : 'NC'}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium app-text truncate">
                      {sale.client ? `${sale.client.first_name || ''} ${sale.client.last_name || ''}` : t('sales.client.notFound')}
                    </div>
                    <div className="text-xs app-text-muted truncate">{sale.client?.phone || t('sales.client.phoneNotAvailable')}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-2">
                  {sale.status === 'ongoing' && (
                    <button
                      onClick={() => {
                        setSelectedSale(sale);
                        setShowPaymentForm(true);
                      }}
                      className="app-text-success hover:app-text-success transition-colors p-1"
                      title={t('sales.actions.addPayment')}
                    >
                      <CreditCard size={18} />
                    </button>
                  )}
                  {sale.status !== 'returned' && sale.status !== 'partially_returned' && (
                    <button
                      onClick={() => handleReturnSale(sale)}
                      className="app-text-danger hover:app-text-danger transition-colors p-1"
                      title={t('sales.actions.return')}
                    >
                      <RotateCcw size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => handleCreateDelivery(sale)}
                    className="text-orange-600 hover:text-orange-800 transition-colors p-1"
                    title={t('sales.actions.createDelivery')}
                  >
                    <Truck size={18} />
                  </button>
                  {user.role === 'admin' && (
                    <button
                      onClick={() => {
                        setSelectedSale(sale);
                        setShowForm(true);
                      }}
                      className="app-icon-btn"
                      title={t('common.edit')}
                      aria-label={t('common.edit')}
                    >
                      <Edit size={18} />
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-2 text-xs pt-2 border-t app-divider">
                <div className="app-text line-clamp-2">{sale.description}</div>
                <div className="space-y-1 pt-2 border-t app-divider">
                  <div className="flex justify-between">
                    <span className="app-text-muted">{t('sales.amounts.total')}:</span>
                    <span className="font-medium app-text">{formatCurrency(sale.total_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="app-text-muted">{t('sales.amounts.deposit')}:</span>
                    <span className="app-text-muted">{formatCurrency(sale.deposit)}</span>
                  </div>
                  {sale.total_payments && sale.total_payments > 0 && (
                    <div className="flex justify-between">
                      <span className="app-text-link">Paiements:</span>
                      <span className="app-text-link">{formatCurrency(sale.total_payments)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="app-text-muted">{t('sales.amounts.remaining')}:</span>
                    <span className={`font-medium ${sale.remaining_balance > 0 ? 'app-text-danger' : 'app-text-success'}`}>
                      {formatCurrency(sale.remaining_balance)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t app-divider">
                  <span className={`${statusDisplay.className}`}>
                    {statusDisplay.label}
                  </span>
                  <span className="app-text-muted">
                    {formatDateDisplay(sale.created_at)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {filteredSales.length === 0 && (
          <div className="app-empty">
            <p className="app-empty-text">
              {searchTerm || statusFilter !== 'all' ? t('sales.noSalesFound') : t('sales.noSales')}
            </p>
            <p className="app-empty-text mt-2">
              {t('sales.summary.totalSales')}: {sales.length} | {t('sales.summary.filteredSales')}: {filteredSales.length}
            </p>
          </div>
        )}
      </div>

      {/* Sales List - Desktop Table View */}
      <div className="hidden md:block app-table-wrap">
        <DataTable>
            <thead className="app-bg-muted">
              <tr>
                <th className={dtTh}>{t('sales.table.client')}</th>
                <th className={dtTh}>{t('common.description')}</th>
                <th className={dtTh}>{t('sales.table.amounts')}</th>
                <th className={dtTh}>{t('common.status')}</th>
                <th className={dtTh}>{t('common.date')}</th>
                <th className={dtThRight}>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-[var(--app-border)]">
              {filteredSales.map((sale) => {
                const statusDisplay = getStatusDisplay(sale.status);
                return (
                  <tr key={sale.id} className="hover:bg-[var(--app-surface-muted)] transition-colors">
                    <td className={dtTd}>
                      <div className="flex items-center">
                        <div className="w-7 h-7 rounded-full bg-[color-mix(in_srgb,var(--app-primary)_12%,var(--app-surface))] flex items-center justify-center flex-shrink-0">
                          <span className="app-text-link font-medium text-[11px]">
                            {sale.client ? `${sale.client.first_name?.[0] || ''}${sale.client.last_name?.[0] || ''}` : 'NC'}
                          </span>
                        </div>
                        <div className="ml-2 min-w-0">
                          <div className="font-medium truncate">
                            {sale.client ? `${sale.client.first_name || ''} ${sale.client.last_name || ''}` : t('sales.client.notFound')}
                          </div>
                          <div className="app-text-muted truncate">{sale.client?.phone || t('sales.client.phoneNotAvailable')}</div>
                        </div>
                      </div>
                    </td>
                    <td className={dtTdWrap}>
                      <div className="max-w-xs truncate">
                        {sale.description}
                      </div>
                    </td>
                    <td className={dtTdWrap}>
                      <div>
                        <div className="font-medium app-text">
                          {t('sales.amounts.total')}: {formatCurrency(sale.total_amount)}
                        </div>
                        <div className="app-text-muted">
                          {t('sales.amounts.deposit')}: {formatCurrency(sale.deposit)}
                        </div>
                        {sale.total_payments && sale.total_payments > 0 && (
                          <div className="app-text-link">
                            Paiements: {formatCurrency(sale.total_payments)}
                          </div>
                        )}
                        <div className={`font-medium ${sale.remaining_balance > 0 ? 'app-text-danger' : 'app-text-success'}`}>
                          {t('sales.amounts.remaining')}: {formatCurrency(sale.remaining_balance)}
                        </div>
                      </div>
                    </td>
                    <td className={dtTd}>
                      <span className={`${statusDisplay.className}`}>
                        {statusDisplay.label}
                      </span>
                    </td>
                    <td className={dtTdMuted}>
                      {formatDateDisplay(sale.created_at)}
                    </td>
                    <td className={`${dtTd} text-right font-medium`}>
                      <div className="flex items-center justify-end space-x-2">
                        {sale.status === 'ongoing' && (
                          <button
                            onClick={() => {
                              setSelectedSale(sale);
                              setShowPaymentForm(true);
                            }}
                            className="app-text-success hover:app-text-success transition-colors"
                            title={t('sales.actions.addPayment')}
                          >
                            <CreditCard size={14} />
                          </button>
                        )}
                        {sale.status !== 'returned' && sale.status !== 'partially_returned' && (
                          <button
                            onClick={() => handleReturnSale(sale)}
                            className="app-text-danger hover:app-text-danger transition-colors"
                            title={t('sales.actions.return')}
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}
                        {/* Bouton/Statut livraison */}
                        {sale.delivery ? (
                          // Afficher l'icône avec la couleur du statut
                          <span
                            className={`inline-flex items-center justify-center p-1.5 rounded-full ${
                              sale.delivery.status === 'pending' ? 'bg-yellow-100 text-yellow-600' :
                              sale.delivery.status === 'preparing' ? 'app-badge app-badge-info' :
                              sale.delivery.status === 'in_transit' ? 'bg-purple-100 text-purple-600' :
                              sale.delivery.status === 'delivered' ? 'app-badge app-badge-success' :
                              sale.delivery.status === 'failed' ? 'app-badge app-badge-danger' :
                              sale.delivery.status === 'cancelled' ? 'app-badge' :
                              'app-badge'
                            }`}
                            title={`${sale.delivery.delivery_number} - ${
                              sale.delivery.status === 'pending' ? 'En attente' :
                              sale.delivery.status === 'preparing' ? 'Préparation' :
                              sale.delivery.status === 'in_transit' ? 'En transit' :
                              sale.delivery.status === 'delivered' ? 'Livré' :
                              sale.delivery.status === 'failed' ? 'Échec' :
                              sale.delivery.status === 'cancelled' ? 'Annulé' : sale.delivery.status
                            }`}
                          >
                            <Truck size={14} />
                          </span>
                        ) : (
                          // Afficher le bouton pour créer une livraison
                          <button
                            onClick={() => handleCreateDelivery(sale)}
                            className="text-orange-600 hover:text-orange-800 transition-colors"
                            title={t('sales.actions.createDelivery')}
                          >
                            <Truck size={14} />
                          </button>
                        )}
                        {user.role === 'admin' && (
                          <button
                            onClick={() => {
                              setSelectedSale(sale);
                              setShowForm(true);
                            }}
                              className="app-icon-btn"
                              title={t('common.edit')}
                              aria-label={t('common.edit')}
                            >
                              <Edit size={14} />
                            </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
        </DataTable>

        {filteredSales.length === 0 && (
          <div className="app-empty">
            <p className="app-empty-text">
              {searchTerm || statusFilter !== 'all' ? t('sales.noSalesFound') : t('sales.noSales')}
            </p>
            <p className="text-xs app-text-muted mt-2">
              {t('sales.summary.totalSales')}: {sales.length} | {t('sales.summary.filteredSales')}: {filteredSales.length}
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <SaleForm
          sale={selectedSale || undefined}
          onClose={() => {
            setShowForm(false);
            setSelectedSale(null);
          }}
          onSubmit={() => {
            setShowForm(false);
            setSelectedSale(null);
            fetchSales();
          }}
        />
      )}

      {showPaymentForm && selectedSale && (
        <PaymentForm
          sale={selectedSale as Sale}
          onClose={() => {
            setShowPaymentForm(false);
            setSelectedSale(null);
          }}
          onSubmit={() => {
            setShowPaymentForm(false);
            setSelectedSale(null);
            fetchSales();
          }}
        />
      )}

      {showDeliveryForm && selectedSale && (
        <DeliveryForm
          user={user}
          onClose={() => {
            setShowDeliveryForm(false);
            setSelectedSale(null);
          }}
          onSave={() => {
            setShowDeliveryForm(false);
            setSelectedSale(null);
            fetchSales();
          }}
          prefillData={{
            client_id: selectedSale.client_id,
            sale_id: selectedSale.id,
            delivery_date: new Date().toISOString().split('T')[0],
            client_address: selectedSale.client?.address || ''
          }}
        />
      )}

      {showReturnModal && selectedSale && (
        <ReturnItemsModal
          sale={selectedSale}
          onClose={() => {
            setShowReturnModal(false);
            setSelectedSale(null);
          }}
          onSuccess={handleReturnSuccess}
        />
      )}
    </div>
  );
};
import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Edit, CreditCard, Calendar as CalendarIcon, Truck, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SaleForm } from './SaleForm';
import { PaymentForm } from '../Payments/PaymentForm';
import { Calendar } from '../Common/Calendar';
import { DatePickerWithSales } from '../Common/DatePickerWithSales';
import { DeliveryForm } from '../Delivery/DeliveryForm';
import { ReturnItemsModal } from './ReturnItemsModal';
import { supabase } from '../../lib/supabase';
import { Sale, User } from '../../types';
import { formatDateToLocalString } from '../../lib/dateUtils';

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
        return { label: t('sales.status.paid'), className: 'text-green-600 bg-green-100' };
      case 'ongoing':
        return { label: t('sales.status.ongoing'), className: 'text-yellow-600 bg-yellow-100' };
      case 'returned':
        return { label: t('sales.status.returned'), className: 'text-red-600 bg-red-100' };
      case 'partially_returned':
        return { label: t('sales.status.partially_returned'), className: 'text-orange-600 bg-orange-100' };
      default:
        return { label: t('sales.status.unknown'), className: 'text-gray-600 bg-gray-100' };
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
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">{t('sales.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:gap-0 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('sales.title')}</h1>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className={`flex items-center space-x-2 px-2 sm:px-3 py-2 rounded-md transition-colors text-sm sm:text-base ${showCalendar
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
          >
            <CalendarIcon size={18} className="sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">{showCalendar ? t('sales.calendar.hideCalendar') : t('sales.calendar.showCalendar')}</span>
          </button>

          <button
            onClick={fetchSales}
            className="flex items-center space-x-2 px-2 sm:px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm sm:text-base"
          >
            <span>🔄</span>
            <span className="hidden sm:inline">{t('app.refresh')}</span>
          </button>

          <button
            onClick={() => {
              setSelectedSale(null);
              setShowForm(true);
            }}
            className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm sm:text-base"
          >
            <Plus size={18} className="sm:w-5 sm:h-5" />
            <span>{t('sales.newSale')}</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('sales.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="flex-1 sm:flex-none px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
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
            className="flex-1 sm:flex-none min-w-[150px]"
          />
          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
              setDateFilter(new Date().toISOString().split('T')[0]);
            }}
            className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-sm sm:text-base whitespace-nowrap"
          >
            {t('sales.filters.clearFilters')}
          </button>
        </div>
      </div>

      {/* Calendrier des ventes */}
      {showCalendar && (
        <div className="mb-6">
          <Calendar
            dataByDate={salesByDate}
            onDateClick={handleCalendarDateClick}
            className="max-w-md mx-auto"
          />
        </div>
      )}

      {/* Status Display */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-blue-600 font-medium">{t('sales.summary.totalSales')}:</span>
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
                {sales.length}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-blue-600 font-medium">{t('sales.summary.displayed')}:</span>
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
                {filteredSales.length}
              </span>
            </div>
          </div>
          <div className="text-sm text-blue-600">
            {t('common.lastUpdate')}: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{t('sales.error.title')}</h3>
              <div className="mt-2 text-sm text-red-700">
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
            <div key={sale.id} className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-medium text-sm">
                      {sale.client ? `${sale.client.first_name?.[0] || ''}${sale.client.last_name?.[0] || ''}` : 'NC'}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {sale.client ? `${sale.client.first_name || ''} ${sale.client.last_name || ''}` : t('sales.client.notFound')}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{sale.client?.phone || t('sales.client.phoneNotAvailable')}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-2">
                  {sale.status === 'ongoing' && (
                    <button
                      onClick={() => {
                        setSelectedSale(sale);
                        setShowPaymentForm(true);
                      }}
                      className="text-green-600 hover:text-green-800 transition-colors p-1"
                      title={t('sales.actions.addPayment')}
                    >
                      <CreditCard size={18} />
                    </button>
                  )}
                  {sale.status !== 'returned' && sale.status !== 'partially_returned' && (
                    <button
                      onClick={() => handleReturnSale(sale)}
                      className="text-red-600 hover:text-red-800 transition-colors p-1"
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
                      className="text-yellow-600 hover:text-yellow-800 transition-colors p-1"
                      title={t('common.edit')}
                    >
                      <Edit size={18} />
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="text-gray-900 line-clamp-2">{sale.description}</div>
                <div className="space-y-1 pt-2 border-t border-gray-100">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('sales.amounts.total')}:</span>
                    <span className="font-medium text-gray-900">{formatCurrency(sale.total_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('sales.amounts.deposit')}:</span>
                    <span className="text-gray-500">{formatCurrency(sale.deposit)}</span>
                  </div>
                  {sale.total_payments && sale.total_payments > 0 && (
                    <div className="flex justify-between">
                      <span className="text-blue-600">Paiements:</span>
                      <span className="text-blue-600">{formatCurrency(sale.total_payments)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('sales.amounts.remaining')}:</span>
                    <span className={`font-medium ${sale.remaining_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(sale.remaining_balance)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusDisplay.className}`}>
                    {statusDisplay.label}
                  </span>
                  <span className="text-gray-500">
                    {new Date(sale.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {filteredSales.length === 0 && (
          <div className="text-center py-8 bg-white rounded-lg shadow-md">
            <p className="text-gray-500">
              {searchTerm || statusFilter !== 'all' ? t('sales.noSalesFound') : t('sales.noSales')}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              {t('sales.summary.totalSales')}: {sales.length} | {t('sales.summary.filteredSales')}: {filteredSales.length}
            </p>
          </div>
        )}
      </div>

      {/* Sales List - Desktop Table View */}
      <div className="hidden md:block bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('sales.table.client')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('common.description')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('sales.table.amounts')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('common.status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('common.date')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSales.map((sale) => {
                const statusDisplay = getStatusDisplay(sale.status);
                return (
                  <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-medium text-sm">
                            {sale.client ? `${sale.client.first_name?.[0] || ''}${sale.client.last_name?.[0] || ''}` : 'NC'}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {sale.client ? `${sale.client.first_name || ''} ${sale.client.last_name || ''}` : t('sales.client.notFound')}
                          </div>
                          <div className="text-sm text-gray-500">{sale.client?.phone || t('sales.client.phoneNotAvailable')}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {sale.description}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          {t('sales.amounts.total')}: {formatCurrency(sale.total_amount)}
                        </div>
                        <div className="text-gray-500">
                          {t('sales.amounts.deposit')}: {formatCurrency(sale.deposit)}
                        </div>
                        {sale.total_payments && sale.total_payments > 0 && (
                          <div className="text-blue-600">
                            Paiements: {formatCurrency(sale.total_payments)}
                          </div>
                        )}
                        <div className={`font-medium ${sale.remaining_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {t('sales.amounts.remaining')}: {formatCurrency(sale.remaining_balance)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusDisplay.className}`}>
                        {statusDisplay.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(sale.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {sale.status === 'ongoing' && (
                          <button
                            onClick={() => {
                              setSelectedSale(sale);
                              setShowPaymentForm(true);
                            }}
                            className="text-green-600 hover:text-green-800 transition-colors"
                            title={t('sales.actions.addPayment')}
                          >
                            <CreditCard size={18} />
                          </button>
                        )}
                        {sale.status !== 'returned' && sale.status !== 'partially_returned' && (
                          <button
                            onClick={() => handleReturnSale(sale)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                            title={t('sales.actions.return')}
                          >
                            <RotateCcw size={18} />
                          </button>
                        )}
                        {/* Bouton/Statut livraison */}
                        {sale.delivery ? (
                          // Afficher l'icône avec la couleur du statut
                          <span
                            className={`inline-flex items-center justify-center p-1.5 rounded-full ${
                              sale.delivery.status === 'pending' ? 'bg-yellow-100 text-yellow-600' :
                              sale.delivery.status === 'preparing' ? 'bg-blue-100 text-blue-600' :
                              sale.delivery.status === 'in_transit' ? 'bg-purple-100 text-purple-600' :
                              sale.delivery.status === 'delivered' ? 'bg-green-100 text-green-600' :
                              sale.delivery.status === 'failed' ? 'bg-red-100 text-red-600' :
                              sale.delivery.status === 'cancelled' ? 'bg-gray-100 text-gray-600' :
                              'bg-gray-100 text-gray-600'
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
                            <Truck size={18} />
                          </span>
                        ) : (
                          // Afficher le bouton pour créer une livraison
                          <button
                            onClick={() => handleCreateDelivery(sale)}
                            className="text-orange-600 hover:text-orange-800 transition-colors"
                            title={t('sales.actions.createDelivery')}
                          >
                            <Truck size={18} />
                          </button>
                        )}
                        {user.role === 'admin' && (
                          <button
                            onClick={() => {
                              setSelectedSale(sale);
                              setShowForm(true);
                            }}
                            className="text-yellow-600 hover:text-yellow-800 transition-colors"
                            title={t('common.edit')}
                          >
                            <Edit size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredSales.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">
              {searchTerm || statusFilter !== 'all' ? t('sales.noSalesFound') : t('sales.noSales')}
            </p>
            <p className="text-xs text-gray-400 mt-2">
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
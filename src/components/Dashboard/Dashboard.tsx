import React, { useState, useEffect } from 'react';
import { Euro, TrendingUp, Users, AlertCircle, CreditCard, Target, Calendar, Filter } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatCard } from './StatCard';
import { supabase } from '../../lib/supabase';
import { DashboardStats, Client, ClientWithSales } from '../../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats>({
    total_sales: 0,
    cash_sales: 0,
    credit_sales: 0,
    total_payments: 0,
    outstanding_debt: 0,
    total_clients: 0,
  });
  const [topClients, setTopClients] = useState<ClientWithSales[]>([]);
  const [loading, setLoading] = useState(true);

  // États pour le filtre de date
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'lastMonth' | 'custom'>('today');
  const [customDateRange, setCustomDateRange] = useState({
    from: '',
    to: ''
  });

  // États pour le graphique
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    console.log('📊 Dashboard: Initialisation du tableau de bord');
    initializeDateFilter();
  }, []);

  const initializeDateFilter = async () => {
    try {
      // Récupérer la date de la dernière vente
      const { data: lastSale, error } = await supabase
        .from('sales')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !lastSale) {
        console.log('📊 Dashboard: Aucune vente trouvée, utilisation du filtre par défaut');
        fetchDashboardData();
        return;
      }

      const lastSaleDate = new Date(lastSale.created_at);
      const today = new Date();

      // Si la dernière vente est d'aujourd'hui, utiliser le filtre "today"
      if (lastSaleDate.toDateString() === today.toDateString()) {
        setDateFilter('today');
      } else {
        // Sinon, utiliser un filtre personnalisé pour la date de la dernière vente
        setDateFilter('custom');
        setCustomDateRange({
          from: lastSaleDate.toISOString().split('T')[0],
          to: lastSaleDate.toISOString().split('T')[0]
        });
      }

      fetchDashboardData();
    } catch (error) {
      console.error('❌ Dashboard: Erreur lors de l\'initialisation du filtre de date:', error);
      fetchDashboardData();
    }
  };

  useEffect(() => {
    console.log('📊 Dashboard: Filtre de date changé, rechargement des données');
    fetchDashboardData();
    fetchChartData();
  }, [dateFilter, customDateRange]);

  const getDateRange = () => {
    const now = new Date();
    let fromDate: Date | null = null;
    let toDate: Date | null = null;

    switch (dateFilter) {
      case 'today':
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'week':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        fromDate = startOfWeek;
        toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'month':
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'lastMonth':
        fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        toDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      case 'custom':
        if (customDateRange.from && customDateRange.to) {
          fromDate = new Date(customDateRange.from);
          toDate = new Date(customDateRange.to);
          toDate.setHours(23, 59, 59, 999);
        }
        break;
      default:
        // 'all' - pas de filtre de date
        break;
    }

    return { fromDate, toDate };
  };

  const fetchDashboardData = async () => {
    console.log('📊 Dashboard: Début de la récupération des données');
    const startTime = performance.now();
    const { fromDate, toDate } = getDateRange();
    
    try {
      console.log('📊 Dashboard: Récupération des statistiques de ventes...');
      let salesQuery = supabase
        .from('sales')
        .select('total_amount, deposit, remaining_balance, status, created_at');

      if (fromDate && toDate) {
        salesQuery = salesQuery
          .gte('created_at', fromDate.toISOString())
          .lte('created_at', toDate.toISOString());
      }

      const { data: sales, error: salesError } = await salesQuery;

      if (salesError) {
        console.error('❌ Dashboard: Erreur récupération ventes:', salesError);
      } else {
        console.log(`✅ Dashboard: ${sales?.length || 0} ventes récupérées`);
      }

      console.log('📊 Dashboard: Récupération des statistiques de paiements...');
      let paymentsQuery = supabase
        .from('payments')
        .select('amount, created_at');

      if (fromDate && toDate) {
        paymentsQuery = paymentsQuery
          .gte('created_at', fromDate.toISOString())
          .lte('created_at', toDate.toISOString());
      }

      const { data: payments, error: paymentsError } = await paymentsQuery;

      if (paymentsError) {
        console.error('❌ Dashboard: Erreur récupération paiements:', paymentsError);
      } else {
        console.log(`✅ Dashboard: ${payments?.length || 0} paiements récupérés`);
      }

      console.log('📊 Dashboard: Récupération du nombre de clients...');
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id');

      if (clientsError) {
        console.error('❌ Dashboard: Erreur récupération clients:', clientsError);
      } else {
        console.log(`✅ Dashboard: ${clients?.length || 0} clients récupérés`);
      }

      console.log('📊 Dashboard: Récupération des meilleurs clients...');
      const { data: topClientsData, error: topClientsError } = await supabase
        .from('clients')
        .select(`
          *,
          sales(total_amount)
        `)
        .limit(5);

      if (topClientsError) {
        console.error('❌ Dashboard: Erreur récupération top clients:', topClientsError);
      } else {
        console.log(`✅ Dashboard: ${topClientsData?.length || 0} top clients récupérés`);
      }

      if (sales && payments && clients) {
        const totalSales = sales.reduce((sum, sale) => sum + sale.total_amount, 0);
        const cashSales = sales.filter(sale => sale.status === 'paid').reduce((sum, sale) => sum + sale.total_amount, 0);
        const creditSales = totalSales - cashSales;
        const totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);
        const outstandingDebt = sales.reduce((sum, sale) => sum + sale.remaining_balance, 0);

        setStats({
          total_sales: totalSales,
          cash_sales: cashSales,
          credit_sales: creditSales,
          total_payments: totalPayments,
          outstanding_debt: outstandingDebt,
          total_clients: clients.length,
        });
      }

      if (topClientsData) {
        console.log('📊 Dashboard: Traitement des meilleurs clients...');
        const processedTopClients = topClientsData
          .map(client => ({
            ...client,
            total_purchases: client.sales?.reduce((sum: number, sale: any) => sum + sale.total_amount, 0) || 0
          }))
          .filter(client => client.total_purchases > 0)
          .sort((a, b) => b.total_purchases - a.total_purchases)
          .slice(0, 5);
        setTopClients(processedTopClients);
        console.log(`✅ Dashboard: ${processedTopClients.length} meilleurs clients traités`);
      }
    } catch (error) {
      console.error('❌ Dashboard: Erreur lors de la récupération des données:', error);
    } finally {
      const endTime = performance.now();
      console.log(`⏱️ Dashboard: Récupération des données terminée en ${(endTime - startTime).toFixed(2)}ms`);
      setLoading(false);
    }
  };

  const fetchChartData = async () => {
    setChartLoading(true);
    const { fromDate, toDate } = getDateRange();

    try {
      let salesQuery = supabase
        .from('sales')
        .select('total_amount, deposit, remaining_balance, status, created_at')
        .order('created_at', { ascending: true });

      if (fromDate && toDate) {
        salesQuery = salesQuery
          .gte('created_at', fromDate.toISOString())
          .lte('created_at', toDate.toISOString());
      }

      const { data: sales, error } = await salesQuery;

      if (error) {
        console.error('❌ Dashboard: Erreur récupération données graphique:', error);
        return;
      }

      if (!sales || sales.length === 0) {
        setChartData([]);
        return;
      }

      // Grouper les ventes par jour
      const salesByDay = sales.reduce((acc: any, sale) => {
        const date = new Date(sale.created_at).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = {
            date,
            cashSales: 0,
            creditSales: 0,
            totalRevenue: 0
          };
        }

        acc[date].totalRevenue += sale.total_amount;
        if (sale.status === 'paid') {
          acc[date].cashSales += sale.total_amount;
        } else {
          acc[date].creditSales += sale.total_amount;
        }

        return acc;
      }, {});

      // Convertir en tableau et trier par date
      const chartDataArray = Object.values(salesByDay)
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setChartData(chartDataArray);
    } catch (error) {
      console.error('❌ Dashboard: Erreur lors de la récupération des données du graphique:', error);
    } finally {
      setChartLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'MGA',
    }).format(amount);
  };

  const getTrustRatingColor = (rating: string) => {
    switch (rating) {
      case 'good': return 'text-green-600 bg-green-100';
      case 'average': return 'text-yellow-600 bg-yellow-100';
      case 'poor': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTrustRatingLabel = (rating: string) => {
    switch (rating) {
      case 'good': return t('common.goodPayer');
      case 'average': return t('common.averagePayer');
      case 'poor': return t('common.poorPayer');
      default: return t('common.notEvaluated');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h1>
        <div className="text-sm text-gray-500">
          {t('common.lastUpdate')}: {new Date().toLocaleString()}
        </div>
      </div>

      {/* Filtre de date */}
      <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter size={20} className="text-gray-600" />
            <span className="text-sm font-medium text-gray-700">{t('dashboard.filters.dateRange')}:</span>
          </div>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">{t('dashboard.filters.allTime')}</option>
            <option value="today">{t('dashboard.filters.today')}</option>
            <option value="week">{t('dashboard.filters.thisWeek')}</option>
            <option value="month">{t('dashboard.filters.thisMonth')}</option>
            <option value="lastMonth">{t('dashboard.filters.lastMonth')}</option>
            <option value="custom">{t('dashboard.filters.custom')}</option>
          </select>

          {dateFilter === 'custom' && (
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={customDateRange.from}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, from: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={t('dashboard.filters.fromDate')}
              />
              <span className="text-gray-500">-</span>
              <input
                type="date"
                value={customDateRange.to}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, to: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={t('dashboard.filters.toDate')}
              />
            </div>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title={t('dashboard.totalSales')}
          value={formatCurrency(stats.total_sales)}
          icon={Euro}
          color="blue"
          subtitle={t('dashboard.allSales')}
        />
        <StatCard
          title={t('dashboard.cashSales')}
          value={formatCurrency(stats.cash_sales)}
          icon={TrendingUp}
          color="green"
          subtitle={t('dashboard.immediatePayments')}
        />
        <StatCard
          title={t('dashboard.creditSales')}
          value={formatCurrency(stats.credit_sales)}
          icon={CreditCard}
          color="yellow"
          subtitle={t('dashboard.withRemainingBalance')}
        />
        <StatCard
          title={t('dashboard.totalPayments')}
          value={formatCurrency(stats.total_payments)}
          icon={Target}
          color="purple"
          subtitle={t('dashboard.receivedPayments')}
        />
        <StatCard
          title={t('dashboard.outstandingDebt')}
          value={formatCurrency(stats.outstanding_debt)}
          icon={AlertCircle}
          color="red"
          subtitle={t('dashboard.unpaidAmounts')}
        />
        <StatCard
          title={t('dashboard.totalClients')}
          value={stats.total_clients}
          icon={Users}
          color="blue"
          subtitle={t('dashboard.registeredClients')}
        />
      </div>

      {/* Graphique d'évolution des ventes */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">{t('dashboard.chart.title')}</h2>
          {chartLoading && (
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span>Chargement...</span>
            </div>
          )}
        </div>

        {chartData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                />
                <YAxis
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [formatCurrency(value), t(`dashboard.chart.${name}`)]}
                  labelFormatter={(value) => new Date(value).toLocaleDateString('fr-FR')}
                />
                <Legend
                  formatter={(value) => t(`dashboard.chart.${value}`)}
                />
                <Line
                  type="monotone"
                  dataKey="cashSales"
                  stroke="#10B981"
                  strokeWidth={2}
                  name="cashSales"
                />
                <Line
                  type="monotone"
                  dataKey="creditSales"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  name="creditSales"
                />
                <Line
                  type="monotone"
                  dataKey="totalRevenue"
                  stroke="#3B82F6"
                  strokeWidth={3}
                  name="totalRevenue"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-80 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">{t('dashboard.chart.noData')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Top Clients */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.topClients')}</h2>
        <div className="space-y-3">
          {topClients.map((client) => (
            <div key={client.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {client.first_name} {client.last_name}
                  </p>
                  <p className="text-sm text-gray-500">{client.phone}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">
                  {formatCurrency(client.total_purchases)}
                </p>
                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getTrustRatingColor(client.trust_rating)}`}>
                  {getTrustRatingLabel(client.trust_rating)}
                </span>
              </div>
            </div>
          ))}
          {topClients.length === 0 && (
            <p className="text-gray-500 text-center py-4">{t('clients.noClients')}</p>
          )}
        </div>
      </div>
    </div>
  );
};
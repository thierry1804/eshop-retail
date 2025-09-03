import React, { useState, useEffect } from 'react';
import { Euro, TrendingUp, Users, AlertCircle, CreditCard, Target } from 'lucide-react';
import { StatCard } from './StatCard';
import { supabase } from '../../lib/supabase';
import { DashboardStats, Client, ClientWithSales } from '../../types';

export const Dashboard: React.FC = () => {
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

  useEffect(() => {
    console.log('📊 Dashboard: Initialisation du tableau de bord');
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    console.log('📊 Dashboard: Début de la récupération des données');
    const startTime = performance.now();
    
    try {
      console.log('📊 Dashboard: Récupération des statistiques de ventes...');
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('total_amount, deposit, remaining_balance, status');

      if (salesError) {
        console.error('❌ Dashboard: Erreur récupération ventes:', salesError);
      } else {
        console.log(`✅ Dashboard: ${sales?.length || 0} ventes récupérées`);
      }

      console.log('📊 Dashboard: Récupération des statistiques de paiements...');
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('amount');

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
      case 'good': return 'Bon payeur';
      case 'average': return 'Payeur moyen';
      case 'poor': return 'Mauvais payeur';
      default: return 'Non évalué';
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
        <h1 className="text-2xl font-bold text-gray-900">Tableau de Bord</h1>
        <div className="text-sm text-gray-500">
          Dernière mise à jour: {new Date().toLocaleString('fr-FR')}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Chiffre d'Affaires Total"
          value={formatCurrency(stats.total_sales)}
          icon={Euro}
          color="blue"
          subtitle="Toutes ventes confondues"
        />
        <StatCard
          title="Ventes au Comptant"
          value={formatCurrency(stats.cash_sales)}
          icon={TrendingUp}
          color="green"
          subtitle="Paiements immédiats"
        />
        <StatCard
          title="Ventes à Crédit"
          value={formatCurrency(stats.credit_sales)}
          icon={CreditCard}
          color="yellow"
          subtitle="Avec solde restant"
        />
        <StatCard
          title="Total Encaissements"
          value={formatCurrency(stats.total_payments)}
          icon={Target}
          color="purple"
          subtitle="Paiements reçus"
        />
        <StatCard
          title="Créances en Cours"
          value={formatCurrency(stats.outstanding_debt)}
          icon={AlertCircle}
          color="red"
          subtitle="Montants impayés"
        />
        <StatCard
          title="Nombre de Clients"
          value={stats.total_clients}
          icon={Users}
          color="blue"
          subtitle="Clients enregistrés"
        />
      </div>

      {/* Top Clients */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Clients</h2>
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
            <p className="text-gray-500 text-center py-4">Aucun client trouvé</p>
          )}
        </div>
      </div>
    </div>
  );
};
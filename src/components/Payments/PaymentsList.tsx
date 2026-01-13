import React, { useState, useEffect, useRef } from 'react';
import { Search, Calendar, CreditCard } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Payment } from '../../types';

export const PaymentsList: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Flag pour éviter les chargements multiples au montage
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    // Ne charger qu'une seule fois au montage
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      fetchPayments();
    }
  }, []);

  useEffect(() => {
    let filtered = payments.filter(payment => {
      const client = payment.sale?.clients;
      const clientName = client ? `${client.first_name || ''} ${client.last_name || ''}`.toLowerCase() : '';
      const clientPhone = client?.phone || '';
      
      return (
        clientName.includes(searchTerm.toLowerCase()) ||
        clientPhone.includes(searchTerm) ||
        payment.notes.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

    if (paymentMethodFilter !== 'all') {
      filtered = filtered.filter(payment => payment.payment_method === paymentMethodFilter);
    }

    setFilteredPayments(filtered);
  }, [payments, searchTerm, paymentMethodFilter]);

  const fetchPayments = async () => {
    try {
      // Récupérer les paiements avec leurs ventes et clients en une seule requête
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          *,
          sale:sales!payments_sale_id_fkey(
            id,
            description,
            clients(
              first_name,
              last_name,
              phone
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (paymentsError) {
        console.error('Erreur récupération paiements:', paymentsError);
        return;
      }

      setPayments(paymentsData || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
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

  const getPaymentMethodDisplay = (method: string) => {
    switch (method) {
      case 'cash':
        return { label: '💵 Espèces', className: 'text-green-600 bg-green-100' };
      case 'mobile_money':
        return { label: '📱 Mobile Money', className: 'text-blue-600 bg-blue-100' };
      case 'bank_transfer':
        return { label: '🏦 Virement', className: 'text-purple-600 bg-purple-100' };
      case 'other':
        return { label: '🔄 Autre', className: 'text-gray-600 bg-gray-100' };
      default:
        return { label: 'Inconnu', className: 'text-gray-600 bg-gray-100' };
    }
  };

  const paymentMethods = [
    { value: 'all', label: 'Tous les moyens' },
    { value: 'cash', label: '💵 Espèces' },
    { value: 'mobile_money', label: '📱 Mobile Money' },
    { value: 'bank_transfer', label: '🏦 Virement bancaire' },
    { value: 'other', label: '🔄 Autre' },
  ];

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des paiements...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Suivi des Paiements</h1>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="text-xs sm:text-sm text-gray-500">
            Total: {formatCurrency(payments.reduce((sum, payment) => sum + payment.amount, 0))}
          </div>
          <button
            onClick={fetchPayments}
            className="flex items-center space-x-2 px-2 sm:px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm sm:text-base"
          >
            <span>🔄</span>
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par client ou notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        <div>
          <select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {paymentMethods.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Payments List - Mobile Card View */}
      <div className="md:hidden space-y-3">
        {filteredPayments.map((payment) => {
          const methodDisplay = getPaymentMethodDisplay(payment.payment_method);
          const client = payment.sale?.clients;
          
          return (
            <div key={payment.id} className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <CreditCard size={16} className="text-green-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {client ? `${client.first_name || ''} ${client.last_name || ''}` : 'Client non trouvé'}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{client?.phone || 'Téléphone non disponible'}</div>
                  </div>
                </div>
                <div className="text-lg font-bold text-green-600 ml-2 flex-shrink-0">
                  {formatCurrency(payment.amount)}
                </div>
              </div>
              <div className="space-y-2 text-xs pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Moyen:</span>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${methodDisplay.className}`}>
                    {methodDisplay.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Date:</span>
                  <div className="flex items-center space-x-1 text-gray-900">
                    <Calendar size={12} className="text-gray-400" />
                    <span>{new Date(payment.created_at).toLocaleDateString('fr-FR')}</span>
                    <span className="text-gray-400">
                      {new Date(payment.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                {payment.notes && (
                  <div className="pt-1">
                    <span className="text-gray-600">Notes: </span>
                    <span className="text-gray-900">{payment.notes}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {filteredPayments.length === 0 && (
          <div className="text-center py-8 bg-white rounded-lg shadow-md">
            <p className="text-gray-500 text-sm">
              {searchTerm || paymentMethodFilter !== 'all' ? 'Aucun paiement trouvé pour ces critères' : 'Aucun paiement enregistré'}
            </p>
          </div>
        )}
      </div>

      {/* Payments List - Desktop Table View */}
      <div className="hidden md:block bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Moyen de Paiement
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPayments.map((payment) => {
                const methodDisplay = getPaymentMethodDisplay(payment.payment_method);
                const client = payment.sale?.clients;
                
                return (
                  <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <CreditCard size={16} className="text-green-600" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {client ? `${client.first_name || ''} ${client.last_name || ''}` : 'Client non trouvé'}
                          </div>
                          <div className="text-sm text-gray-500">{client?.phone || 'Téléphone non disponible'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(payment.amount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${methodDisplay.className}`}>
                        {methodDisplay.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2 text-sm text-gray-900">
                        <Calendar size={14} className="text-gray-400" />
                        <span>{new Date(payment.created_at).toLocaleDateString('fr-FR')}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(payment.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs">
                        {payment.notes || '-'}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredPayments.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">
              {searchTerm || paymentMethodFilter !== 'all' ? 'Aucun paiement trouvé pour ces critères' : 'Aucun paiement enregistré'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
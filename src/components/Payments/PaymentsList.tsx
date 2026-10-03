import React, { useState, useEffect, useRef } from 'react';
import { Calendar, CreditCard, RefreshCw } from 'lucide-react';
import { SearchField } from '../ui/SearchField';
import { supabase } from '../../lib/supabase';
import { Payment } from '../../types';
import { DataTable, dtTh, dtTd, dtTdWrap } from '../ui/DataTable';
import { formatDateTimeDisplay } from '../../lib/dateUtils';

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
        return { label: '📱 Mobile Money', className: 'app-badge-info' };
      case 'bank_transfer':
        return { label: '🏦 Virement', className: 'text-purple-600 bg-purple-100' };
      case 'other':
        return { label: '🔄 Autre', className: 'app-badge' };
      default:
        return { label: 'Inconnu', className: 'app-badge' };
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
            <h1 className="app-page-title">Suivi des Paiements</h1>
            <p className="app-page-subtitle">
              Total: {formatCurrency(payments.reduce((sum, payment) => sum + payment.amount, 0))}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={fetchPayments}
              className="app-btn app-btn-secondary app-btn-sm whitespace-nowrap"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
          </div>
        </div>

        <div className="app-toolbar">
          <SearchField
            className="min-w-[12rem]"
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Rechercher par client ou notes..."
            inputClassName="text-xs py-1.5"
          />
          <select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
            className="app-input text-xs py-1.5 w-auto sm:min-w-[12rem]"
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
            <div key={payment.id} className="app-list-card">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <CreditCard size={13} className="text-green-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium app-text truncate">
                      {client ? `${client.first_name || ''} ${client.last_name || ''}` : 'Client non trouvé'}
                    </div>
                    <div className="text-[11px] app-text-muted truncate">{client?.phone || 'Téléphone non disponible'}</div>
                  </div>
                </div>
                <div className="text-sm font-semibold text-green-600 ml-2 flex-shrink-0">
                  {formatCurrency(payment.amount)}
                </div>
              </div>
              <div className="space-y-1 text-[11px] pt-2 border-t app-divider">
                <div className="flex items-center justify-between">
                  <span className="app-text-muted">Moyen:</span>
                  <span className={`inline-flex px-1.5 py-0.5 text-[11px] font-medium rounded ${methodDisplay.className}`}>
                    {methodDisplay.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="app-text-muted">Date:</span>
                  <div className="flex items-center space-x-1 app-text">
                    <Calendar size={11} className="app-text-muted" />
                    <span>{formatDateTimeDisplay(payment.created_at)}</span>
                  </div>
                </div>
                {payment.notes && (
                  <div className="pt-0.5">
                    <span className="app-text-muted">Notes: </span>
                    <span className="app-text">{payment.notes}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {filteredPayments.length === 0 && (
          <div className="app-empty">
            <p className="app-empty-text">
              {searchTerm || paymentMethodFilter !== 'all' ? 'Aucun paiement trouvé pour ces critères' : 'Aucun paiement enregistré'}
            </p>
          </div>
        )}
      </div>

      {/* Payments List - Desktop Table View */}
      <div className="hidden md:block app-table-wrap">
        <DataTable>
            <thead className="app-bg-muted">
              <tr>
                <th className={dtTh}>Client</th>
                <th className={dtTh}>Montant</th>
                <th className={dtTh}>Moyen de Paiement</th>
                <th className={dtTh}>Date</th>
                <th className={dtTh}>Notes</th>
              </tr>
            </thead>
            <tbody className="bg-[var(--app-surface)] divide-y divide-[var(--app-border)]">
              {filteredPayments.map((payment) => {
                const methodDisplay = getPaymentMethodDisplay(payment.payment_method);
                const client = payment.sale?.clients;
                
                return (
                  <tr key={payment.id} className="hover:bg-[var(--app-surface-muted)] transition-colors">
                    <td className={dtTd}>
                      <div className="flex items-center">
                        <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <CreditCard size={13} className="text-green-600" />
                        </div>
                        <div className="ml-2 min-w-0">
                          <div className="font-medium truncate">
                            {client ? `${client.first_name || ''} ${client.last_name || ''}` : 'Client non trouvé'}
                          </div>
                          <div className="text-[11px] app-text-muted truncate">{client?.phone || 'Téléphone non disponible'}</div>
                        </div>
                      </div>
                    </td>
                    <td className={dtTd}>
                      <div className="font-semibold text-green-600">
                        {formatCurrency(payment.amount)}
                      </div>
                    </td>
                    <td className={dtTd}>
                      <span className={`inline-flex px-1.5 py-0.5 text-[11px] font-medium rounded ${methodDisplay.className}`}>
                        {methodDisplay.label}
                      </span>
                    </td>
                    <td className={dtTd}>
                      <div className="flex items-center space-x-1">
                        <Calendar size={12} className="app-text-muted flex-shrink-0" />
                        <span>{formatDateTimeDisplay(payment.created_at)}</span>
                      </div>
                    </td>
                    <td className={dtTdWrap}>
                      <div className="max-w-xs truncate">
                        {payment.notes || '-'}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
        </DataTable>

        {filteredPayments.length === 0 && (
          <div className="app-empty">
            <p className="app-empty-text">
              {searchTerm || paymentMethodFilter !== 'all' ? 'Aucun paiement trouvé pour ces critères' : 'Aucun paiement enregistré'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
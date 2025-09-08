import React, { useState, useEffect } from 'react';
import { X, Download, Calendar, CreditCard, TrendingUp, Phone, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Client, Sale, Payment } from '../../types';
import jsPDF from 'jspdf';

interface ClientDetailsProps {
  client: Client;
  onClose: () => void;
}

interface ClientActivity {
  id: string;
  date: string;
  type: 'sale' | 'payment';
  description: string;
  amount: number;
  balance: number;
  deposit?: number;
}

export const ClientDetails: React.FC<ClientDetailsProps> = ({ client, onClose }) => {
  const [activities, setActivities] = useState<ClientActivity[]>([]);
  const [stats, setStats] = useState({
    totalPurchases: 0,
    totalDeposits: 0,
    totalPayments: 0,
    outstandingBalance: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClientData();
  }, [client.id]);

  const fetchClientData = async () => {
    try {
      // Fetch sales
      const { data: sales } = await supabase
        .from('sales')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: true });

      // Fetch payments
      const { data: payments } = await supabase
        .from('payments')
        .select(`
          *,
          sales!inner(client_id)
        `)
        .eq('sales.client_id', client.id)
        .order('created_at', { ascending: true });

      if (sales && payments) {
        // Calculate statistics
        const totalPurchases = sales.reduce((sum, sale) => sum + sale.total_amount, 0);
        const totalDeposits = sales.reduce((sum, sale) => sum + sale.deposit, 0);
        const totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);
        const outstandingBalance = sales.reduce((sum, sale) => sum + sale.remaining_balance, 0);

        setStats({
          totalPurchases,
          totalDeposits,
          totalPayments,
          outstandingBalance,
        });

        // Combine and sort activities
        const allActivities: ClientActivity[] = [];
        let runningBalance = 0;

        // Combine sales and payments, sort by date
        const combinedEvents = [
          ...sales.map(sale => ({ ...sale, type: 'sale' as const })),
          ...payments.map(payment => ({ ...payment, type: 'payment' as const }))
        ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        combinedEvents.forEach(event => {
          if (event.type === 'sale') {
            const sale = event as Sale;
            // Le solde augmente seulement du montant restant après l'acompte
            const remainingAmount = sale.total_amount - sale.deposit;
            runningBalance += remainingAmount;
            allActivities.push({
              id: sale.id,
              date: sale.created_at,
              type: 'sale',
              description: sale.description,
              amount: sale.total_amount, // Afficher le montant total
              balance: runningBalance, // Solde après déduction de l'acompte
              deposit: sale.deposit,
            });
          } else {
            const payment = event as Payment;
            runningBalance -= payment.amount;
            allActivities.push({
              id: payment.id,
              date: payment.created_at,
              type: 'payment',
              description: `Paiement (${payment.payment_method})`,
              amount: -payment.amount,
              balance: runningBalance,
            });
          }
        });

        setActivities(allActivities);
      }
    } catch (error) {
      console.error('Error fetching client data:', error);
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

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text('RELEVE DE COMPTE CLIENT', 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Client: ${client.first_name} ${client.last_name}`, 20, 35);
    doc.text(`Téléphone: ${client.phone}`, 20, 45);
    doc.text(`Adresse: ${client.address}`, 20, 55);
    doc.text(`Date d'édition: ${new Date().toLocaleDateString('fr-FR')}`, 20, 65);
    
    // Summary
    doc.text('RESUME FINANCIER', 20, 85);
    doc.text(`Total des achats: ${formatCurrency(stats.totalPurchases)}`, 20, 95);
    doc.text(`Total des acomptes: ${formatCurrency(stats.totalDeposits)}`, 20, 105);
    doc.text(`Total des paiements: ${formatCurrency(stats.totalPayments)}`, 20, 115);
    doc.text(`Solde restant: ${formatCurrency(stats.outstandingBalance)}`, 20, 125);
    
    // Activities
    doc.text('HISTORIQUE DES OPERATIONS', 20, 135);
    
    let yPosition = 150;
    activities.forEach((activity, index) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      
      const date = new Date(activity.date).toLocaleDateString('fr-FR');
      const type = activity.type === 'sale' ? 'VENTE' : 'PAIEMENT';
      const amount = formatCurrency(Math.abs(activity.amount));
      const balance = formatCurrency(activity.balance);
      
      doc.text(`${date} | ${type} | ${activity.description}`, 20, yPosition);
      doc.text(`${amount} | Solde: ${balance}`, 20, yPosition + 10);
      
      yPosition += 20;
    });
    
    doc.save(`releve-${client.first_name}-${client.last_name}.pdf`);
  };

  const getTrustRatingDisplay = (rating: string) => {
    switch (rating) {
      case 'good':
        return { label: '✅ Bon payeur', className: 'text-green-600 bg-green-100' };
      case 'average':
        return { label: '⚠️ Payeur moyen', className: 'text-yellow-600 bg-yellow-100' };
      case 'poor':
        return { label: '❌ Mauvais payeur', className: 'text-red-600 bg-red-100' };
      default:
        return { label: 'Non évalué', className: 'text-gray-600 bg-gray-100' };
    }
  };

  const trustDisplay = getTrustRatingDisplay(client.trust_rating);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-bold text-lg">
                {client.first_name[0]}{client.last_name[0]}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {client.first_name} {client.last_name}
              </h2>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${trustDisplay.className}`}>
                {trustDisplay.label}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={exportToPDF}
              className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              <Download size={18} />
              <span>Export PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Client Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Phone size={18} className="text-gray-400" />
                <span className="text-gray-900">{client.phone}</span>
              </div>
              <div className="flex items-start space-x-2">
                <MapPin size={18} className="text-gray-400 mt-0.5" />
                <span className="text-gray-900">{client.address}</span>
              </div>
              {client.notes && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm text-gray-700">{client.notes}</p>
                </div>
              )}
            </div>

            {/* Financial Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Résumé Financier</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total des achats:</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(stats.totalPurchases)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total des acomptes:</span>
                  <span className="font-semibold text-blue-600">{formatCurrency(stats.totalDeposits)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total des paiements:</span>
                  <span className="font-semibold text-green-600">{formatCurrency(stats.totalPayments)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-600 font-medium">Solde restant:</span>
                  <span className={`font-bold ${stats.outstandingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(stats.outstandingBalance)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Activities */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Historique des Opérations</h3>
            
            {loading ? (
              <div className="animate-pulse space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            ) : activities.length > 0 ? (
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div key={activity.id} className="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-full ${
                          activity.type === 'sale' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                        }`}>
                          {activity.type === 'sale' ? <TrendingUp size={16} /> : <CreditCard size={16} />}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <Calendar size={14} className="text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {new Date(activity.date).toLocaleDateString('fr-FR')} à {new Date(activity.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="font-medium text-gray-900">{activity.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${activity.amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {activity.amount > 0 ? '+' : ''}{formatCurrency(activity.amount)}
                        </p>
                        {activity.type === 'sale' && activity.deposit && activity.deposit > 0 && (
                          <p className="text-sm text-blue-600">
                            Acompte: {formatCurrency(activity.deposit)}
                          </p>
                        )}
                        <p className="text-sm text-gray-500">
                          Solde: {formatCurrency(activity.balance)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">Aucune activité trouvée pour ce client</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
import React, { useState } from 'react';
import { X, Save, CreditCard } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Sale } from '../../types';

interface PaymentFormProps {
  sale: Sale;
  onClose: () => void;
  onSubmit: () => void;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({ sale, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    amount: '',
    payment_method: 'cash' as const,
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const paymentMethods = [
    { value: 'cash', label: '💵 Espèces' },
    { value: 'mobile_money', label: '📱 Mobile Money' },
    { value: 'bank_transfer', label: '🏦 Virement bancaire' },
    { value: 'other', label: '🔄 Autre' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const amount = parseFloat(formData.amount);
    
    if (isNaN(amount) || amount <= 0) {
      setError('Le montant doit être supérieur à 0');
      setLoading(false);
      return;
    }

    // Vérifier que le montant est un nombre valide (pas plus de 2 décimales)
    if (!/^\d+(\.\d{0,2})?$/.test(formData.amount)) {
      setError('Le montant doit être un nombre valide (ex: 10000 ou 10000.50)');
      setLoading(false);
      return;
    }

    if (amount > sale.remaining_balance) {
      setError('Le montant ne peut pas être supérieur au solde restant');
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      console.log('🔍 PaymentForm: Création du paiement avec montant:', amount);

      // Create payment
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          sale_id: sale.id,
          amount: amount,
          payment_method: formData.payment_method,
          notes: formData.notes,
          created_by: user?.id,
        });

      if (paymentError) {
        console.error('❌ PaymentForm: Erreur création paiement:', paymentError);
        throw paymentError;
      }

      // Update sale remaining balance
      const newRemainingBalance = sale.remaining_balance - amount;
      const newStatus = newRemainingBalance === 0 ? 'paid' : 'ongoing';

      const { error: saleError } = await supabase
        .from('sales')
        .update({
          remaining_balance: newRemainingBalance,
          status: newStatus,
        })
        .eq('id', sale.id);

      if (saleError) throw saleError;

      onSubmit();
    } catch (error: any) {
      setError(error.message);
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <CreditCard className="text-green-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">Nouveau Paiement</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {/* Sale Info */}
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <h3 className="font-medium text-gray-900 mb-2">
              Client: {sale.client?.first_name} {sale.client?.last_name}
            </h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Montant total:</span>
                <span className="font-medium">{formatCurrency(sale.total_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Déjà payé:</span>
                <span className="font-medium">{formatCurrency(sale.total_amount - sale.remaining_balance)}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="text-gray-600 font-medium">Solde restant:</span>
                <span className="font-bold text-red-600">{formatCurrency(sale.remaining_balance)}</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Montant du Paiement *
              </label>
              <input
                type="text"
                required
                value={formData.amount}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.]/g, '');
                  setFormData({ ...formData, amount: value });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={`Max: ${formatCurrency(sale.remaining_balance)}`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Moyen de Paiement *
              </label>
              <select
                required
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Détails du paiement..."
              />
            </div>

            {/* New Balance Preview */}
            {formData.amount && parseFloat(formData.amount) > 0 && (
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Nouveau solde après paiement:</span>
                  <span className="font-bold text-green-600">
                    {formatCurrency(sale.remaining_balance - parseFloat(formData.amount))}
                  </span>
                </div>
                {sale.remaining_balance - parseFloat(formData.amount) === 0 && (
                  <div className="text-xs text-green-600 mt-1">
                    ✅ Cette vente sera marquée comme réglée
                  </div>
                )}
              </div>
            )}

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <Save size={18} />
                <span>{loading ? 'Enregistrement...' : 'Enregistrer'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
import React, { useState } from 'react';
import { devLog } from '../../lib/devLog';
import { X, Save, CreditCard } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Sale } from '../../types';
import { Offcanvas, OffcanvasHeader, OffcanvasBody, OffcanvasFooter } from '../ui/Offcanvas';

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
    provider: '',
    phone_number: '',
    transaction_id: '',
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

    // Vérifier les champs requis pour mobile_money
    if (formData.payment_method === 'mobile_money') {
      if (!formData.provider.trim()) {
        setError('Le fournisseur (Orange Money, Airtel Money, etc.) est requis pour les paiements mobile money');
        setLoading(false);
        return;
      }
      if (!formData.phone_number.trim()) {
        setError('Le numéro de téléphone est requis pour les paiements mobile money');
        setLoading(false);
        return;
      }
      if (!formData.transaction_id.trim()) {
        setError('L\'identifiant de transaction est requis pour les paiements mobile money');
        setLoading(false);
        return;
      }
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      devLog('🔍 PaymentForm: Création du paiement avec montant:', amount);

      // Préparer les données du paiement
      const paymentData: any = {
        sale_id: sale.id,
        amount: amount,
        payment_method: formData.payment_method,
        notes: formData.notes,
        created_by: user?.id,
      };

      // Ajouter les champs mobile money si nécessaire
      if (formData.payment_method === 'mobile_money') {
        paymentData.provider = formData.provider.trim();
        paymentData.phone_number = formData.phone_number.trim();
        paymentData.transaction_id = formData.transaction_id.trim();
      }

      // Create payment
      // Le trigger SQL update_sale_balance() mettra automatiquement à jour
      // le remaining_balance et le status de la vente
      const { error: paymentError } = await supabase
        .from('payments')
        .insert(paymentData);

      if (paymentError) {
        console.error('❌ PaymentForm: Erreur création paiement:', paymentError);
        throw paymentError;
      }

      // Le trigger SQL s'occupe de la mise à jour du remaining_balance
      // Pas besoin de mettre à jour manuellement

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
    <Offcanvas onClose={onClose} width="md">
      <OffcanvasHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CreditCard className="text-green-600" size={22} />
            <h2 className="text-lg font-semibold app-text">Nouveau Paiement</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="app-text-muted hover:text-[var(--app-ink-muted)] transition-colors"
          >
            <X size={22} />
          </button>
        </div>
      </OffcanvasHeader>

      <OffcanvasBody className="space-y-4">
        <div className="app-badge-info p-4 rounded-lg">
          <h3 className="font-medium app-text mb-2">
            Client: {sale.client?.first_name} {sale.client?.last_name}
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="app-text-muted">Montant total:</span>
              <span className="font-medium">{formatCurrency(sale.total_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="app-text-muted">Déjà payé:</span>
              <span className="font-medium">{formatCurrency(Math.max(0, sale.total_payments || (sale.total_amount - sale.remaining_balance)))}</span>
            </div>
            <div className="flex justify-between border-t pt-1">
              <span className="app-text-muted font-medium">Solde restant:</span>
              <span className="font-bold text-red-600">{formatCurrency(sale.remaining_balance)}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} id="payment-form" className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="payment-amount" className="app-label">
              Montant du Paiement *
            </label>
            <input
              id="payment-amount"
              type="text"
              required
              value={formData.amount}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9.]/g, '');
                setFormData({ ...formData, amount: value });
              }}
              className="app-input"
              placeholder={`Max: ${formatCurrency(sale.remaining_balance)}`}
              onFocus={(e) => e.target.select()}
            />
          </div>

          <div>
            <label htmlFor="payment-method" className="app-label">
              Moyen de Paiement *
            </label>
            <select
              id="payment-method"
              required
              value={formData.payment_method}
              onChange={(e) => {
                const newMethod = e.target.value as any;
                setFormData({
                  ...formData,
                  payment_method: newMethod,
                  provider: newMethod !== 'mobile_money' ? '' : formData.provider,
                  phone_number: newMethod !== 'mobile_money' ? '' : formData.phone_number,
                  transaction_id: newMethod !== 'mobile_money' ? '' : formData.transaction_id,
                });
              }}
              className="app-input"
            >
              {paymentMethods.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </div>

          {formData.payment_method === 'mobile_money' && (
            <>
              <div>
                <label htmlFor="payment-provider" className="app-label">
                  Fournisseur Mobile Money *
                </label>
                <select
                  id="payment-provider"
                  required
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                  className="app-input"
                >
                  <option value="">Sélectionner un fournisseur</option>
                  <option value="Orange Money">Orange Money</option>
                  <option value="Airtel Money">Airtel Money</option>
                  <option value="MVola">MVola</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>

              <div>
                <label htmlFor="payment-phone" className="app-label">
                  Numéro de téléphone *
                </label>
                <input
                  id="payment-phone"
                  type="tel"
                  required
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  className="app-input"
                  placeholder="+261 34 12 34 56 78"
                  onFocus={(e) => e.target.select()}
                />
              </div>

              <div>
                <label htmlFor="payment-transaction_id" className="app-label">
                  Identifiant de transaction *
                </label>
                <input
                  id="payment-transaction_id"
                  type="text"
                  required
                  value={formData.transaction_id}
                  onChange={(e) => setFormData({ ...formData, transaction_id: e.target.value })}
                  className="app-input"
                  placeholder="Ex: TXN123456789"
                  onFocus={(e) => e.target.select()}
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="payment-notes" className="app-label">
              Notes
            </label>
            <textarea
              id="payment-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="app-input"
              placeholder="Détails du paiement..."
            />
          </div>

          {formData.amount && parseFloat(formData.amount) > 0 && (
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="app-text-muted">Nouveau solde après paiement:</span>
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
        </form>
      </OffcanvasBody>

      <OffcanvasFooter>
        <div className="app-actions w-full">
          <button
            type="button"
            onClick={onClose}
            className="app-btn app-btn-secondary flex-1"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="payment-form"
            disabled={loading}
            className="app-btn app-btn-success flex-1"
          >
            <Save size={18} />
            <span>{loading ? 'Enregistrement...' : 'Enregistrer'}</span>
          </button>
        </div>
      </OffcanvasFooter>
    </Offcanvas>
  );
};
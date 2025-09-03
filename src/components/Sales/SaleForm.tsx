import React, { useState, useEffect } from 'react';
import { X, Save, ShoppingCart, Plus, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Client, Sale } from '../../types';

interface SaleFormProps {
  sale?: Sale;
  onClose: () => void;
  onSubmit: () => void;
}

export const SaleForm: React.FC<SaleFormProps> = ({ sale, onClose, onSubmit }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [formData, setFormData] = useState({
    client_id: sale?.client_id || '',
    description: sale?.description || '',
    total_amount: sale?.total_amount || 0,
    deposit: sale?.deposit || 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientData, setNewClientData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    address: '',
    notes: ''
  });
  const [creatingClient, setCreatingClient] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('first_name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const createNewClient = async () => {
    if (!newClientData.first_name || !newClientData.last_name || !newClientData.phone) {
      setError('Le prénom, nom et téléphone sont obligatoires');
      return;
    }

    setCreatingClient(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Vérifier si l'utilisateur a un profil
      let userProfileId = user?.id;

      if (user?.id) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('id', user.id)
          .single();

        if (!profile) {
          // Créer un profil utilisateur si il n'existe pas
          const { data: newProfile, error: profileError } = await supabase
            .from('user_profiles')
            .insert({
              id: user.id,
              email: user.email || '',
              name: user.user_metadata?.full_name || user.email || 'Utilisateur',
              role: 'employee'
            })
            .select()
            .single();

          if (profileError) {
            console.error('Erreur création profil:', profileError);
            // Continuer sans created_by si on ne peut pas créer le profil
            userProfileId = null;
          } else {
            userProfileId = newProfile.id;
          }
        }
      }

      const { data, error } = await supabase
        .from('clients')
        .insert({
          ...newClientData,
          created_by: userProfileId,
        })
        .select()
        .single();

      if (error) throw error;

      // Ajouter le nouveau client à la liste
      setClients(prev => [...prev, data]);

      // Sélectionner automatiquement le nouveau client
      setFormData(prev => ({ ...prev, client_id: data.id }));

      // Réinitialiser le formulaire de client
      setNewClientData({
        first_name: '',
        last_name: '',
        phone: '',
        address: '',
        notes: ''
      });

      setShowNewClientForm(false);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setCreatingClient(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (formData.deposit > formData.total_amount) {
      setError('L\'acompte ne peut pas être supérieur au montant total');
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const remainingBalance = formData.total_amount - formData.deposit;
      const status = remainingBalance === 0 ? 'paid' : 'ongoing';

      // Vérifier si l'utilisateur a un profil
      let userProfileId = user?.id;

      if (user?.id) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('id', user.id)
          .single();

        if (!profile) {
          // Créer un profil utilisateur si il n'existe pas
          const { data: newProfile, error: profileError } = await supabase
            .from('user_profiles')
            .insert({
              id: user.id,
              email: user.email || '',
              name: user.user_metadata?.full_name || user.email || 'Utilisateur',
              role: 'employee'
            })
            .select()
            .single();

          if (profileError) {
            console.error('Erreur création profil:', profileError);
            // Continuer sans created_by si on ne peut pas créer le profil
            userProfileId = null;
          } else {
            userProfileId = newProfile.id;
          }
        }
      }

      if (sale) {
        // Update existing sale
        const { error } = await supabase
          .from('sales')
          .update({
            client_id: formData.client_id,
            description: formData.description,
            total_amount: formData.total_amount,
            deposit: formData.deposit,
            remaining_balance: remainingBalance,
            status,
          })
          .eq('id', sale.id);
        
        if (error) throw error;
      } else {
        // Create new sale
        const { error } = await supabase
          .from('sales')
          .insert({
            ...formData,
            remaining_balance: remainingBalance,
            status,
            created_by: userProfileId,
          });
        
        if (error) throw error;
      }
      
      onSubmit();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const remainingBalance = formData.total_amount - formData.deposit;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'MGA',
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <ShoppingCart className="text-blue-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">
              {sale ? 'Modifier la Vente' : 'Nouvelle Vente'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Client *
              </label>
              <button
                type="button"
                onClick={() => setShowNewClientForm(!showNewClientForm)}
                className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Plus size={16} />
                <span>Nouveau client</span>
              </button>
            </div>

            {!showNewClientForm ? (
              <select
                required
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Sélectionner un client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.first_name} {client.last_name} - {client.phone}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-3 p-4 border border-blue-200 rounded-md bg-blue-50">
                <div className="flex items-center space-x-2 mb-3">
                  <User className="text-blue-600" size={20} />
                  <span className="text-sm font-medium text-blue-800">Nouveau client</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Prénom *
                    </label>
                    <input
                      type="text"
                      required
                      value={newClientData.first_name}
                      onChange={(e) => setNewClientData({ ...newClientData, first_name: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Prénom"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Nom *
                    </label>
                    <input
                      type="text"
                      required
                      value={newClientData.last_name}
                      onChange={(e) => setNewClientData({ ...newClientData, last_name: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Nom"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Téléphone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={newClientData.phone}
                    onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="+261 34 12 34 56"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Adresse
                  </label>
                  <input
                    type="text"
                    value={newClientData.address}
                    onChange={(e) => setNewClientData({ ...newClientData, address: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Adresse complète"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={newClientData.notes}
                    onChange={(e) => setNewClientData({ ...newClientData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Informations supplémentaires..."
                  />
                </div>

                <div className="flex space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewClientForm(false)}
                    className="flex-1 px-3 py-1 text-xs border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={createNewClient}
                    disabled={creatingClient}
                    className="flex-1 flex items-center justify-center space-x-1 px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Plus size={14} />
                    <span>{creatingClient ? 'Création...' : 'Créer'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description des Articles *
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Décrivez les articles vendus..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Montant Total *
            </label>
            <input
              type="number"
              required
              min="0"
              step="100"
              value={formData.total_amount}
              onChange={(e) => setFormData({ ...formData, total_amount: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Acompte Versé
            </label>
            <input
              type="number"
              min="0"
              max={formData.total_amount}
              step="100"
              value={formData.deposit}
              onChange={(e) => setFormData({ ...formData, deposit: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Balance Display */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Solde Restant:</span>
              <span className={`text-lg font-bold ${remainingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(remainingBalance)}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {remainingBalance === 0 ? 'Vente réglée' : 'Vente en cours'}
            </div>
          </div>

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
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save size={18} />
              <span>{loading ? 'Enregistrement...' : 'Enregistrer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
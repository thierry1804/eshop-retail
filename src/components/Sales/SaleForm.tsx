import React, { useState, useEffect, useRef } from 'react';
import { X, Save, ShoppingCart, Plus, User, Search, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Client, Sale } from '../../types';

interface SaleFormProps {
  sale?: Sale;
  onClose: () => void;
  onSubmit: () => void;
}

export const SaleForm: React.FC<SaleFormProps> = ({ sale, onClose, onSubmit }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientSearchRef = useRef<HTMLDivElement>(null);
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

  // Effet pour filtrer les clients selon le terme de recherche
  useEffect(() => {
    if (clientSearchTerm.trim() === '') {
      setFilteredClients(clients);
    } else {
      const filtered = clients.filter(client => {
        const fullName = `${client.first_name} ${client.last_name}`.toLowerCase();
        const phone = client.phone.toLowerCase();
        const searchTerm = clientSearchTerm.toLowerCase();

        return fullName.includes(searchTerm) || phone.includes(searchTerm);
      });
      setFilteredClients(filtered);
    }
  }, [clients, clientSearchTerm]);

  // Effet pour gérer le client sélectionné initialement
  useEffect(() => {
    if (sale?.client_id && clients.length > 0) {
      const client = clients.find(c => c.id === sale.client_id);
      if (client) {
        setClientSearchTerm(`${client.first_name} ${client.last_name} - ${client.phone}`);
      }
    }
  }, [sale?.client_id, clients]);

  // Effet pour gérer les clics en dehors du composant de recherche
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientSearchRef.current && !clientSearchRef.current.contains(event.target as Node)) {
        setShowClientDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('first_name');

      if (error) throw error;
      setClients((data as Client[]) || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const handleClientSelect = (client: Client) => {
    setClientSearchTerm(`${client.first_name} ${client.last_name} - ${client.phone}`);
    setFormData({ ...formData, client_id: client.id });
    setShowClientDropdown(false);
  };

  const handleClientSearchChange = (value: string) => {
    setClientSearchTerm(value);
    setShowClientDropdown(true);

    // Si le champ est vidé, réinitialiser la sélection
    if (value.trim() === '') {
      setFormData({ ...formData, client_id: '' });
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
      let userProfileId: string | undefined = user?.id;

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
            } as any)
            .select()
            .single();

          if (profileError) {
            console.error('Erreur création profil:', profileError);
            // Continuer sans created_by si on ne peut pas créer le profil
            userProfileId = undefined;
          } else {
            userProfileId = (newProfile as any)?.id;
          }
        }
      }

      const { data, error } = await supabase
        .from('clients')
        .insert({
          ...newClientData,
          created_by: userProfileId,
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Ajouter le nouveau client à la liste
      setClients(prev => [...prev, data as Client]);

      // Sélectionner automatiquement le nouveau client
      setClientSearchTerm(`${(data as Client).first_name} ${(data as Client).last_name} - ${(data as Client).phone}`);
      setFormData(prev => ({ ...prev, client_id: (data as Client).id }));

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
      let userProfileId: string | undefined = user?.id;

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
            } as any)
            .select()
            .single();

          if (profileError) {
            console.error('Erreur création profil:', profileError);
            // Continuer sans created_by si on ne peut pas créer le profil
            userProfileId = undefined;
          } else {
            userProfileId = (newProfile as any)?.id;
          }
        }
      }

      if (sale) {
        // Update existing sale
        const updateData = {
          client_id: formData.client_id,
          description: formData.description,
          total_amount: formData.total_amount,
          deposit: formData.deposit,
          remaining_balance: remainingBalance,
          status,
        };

        const { error } = await (supabase as any)
          .from('sales')
          .update(updateData)
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
          } as any);
        
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
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        {/* En-tête fixe */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
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

        {/* Zone de contenu scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
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
                <div className="relative" ref={clientSearchRef}>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={clientSearchTerm}
                      onChange={(e) => handleClientSearchChange(e.target.value)}
                      onFocus={() => setShowClientDropdown(true)}
                      placeholder="Rechercher un client par nom ou téléphone..."
                      className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowClientDropdown(!showClientDropdown)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>

                  {showClientDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {filteredClients.length > 0 ? (
                        filteredClients.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => handleClientSelect(client)}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium text-gray-900">
                              {client.first_name} {client.last_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {client.phone}
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-gray-500 text-sm">
                          {clientSearchTerm.trim() ? 'Aucun client trouvé' : 'Aucun client disponible'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
          </form>
        </div>

        {/* Pied de page fixe avec boutons */}
        <div className="flex space-x-3 p-6 border-t border-gray-200 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Save size={18} />
            <span>{loading ? 'Enregistrement...' : 'Enregistrer'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
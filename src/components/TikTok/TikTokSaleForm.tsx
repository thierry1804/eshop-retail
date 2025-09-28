import React, { useState, useEffect } from 'react';
import { X, User, MessageCircle, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TikTokChatMessage, Client, Sale } from '../../types';
import { supabase } from '../../lib/supabase';

interface TikTokSaleFormProps {
  tiktokMessage: TikTokChatMessage;
  onClose: () => void;
  onSaleCreated: (sale: Sale) => void;
}

export const TikTokSaleForm: React.FC<TikTokSaleFormProps> = ({
  tiktokMessage,
  onClose,
  onSaleCreated
}) => {
  const { t } = useTranslation();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClient, setNewClient] = useState({
    first_name: tiktokMessage.nickname.split(' ')[0] || '',
    last_name: tiktokMessage.nickname.split(' ').slice(1).join(' ') || '',
    phone: '',
    address: '',
    trust_rating: 'good' as 'good' | 'average' | 'poor',
    notes: `Client TikTok - ${tiktokMessage.nickname}`
  });
  const [saleData, setSaleData] = useState({
    description: '',
    total_amount: 0,
    deposit: 0
  });
  const [autoCreateMode, setAutoCreateMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Erreur lors de la récupération des clients:', error);
    }
  };

  const handleCreateClient = async () => {
    if (!newClient.first_name || !newClient.last_name || !newClient.phone) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert([{
          ...newClient,
          tiktok_id: tiktokMessage.userId,
          tiktok_nick_name: tiktokMessage.nickname,
          created_by: (await supabase.auth.getUser()).data.user?.id
        }])
        .select()
        .single();

      if (error) throw error;

      setSelectedClient(data);
      setIsCreatingClient(false);
      setNewClient({
        first_name: '',
        last_name: '',
        phone: '',
        address: '',
        trust_rating: 'good',
        notes: ''
      });
    } catch (error) {
      setError('Erreur lors de la création du client: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoCreate = async () => {
    if (!saleData.description || saleData.total_amount <= 0) {
      setError('Veuillez remplir la description et le montant total');
      return;
    }

    setLoading(true);
    try {
      // 1. Créer le client automatiquement
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert([{
          ...newClient,
          tiktok_id: tiktokMessage.userId,
          tiktok_nick_name: tiktokMessage.nickname,
          created_by: (await supabase.auth.getUser()).data.user?.id
        }])
        .select()
        .single();

      if (clientError) throw clientError;

      // 2. Créer la vente avec description "TIKTOK"
      const remainingBalance = saleData.total_amount - saleData.deposit;
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert([{
          client_id: client.id,
          description: 'TIKTOK',
          total_amount: saleData.total_amount,
          deposit: saleData.deposit,
          remaining_balance: remainingBalance,
          status: remainingBalance > 0 ? 'ongoing' : 'paid',
          created_by: (await supabase.auth.getUser()).data.user?.id
        }])
        .select()
        .single();

      if (saleError) throw saleError;

      // 3. Créer un item de vente avec le code JP + date/heure + nom du produit
      const now = new Date();
      const jpCode = `JP${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const itemName = `${jpCode} - ${saleData.description}`;

      const { error: itemError } = await supabase
        .from('sale_items')
        .insert([{
          sale_id: sale.id,
          product_name: itemName,
          quantity: 1,
          unit_price: saleData.total_amount,
          total_price: saleData.total_amount,
          created_by: (await supabase.auth.getUser()).data.user?.id
        }]);

      if (itemError) throw itemError;

      onSaleCreated(sale);
      onClose();
    } catch (error) {
      setError('Erreur lors de la création automatique: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSale = async () => {
    if (!selectedClient) {
      setError('Veuillez sélectionner ou créer un client');
      return;
    }

    if (!saleData.description || saleData.total_amount <= 0) {
      setError('Veuillez remplir la description et le montant total');
      return;
    }

    setLoading(true);
    try {
      const remainingBalance = saleData.total_amount - saleData.deposit;
      
      // Créer la vente avec description "TIKTOK"
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert([{
          client_id: selectedClient.id,
          description: 'TIKTOK',
          total_amount: saleData.total_amount,
          deposit: saleData.deposit,
          remaining_balance: remainingBalance,
          status: remainingBalance > 0 ? 'ongoing' : 'paid',
          created_by: (await supabase.auth.getUser()).data.user?.id
        }])
        .select()
        .single();

      if (saleError) throw saleError;

      // Créer un item de vente avec le code JP + date/heure + nom du produit
      const now = new Date();
      const jpCode = `JP${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const itemName = `${jpCode} - ${saleData.description}`;

      const { error: itemError } = await supabase
        .from('sale_items')
        .insert([{
          sale_id: sale.id,
          product_name: itemName,
          quantity: 1,
          unit_price: saleData.total_amount,
          total_price: saleData.total_amount,
          created_by: (await supabase.auth.getUser()).data.user?.id
        }]);

      if (itemError) throw itemError;

      onSaleCreated(sale);
      onClose();
    } catch (error) {
      setError('Erreur lors de la création de la vente: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <MessageCircle className="w-6 h-6 text-pink-500" />
            <h2 className="text-xl font-semibold">Créer une vente depuis TikTok</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Message TikTok */}
        <div className="bg-pink-50 border border-pink-200 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2 mb-2">
            <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded">JP</span>
            <span className="font-semibold text-pink-600">{tiktokMessage.nickname}</span>
          </div>
          <p className="text-gray-800 mb-2">{tiktokMessage.comment}</p>
          <p className="text-xs text-gray-500">
            {new Date(tiktokMessage.timestamp).toLocaleString()}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Mode de création */}
        <div className="mb-6">
          <div className="flex items-center space-x-4 mb-4">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                checked={autoCreateMode}
                onChange={() => setAutoCreateMode(true)}
                className="rounded"
              />
              <span className="font-semibold">Création automatique</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                checked={!autoCreateMode}
                onChange={() => setAutoCreateMode(false)}
                className="rounded"
              />
              <span className="font-semibold">Sélection manuelle</span>
            </label>
          </div>

          {autoCreateMode ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2 text-green-800">
                🚀 Création automatique
              </h3>
              <p className="text-green-700 text-sm mb-3">
                Un nouveau client sera créé automatiquement avec les informations TikTok :
              </p>
              <div className="bg-white rounded p-3 text-sm">
                <p><strong>Nom :</strong> {newClient.first_name} {newClient.last_name}</p>
                <p><strong>TikTok ID :</strong> {tiktokMessage.userId}</p>
                <p><strong>Nickname :</strong> {tiktokMessage.nickname}</p>
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <User className="w-5 h-5 mr-2" />
                Sélection du client
              </h3>

              {!isCreatingClient ? (
                <div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sélectionner un client existant
                    </label>
                    <select
                      value={selectedClient?.id || ''}
                      onChange={(e) => {
                        const client = clients.find(c => c.id === e.target.value);
                        setSelectedClient(client || null);
                      }}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    >
                      <option value="">Sélectionner un client...</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.first_name} {client.last_name} - {client.phone}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="text-center">
                    <span className="text-gray-500">ou</span>
                  </div>

                  <button
                    onClick={() => setIsCreatingClient(true)}
                    className="w-full mt-4 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md flex items-center justify-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Créer un nouveau client</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    value={newClient.first_name}
                    onChange={(e) => setNewClient(prev => ({ ...prev, first_name: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    placeholder="Prénom"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={newClient.last_name}
                    onChange={(e) => setNewClient(prev => ({ ...prev, last_name: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    placeholder="Nom"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone *
                </label>
                <input
                  type="tel"
                  value={newClient.phone}
                  onChange={(e) => setNewClient(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  placeholder="Numéro de téléphone"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adresse
                </label>
                <input
                  type="text"
                  value={newClient.address}
                  onChange={(e) => setNewClient(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  placeholder="Adresse complète"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={newClient.notes}
                  onChange={(e) => setNewClient(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  rows={3}
                  placeholder="Notes sur le client"
                />
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={handleCreateClient}
                  disabled={loading}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md disabled:opacity-50"
                >
                  {loading ? 'Création...' : 'Créer le client'}
                </button>
                <button
                  onClick={() => setIsCreatingClient(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Annuler
                </button>
              </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Détails de la vente */}
        {(selectedClient || autoCreateMode) && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Détails de la vente</h3>
            
            {/* Note sur les livraisons multiples */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-blue-800 text-sm">
                <strong>💡 Note :</strong> Une livraison peut concerner plusieurs ventes car un client peut faire plusieurs commandes dans la même journée.
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <textarea
                  value={saleData.description}
                  onChange={(e) => setSaleData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  rows={3}
                  placeholder="Description des produits/services"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Montant total *
                  </label>
                  <input
                    type="number"
                    value={saleData.total_amount}
                    onChange={(e) => setSaleData(prev => ({ ...prev, total_amount: parseFloat(e.target.value) || 0 }))}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Acompte
                  </label>
                  <input
                    type="number"
                    value={saleData.deposit}
                    onChange={(e) => setSaleData(prev => ({ ...prev, deposit: parseFloat(e.target.value) || 0 }))}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              {saleData.total_amount > 0 && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm text-gray-600">
                    <strong>Solde restant:</strong> {saleData.total_amount - saleData.deposit} FCFA
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-3">
          {autoCreateMode ? (
            <button
              onClick={handleAutoCreate}
              disabled={loading}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md disabled:opacity-50"
            >
              {loading ? 'Création automatique...' : '🚀 Créer automatiquement'}
            </button>
          ) : (
            <button
              onClick={handleCreateSale}
              disabled={loading || !selectedClient}
              className="flex-1 bg-pink-500 hover:bg-pink-600 text-white py-2 px-4 rounded-md disabled:opacity-50"
            >
              {loading ? 'Création...' : 'Créer la vente'}
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
};

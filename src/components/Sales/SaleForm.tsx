import React, { useState, useEffect, useRef } from 'react';
import { X, Save, ShoppingCart, Plus, User, Search, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Client, Sale } from '../../types';

interface SaleItem {
  id: string;
  article_id?: string;
  product_name: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  isNewProduct?: boolean;
}
import { SaleItemsManager } from './SaleItemsManager';

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
  // Fonction pour obtenir la date du jour au format YYYY-MM-DD
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Fonction pour convertir une date ISO en format YYYY-MM-DD
  const isoToDateString = (isoString: string) => {
    if (!isoString) return getTodayDateString();
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState({
    client_id: sale?.client_id || '',
    description: sale?.description || '',
    total_amount: sale?.total_amount || 0,
    deposit: sale?.deposit || 0,
    sale_date: sale?.created_at ? isoToDateString(sale.created_at) : getTodayDateString(),
  });
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
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
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animation d'entrée immédiate pour un affichage plus rapide
    setIsVisible(true);
    // Charger les clients en arrière-plan
    fetchClients();
    // Charger les articles de vente si on modifie une vente existante
    if (sale?.id) {
      fetchSaleItems();
    }
  }, [sale?.id]);

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
      // Limiter les champs récupérés pour améliorer les performances
      const { data, error } = await supabase
        .from('clients')
        .select('id, first_name, last_name, phone, tiktok_id, tiktok_nick_name')
        .order('first_name')
        .limit(1000); // Limiter à 1000 clients pour éviter les problèmes de performance

      if (error) throw error;
      setClients((data as Client[]) || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchSaleItems = async () => {
    if (!sale?.id) return;

    try {
      const { data, error } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', sale.id)
        .order('created_at');

      if (error) throw error;

      // Convertir les articles de la base de données au format SaleItem
      const items: SaleItem[] = (data || []).map((item: any) => ({
        id: item.id,
        article_id: item.article_id || undefined,
        product_name: item.product_name || item.name,
        sku: item.code || undefined,
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
        total_price: Number(item.total_price || item.total_amount),
        isNewProduct: false
      }));

      setSaleItems(items);
    } catch (error) {
      console.error('Error fetching sale items:', error);
      setError('Erreur lors du chargement des articles de vente');
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

    if (!formData.client_id || formData.client_id.trim() === '') {
      setError('Veuillez sélectionner un client');
      setLoading(false);
      return;
    }

    if (saleItems.length === 0) {
      setError('Veuillez ajouter au moins un article à la vente');
      setLoading(false);
      return;
    }

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

      // Convertir la date sélectionnée en ISO string avec l'heure de minuit (fuseau horaire local)
      // formData.sale_date est au format YYYY-MM-DD
      const [year, month, day] = formData.sale_date.split('-').map(Number);
      const saleDate = new Date(year, month - 1, day, 0, 0, 0, 0);
      // Convertir en ISO string en préservant la date locale
      const saleDateISO = saleDate.toISOString();

      if (sale) {
        // Update existing sale
        const updateData = {
          client_id: formData.client_id,
          description: formData.description,
          total_amount: formData.total_amount,
          deposit: formData.deposit,
          remaining_balance: remainingBalance,
          status,
          created_at: saleDateISO,
        };

        const { error } = await (supabase as any)
          .from('sales')
          .update(updateData)
          .eq('id', sale.id);
        
        if (error) throw error;

        // Récupérer les articles existants
        const { data: existingItems, error: fetchItemsError } = await supabase
          .from('sale_items')
          .select('id')
          .eq('sale_id', sale.id);

        if (fetchItemsError) throw fetchItemsError;

        const existingItemIds = new Set((existingItems || []).map((item: any) => item.id));
        const currentItemIds = new Set(saleItems.filter(item => item.id).map(item => item.id));

        // Supprimer les articles qui ne sont plus dans la liste
        const itemsToDelete = Array.from(existingItemIds).filter(id => !currentItemIds.has(id));
        if (itemsToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from('sale_items')
            .delete()
            .in('id', itemsToDelete);
          
          if (deleteError) throw deleteError;
        }

        // Mettre à jour ou créer les articles
        for (const item of saleItems) {
          if (item.id && existingItemIds.has(item.id)) {
            // Mettre à jour l'article existant
            const { error: updateError } = await supabase
              .from('sale_items')
              .update({
                article_id: item.article_id,
                product_name: item.product_name,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price
              } as any)
              .eq('id', item.id);
            
            if (updateError) throw updateError;
          } else {
            // Créer un nouvel article
            const { error: insertError } = await supabase
              .from('sale_items')
              .insert({
                sale_id: sale.id,
                article_id: item.article_id,
                product_name: item.product_name,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price
              } as any);
            
            if (insertError) throw insertError;
          }
        }
      } else {
        // Create new sale
        const { data: saleData, error } = await supabase
          .from('sales')
          .insert({
            client_id: formData.client_id,
            description: formData.description,
            total_amount: formData.total_amount,
            deposit: formData.deposit,
            remaining_balance: remainingBalance,
            status,
            created_at: saleDateISO,
            created_by: userProfileId,
          } as any)
          .select()
          .single();

        if (error) throw error;

        // Créer les articles de vente si c'est une nouvelle vente
        if (saleData && saleItems.length > 0) {
          const saleItemsData = saleItems.map(item => ({
            sale_id: (saleData as any).id,
            article_id: item.article_id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price
          }));

          const { error: itemsError } = await supabase
            .from('sale_items')
            .insert(saleItemsData as any);

          if (itemsError) {
            console.error('Erreur lors de la création des articles:', itemsError);
            throw itemsError; // Faire échouer la vente si les articles ne peuvent pas être créés
          }

          // Mettre à jour le stock et créer les mouvements pour chaque article
          for (const item of saleItems) {
            if (item.article_id) {
              // 1. Créer un mouvement de stock (le trigger mettra à jour automatiquement le stock)
              const { error: movementError } = await supabase
                .from('stock_movements')
                .insert({
                  product_id: item.article_id,
                  movement_type: 'out', // Type 'out' pour une sortie de stock
                  quantity: item.quantity, // Quantité positive, le trigger gère le signe
                  reference_id: (saleData as any).id,
                  reference_type: 'sale',
                  notes: `Vente - ${item.product_name}`,
                  created_by: userProfileId
                } as any);

              if (movementError) {
                console.error('Erreur lors de la création du mouvement de stock:', movementError);
                // Continuer même si le mouvement de stock échoue
              }

              // 2. Vérifier et créer le prix si nécessaire
              const { data: existingPrices, error: priceCheckError } = await supabase
                .from('product_prices')
                .select('id')
                .eq('product_id', item.article_id)
                .eq('is_active', true)
                .limit(1);

              if (!priceCheckError && (!existingPrices || existingPrices.length === 0)) {
                // Aucun prix actif trouvé, créer un prix de vente
                const { error: priceError } = await supabase
                  .from('product_prices')
                  .insert({
                    product_id: item.article_id,
                    price_type: 'retail',
                    price: item.unit_price,
                    currency: 'MGA',
                    valid_from: new Date().toISOString(),
                    is_active: true,
                    created_by: userProfileId
                  } as any);

                if (priceError) {
                  console.error('Erreur lors de la création du prix:', priceError);
                  // Continuer même si la création du prix échoue
                }
              }
            }
          }
        }
      }
      
      onSubmit();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Mettre à jour le montant total automatiquement basé sur les articles
  useEffect(() => {
    const totalFromItems = saleItems.reduce((sum, item) => sum + item.total_price, 0);
    if (totalFromItems > 0) {
      setFormData(prev => ({ ...prev, total_amount: totalFromItems }));
    }
  }, [saleItems]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 300); // Attendre la fin de l'animation
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50"
      onClick={handleClose}
    >
      <div
        className={`absolute right-0 top-0 h-full w-full max-w-6xl bg-white shadow-xl flex flex-col transform transition-transform duration-300 ease-in-out ${isVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête fixe */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <ShoppingCart className="text-blue-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">
              {sale ? 'Modifier la Vente' : 'Nouvelle Vente'}
            </h2>
          </div>
          <button
            onClick={handleClose}
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

            {/* Date et Client sur une seule ligne */}
            <div className="grid grid-cols-12 gap-4">
              {/* Champ Date - prend 3 colonnes */}
              <div className="col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de la vente
                </label>
                <input
                  type="date"
                  value={formData.sale_date}
                  onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Champ Client - prend 9 colonnes */}
              <div className="col-span-9">
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
                      className={`w-full pl-10 pr-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${!formData.client_id ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
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
                  {!formData.client_id && (
                    <p className="mt-1 text-xs text-red-600">
                      * Veuillez sélectionner un client
                    </p>
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
            </div>

            {/* Gestionnaire d'articles */}
            <SaleItemsManager
              items={saleItems}
              onItemsChange={setSaleItems}
              deposit={formData.deposit}
              onDepositChange={(deposit) => setFormData({ ...formData, deposit })}
            />
          </form>
        </div>

        {/* Pied de page fixe avec boutons */}
        <div className="flex space-x-3 p-6 border-t border-gray-200 flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
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
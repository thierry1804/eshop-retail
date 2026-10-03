import React, { useState, useEffect, useRef } from 'react';
import { devLog, devWarn } from '../../lib/devLog';
import { X, Save, ShoppingCart, Plus, User, ChevronDown } from 'lucide-react';
import { SearchField } from '../ui/SearchField';
import { Offcanvas, OffcanvasHeader, OffcanvasBody, OffcanvasFooter } from '../ui/Offcanvas';
import { supabase } from '../../lib/supabase';
import { Client, Sale } from '../../types';
import { findClientByPhone } from '../../lib/clientUtils';

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

  useEffect(() => {
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
      // Récupérer les articles
      const { data, error } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', sale.id)
        .order('created_at');

      if (error) {
        console.error('Erreur Supabase:', error);
        throw error;
      }

      // Identifier les articles sans product_name qui ont un article_id
      const itemsWithoutName = (data || []).filter((item: any) => 
        !item.product_name?.trim() && item.article_id
      );

      // Récupérer les noms des produits manquants depuis la table products
      const productNamesMap: Record<string, string> = {};
      if (itemsWithoutName.length > 0) {
        const articleIds = itemsWithoutName.map((item: any) => item.article_id).filter(Boolean);
        if (articleIds.length > 0) {
          const { data: productsData, error: productsError } = await supabase
            .from('products')
            .select('id, name')
            .in('id', articleIds);

          if (!productsError && productsData) {
            productsData.forEach((product: any) => {
              productNamesMap[product.id] = product.name;
            });
          }
        }
      }

      // Convertir les articles de la base de données au format SaleItem
      const items: SaleItem[] = (data || []).map((item: any) => {
        const quantity = Number(item.quantity) || 0;
        const unitPrice = Number(item.unit_price) || 0;
        // Calculer total_price si manquant ou invalide
        const totalPrice = item.total_price != null ? Number(item.total_price) : (quantity * unitPrice);
        
        // Récupérer product_name : d'abord depuis sale_items, sinon depuis products via article_id
        let productName = item.product_name?.trim();
        if (!productName && item.article_id && productNamesMap[item.article_id]) {
          productName = productNamesMap[item.article_id];
          devLog(`✅ Nom récupéré depuis products pour article_id ${item.article_id}: ${productName}`);
        }
        
        if (!productName) {
          devWarn('⚠️ Article sans product_name:', { id: item.id, article_id: item.article_id, product_name: item.product_name });
        }
        
        return {
          id: item.id,
          article_id: item.article_id || undefined,
          product_name: productName || 'Article sans nom',
          sku: undefined, // SKU n'est pas stocké dans sale_items
          quantity: quantity,
          unit_price: unitPrice,
          total_price: isNaN(totalPrice) ? 0 : totalPrice,
          isNewProduct: false
        };
      });

      devLog('✅ Articles de vente chargés:', items);
      setSaleItems(items);
      setError(''); // Réinitialiser l'erreur en cas de succès
    } catch (error: any) {
      console.error('❌ Error fetching sale items:', error);
      const errorMessage = error.message || error.details || 'Erreur inconnue';
      setError(`Erreur lors du chargement des articles de vente: ${errorMessage}`);
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

      // Vérifier si un client avec ce numéro de téléphone existe déjà
      const existingClient = await findClientByPhone(newClientData.phone);
      
      if (existingClient) {
        // Un client existe déjà avec ce numéro, le sélectionner automatiquement
        setError('Un client avec ce numéro existe déjà. Sélection automatique du client existant.');
        
        // S'assurer que le client est dans la liste
        const clientInList = clients.find(c => c.id === existingClient.id);
        if (!clientInList) {
          setClients(prev => [...prev, existingClient]);
        }
        
        // Sélectionner automatiquement le client existant
        handleClientSelect(existingClient);
        
        // Réinitialiser le formulaire de client
        setNewClientData({
          first_name: '',
          last_name: '',
          phone: '',
          address: '',
          notes: ''
        });
        
        setShowNewClientForm(false);
        setCreatingClient(false);
        return;
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

    // Recalculer le total_amount à partir des articles avant la soumission
    const totalFromItems = saleItems.reduce((sum, item) => {
      const itemTotal = Number(item.total_price) || 0;
      return sum + (isNaN(itemTotal) ? 0 : itemTotal);
    }, 0);

    if (totalFromItems <= 0) {
      setError('Le montant total de la vente doit être supérieur à 0');
      setLoading(false);
      return;
    }

    if (formData.deposit > totalFromItems) {
      setError('L\'acompte ne peut pas être supérieur au montant total');
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const remainingBalance = totalFromItems - formData.deposit;
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

      // Convertir la date sélectionnée en conservant l'heure originale si c'est une modification
      // formData.sale_date est au format YYYY-MM-DD - c'est la date saisie par l'utilisateur
      const [year, month, day] = formData.sale_date.split('-').map(Number);
      
      let saleDateISO: string;
      
      if (sale && sale.created_at) {
        // Si c'est une modification, conserver l'heure originale mais changer la date
        const originalDate = new Date(sale.created_at);
        const originalHours = originalDate.getUTCHours();
        const originalMinutes = originalDate.getUTCMinutes();
        const originalSeconds = originalDate.getUTCSeconds();
        const originalMilliseconds = originalDate.getUTCMilliseconds();
        
        // Créer la nouvelle date avec la date saisie mais l'heure originale
        const newDate = new Date(Date.UTC(year, month - 1, day, originalHours, originalMinutes, originalSeconds, originalMilliseconds));
        saleDateISO = newDate.toISOString();
        
        devLog('📅 Modification: Date originale:', sale.created_at);
        devLog('📅 Heure conservée:', `${originalHours}:${originalMinutes}:${originalSeconds}`);
        devLog('📅 Nouvelle date:', saleDateISO);
      } else {
        // Si c'est une création, utiliser midi UTC pour éviter les problèmes de fuseau horaire
        const saleDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
        saleDateISO = saleDate.toISOString();
        
        devLog('📅 Création: Date saisie:', formData.sale_date, '→ Date ISO:', saleDateISO);
      }

      if (sale) {
        // Update existing sale
        const updateData = {
          client_id: formData.client_id,
          description: formData.description,
          total_amount: totalFromItems,
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
            total_amount: totalFromItems,
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
    const totalFromItems = saleItems.reduce((sum, item) => {
      const itemTotal = Number(item.total_price) || 0;
      return sum + (isNaN(itemTotal) ? 0 : itemTotal);
    }, 0);
    // Toujours mettre à jour le total_amount, même s'il est 0
    setFormData(prev => ({ ...prev, total_amount: totalFromItems }));
  }, [saleItems]);

  return (
    <Offcanvas
      onClose={onClose}
      width="xl"
      ariaLabel={sale ? 'Modifier la vente' : 'Nouvelle vente'}
    >
      <OffcanvasHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <ShoppingCart className="app-text-link flex-shrink-0 h-5 w-5" />
            <h2 className="app-page-title truncate">
              {sale ? 'Modifier la Vente' : 'Nouvelle Vente'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="app-icon-btn flex-shrink-0"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </OffcanvasHeader>

      <form id="sale-form" onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <OffcanvasBody className="space-y-4">
            {error && (
              <div
                className="px-3 py-2 rounded-md text-sm"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--app-danger) 10%, var(--app-surface))',
                  border: '1px solid color-mix(in srgb, var(--app-danger) 30%, var(--app-border))',
                  color: 'var(--app-danger)'
                }}
              >
                {error}
              </div>
            )}

            {/* Date + Client : empilés mobile, côte à côte dès sm */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
              <div className="sm:col-span-4 lg:col-span-3">
                <label className="app-label" htmlFor="sale-date">
                  Date de la vente
                </label>
                <input
                  id="sale-date"
                  type="date"
                  value={formData.sale_date}
                  onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
                  className="app-input"
                />
              </div>

              <div className="sm:col-span-8 lg:col-span-9">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="app-label mb-0">
                    Client *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNewClientForm(!showNewClientForm)}
                    className="app-btn app-btn-ghost app-btn-sm"
                    style={{ color: 'var(--app-primary-deep)' }}
                  >
                    <Plus size={16} />
                    <span className="hidden xs:inline sm:inline">Nouveau client</span>
                    <span className="sm:hidden">Nouveau</span>
                  </button>
                </div>

              {!showNewClientForm ? (
                <div className="relative" ref={clientSearchRef}>
                  <div className="relative">
                    <SearchField
                      required
                      value={clientSearchTerm}
                      onChange={handleClientSearchChange}
                      onFocus={() => setShowClientDropdown(true)}
                      placeholder="Nom ou téléphone…"
                      className="w-full"
                      inputClassName={`pr-10 ${!formData.client_id ? 'border-red-300' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowClientDropdown(!showClientDropdown)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 app-icon-btn"
                      aria-label="Liste des clients"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>

                  {showClientDropdown && (
                    <div
                      className="absolute z-20 w-full mt-1 max-h-60 overflow-y-auto app-surface"
                      style={{ boxShadow: 'var(--app-shadow-panel)' }}
                    >
                      {filteredClients.length > 0 ? (
                        filteredClients.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => handleClientSelect(client)}
                            className="w-full px-3 py-3 sm:py-2.5 text-left border-b last:border-b-0 min-h-[44px]"
                            style={{ borderColor: 'var(--app-border)' }}
                          >
                            <div className="text-sm font-medium" style={{ color: 'var(--app-ink)' }}>
                              {client.first_name} {client.last_name}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--app-ink-muted)' }}>
                              {client.phone}
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-3 text-sm" style={{ color: 'var(--app-ink-muted)' }}>
                          {clientSearchTerm.trim() ? 'Aucun client trouvé' : 'Aucun client disponible'}
                        </div>
                      )}
                    </div>
                  )}
                  {!formData.client_id && (
                    <p className="mt-1 text-xs" style={{ color: 'var(--app-danger)' }}>
                      Sélectionnez un client
                    </p>
                  )}
                </div>
              ) : (
                <div
                  className="space-y-3 p-3 sm:p-4 rounded-md"
                  style={{
                    border: '1px solid color-mix(in srgb, var(--app-primary) 30%, var(--app-border))',
                    backgroundColor: 'color-mix(in srgb, var(--app-primary) 8%, var(--app-surface))'
                  }}
                >
                  <div className="flex items-center gap-2">
                    <User size={18} style={{ color: 'var(--app-primary)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--app-primary-deep)' }}>
                      Nouveau client
                    </span>
                  </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="app-label" htmlFor="new-client-first">Prénom *</label>
                        <input
                          id="new-client-first"
                          type="text"
                          required
                          value={newClientData.first_name}
                          onChange={(e) => setNewClientData({ ...newClientData, first_name: e.target.value })}
                          className="app-input"
                          placeholder="Prénom"
                        />
                      </div>
                      <div>
                        <label className="app-label" htmlFor="new-client-last">Nom *</label>
                        <input
                          id="new-client-last"
                          type="text"
                          required
                          value={newClientData.last_name}
                          onChange={(e) => setNewClientData({ ...newClientData, last_name: e.target.value })}
                          className="app-input"
                          placeholder="Nom"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="app-label" htmlFor="new-client-phone">Téléphone *</label>
                      <input
                        id="new-client-phone"
                        type="tel"
                        required
                        value={newClientData.phone}
                        onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                        className="app-input"
                        placeholder="+261 34 12 34 56"
                      />
                    </div>

                    <div>
                      <label className="app-label" htmlFor="new-client-address">Adresse</label>
                      <input
                        id="new-client-address"
                        type="text"
                        value={newClientData.address}
                        onChange={(e) => setNewClientData({ ...newClientData, address: e.target.value })}
                        className="app-input"
                        placeholder="Adresse complète"
                      />
                    </div>

                    <div>
                      <label className="app-label" htmlFor="new-client-notes">Notes</label>
                      <textarea
                        id="new-client-notes"
                        value={newClientData.notes}
                        onChange={(e) => setNewClientData({ ...newClientData, notes: e.target.value })}
                        rows={2}
                        className="app-input"
                        placeholder="Informations supplémentaires…"
                      />
                    </div>

                  <div className="app-actions flex-col-reverse sm:flex-row w-full pt-1">
                    <button
                      type="button"
                      onClick={() => setShowNewClientForm(false)}
                      className="app-btn app-btn-secondary w-full sm:flex-1"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={createNewClient}
                      disabled={creatingClient}
                      className="app-btn app-btn-primary w-full sm:flex-1 disabled:opacity-50"
                    >
                      <Plus size={16} />
                      <span>{creatingClient ? 'Création…' : 'Créer'}</span>
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
        </OffcanvasBody>

        <OffcanvasFooter>
          <div className="app-actions flex-col-reverse sm:flex-row w-full">
            <button
              type="button"
              onClick={onClose}
              className="app-btn app-btn-secondary w-full sm:flex-1"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="sale-form"
              disabled={loading}
              className="app-btn app-btn-primary w-full sm:flex-1"
            >
              <Save className="h-4 w-4" />
              <span>{loading ? 'Enregistrement...' : 'Enregistrer'}</span>
            </button>
          </div>
        </OffcanvasFooter>
      </form>
    </Offcanvas>
  );
};
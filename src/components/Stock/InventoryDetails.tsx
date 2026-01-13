import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Inventory, InventoryItem, Product, User } from '../../types';
import { X, Search, Filter, CheckCircle, AlertTriangle, Save } from 'lucide-react';
import { InventorySummary } from './InventorySummary';
import { InventoryItemRow } from './InventoryItemRow';
import { logger } from '../../lib/logger';

interface InventoryDetailsProps {
  inventory: Inventory;
  user: User;
  onClose: () => void;
  onUpdate: () => void;
}

export const InventoryDetails: React.FC<InventoryDetailsProps> = ({
  inventory,
  user,
  onClose,
  onUpdate
}) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string>('');
  // État local pour les statistiques de l'inventaire (mis à jour sans rechargement)
  const [localInventoryStats, setLocalInventoryStats] = useState({
    total_products: inventory.total_products,
    counted_products: inventory.counted_products,
    total_discrepancies: inventory.total_discrepancies
  });

  useEffect(() => {
    fetchInventoryDetails();
  }, [inventory.id]);

  const fetchInventoryDetails = async () => {
    try {
      setLoading(true);
      
      // Charger les items et les produits en parallèle
      const [itemsResult, productsResult] = await Promise.all([
        supabase
          .from('inventory_items')
          .select('*')
          .eq('inventory_id', inventory.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('products')
          .select(`
            *,
            category:categories(name),
            supplier:suppliers(name)
          `)
          .eq('status', 'active')
      ]);

      if (itemsResult.error) throw itemsResult.error;
      if (productsResult.error) throw productsResult.error;

      const itemsData = itemsResult.data || [];
      const productsData = productsResult.data || [];

      // Récupérer les profils utilisateurs pour les items qui ont un counted_by
      if (itemsData.length > 0) {
        const userIds = new Set<string>();
        itemsData.forEach(item => {
          if (item.counted_by) userIds.add(item.counted_by);
        });

        if (userIds.size > 0) {
          const { data: userProfiles } = await supabase
            .from('user_profiles')
            .select('id, email, name')
            .in('id', Array.from(userIds));

          const profilesMap = new Map(
            (userProfiles || []).map(profile => [profile.id, profile])
          );

          // Ajouter les profils aux items
          itemsData.forEach(item => {
            if (item.counted_by) {
              (item as any).counted_by_user = profilesMap.get(item.counted_by) || null;
            }
          });
        }
      }

      // Créer un map des produits pour accès rapide
      const productsMap: Record<string, Product> = {};
      productsData.forEach(product => {
        productsMap[product.id] = product;
      });

      setItems(itemsData as InventoryItem[]);
      setProducts(productsMap);
      
      // Mettre à jour les statistiques locales basées sur les items récupérés
      const totalProducts = itemsData.length;
      const countedProducts = itemsData.filter(item => item.actual_quantity !== null && item.actual_quantity !== undefined).length;
      const totalDiscrepancies = itemsData.filter(item => 
        item.actual_quantity !== null && 
        item.actual_quantity !== undefined && 
        (item.actual_quantity - item.theoretical_quantity) !== 0
      ).length;
      
      setLocalInventoryStats({
        total_products: totalProducts,
        counted_products: countedProducts,
        total_discrepancies: totalDiscrepancies
      });
    } catch (error) {
      console.error('Erreur lors du chargement des détails:', error);
      setError('Erreur lors du chargement des détails de l\'inventaire');
    } finally {
      setLoading(false);
    }
  };

  const handleItemUpdate = async (itemId: string, actualQuantity: number, notes?: string) => {
    try {
      const { error } = await supabase
        .from('inventory_items')
        .update({
          actual_quantity: actualQuantity,
          notes: notes || null,
          counted_by: user.id,
          counted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId);

      if (error) throw error;

      // Trouver l'item avant la mise à jour pour calculer l'écart
      const itemBeforeUpdate = items.find(i => i.id === itemId);
      const discrepancy = actualQuantity - (itemBeforeUpdate?.theoretical_quantity || 0);

      // Mettre à jour l'état local avec le nouvel écart calculé
      setItems(prevItems => {
        const updatedItems = prevItems.map(item =>
          item.id === itemId
            ? {
                ...item,
                actual_quantity: actualQuantity,
                notes: notes || null,
                counted_by: user.id,
                counted_at: new Date().toISOString(),
                discrepancy: discrepancy
              }
            : item
        );

        // Calculer les nouvelles statistiques localement
        const totalProducts = updatedItems.length;
        const countedProducts = updatedItems.filter(item => item.actual_quantity !== null && item.actual_quantity !== undefined).length;
        const totalDiscrepancies = updatedItems.filter(item => 
          item.actual_quantity !== null && 
          item.actual_quantity !== undefined && 
          (item.actual_quantity - item.theoretical_quantity) !== 0
        ).length;

        // Mettre à jour les statistiques locales
        setLocalInventoryStats({
          total_products: totalProducts,
          counted_products: countedProducts,
          total_discrepancies: totalDiscrepancies
        });

        return updatedItems;
      });

      // Logger l'action
      if (itemBeforeUpdate) {
        await logger.log('INVENTORY_ITEM_COUNTED', {
          component: 'InventoryDetails',
          inventory_id: inventory.id,
          item_id: itemId,
          product_id: itemBeforeUpdate.product_id,
          theoretical_quantity: itemBeforeUpdate.theoretical_quantity,
          actual_quantity: actualQuantity,
          discrepancy: discrepancy,
          notes: notes || null,
          user_id: user.id,
          user_email: user.email
        });
      }

      // Ne pas appeler onUpdate() ici pour éviter le rechargement
      // Les statistiques seront mises à jour automatiquement par le trigger DB
      // On appellera onUpdate() seulement à la fermeture de la modale
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      throw error;
    }
  };

  const handleFinalize = async () => {
    if (!confirm('Êtes-vous sûr de vouloir finaliser cet inventaire ? Les ajustements de stock seront appliqués.')) {
      return;
    }

    setFinalizing(true);
    setError('');

    try {
      // Appeler la fonction SQL pour finaliser l'inventaire
      const { data, error: functionError } = await supabase.rpc('finalize_inventory', {
        p_inventory_id: inventory.id,
        p_completed_by: user.id
      });

      if (functionError) throw functionError;

      if (!data || !data.success) {
        throw new Error(data?.error || 'Erreur lors de la finalisation');
      }

      // Logger l'action
      await logger.log('INVENTORY_COMPLETED', {
        component: 'InventoryDetails',
        inventory_id: inventory.id,
        adjustments_count: data.adjustments_count || 0,
        errors: data.errors || [],
        user_id: user.id,
        user_email: user.email
      });

      // Rafraîchir les données et fermer la modale
      onUpdate();
      onClose();
    } catch (error: any) {
      console.error('Erreur lors de la finalisation:', error);
      setError(error.message || 'Erreur lors de la finalisation de l\'inventaire');
      
      await logger.logError(error as Error, 'InventoryDetails');
    } finally {
      setFinalizing(false);
    }
  };

  const filteredItems = items.filter(item => {
    const product = products[item.product_id];
    if (!product) return false;

    const matchesSearch = 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = (() => {
      switch (filterType) {
        case 'all':
          return true;
        case 'not_counted':
          return item.actual_quantity === null || item.actual_quantity === undefined;
        case 'with_discrepancy':
          return item.actual_quantity !== null && 
                 item.actual_quantity !== undefined && 
                 item.discrepancy !== 0;
        case 'no_discrepancy':
          return item.actual_quantity !== null && 
                 item.actual_quantity !== undefined && 
                 item.discrepancy === 0;
        default:
          return true;
      }
    })();

    return matchesSearch && matchesFilter;
  });

  const canFinalize = inventory.status !== 'completed' && 
                      localInventoryStats.counted_products === localInventoryStats.total_products &&
                      localInventoryStats.total_products > 0;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl my-8 max-h-[90vh] flex flex-col">
        {/* En-tête */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Inventaire du {new Date(inventory.inventory_date).toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              ID: {inventory.id.substring(0, 8)}...
            </p>
          </div>
          <button
            onClick={() => {
              // Synchroniser les données avant de fermer
              onUpdate();
              onClose();
            }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={finalizing}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Résumé */}
          <InventorySummary inventory={{
            ...inventory,
            total_products: localInventoryStats.total_products,
            counted_products: localInventoryStats.counted_products,
            total_discrepancies: localInventoryStats.total_discrepancies
          }} />

          {/* Filtres et recherche */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Rechercher un produit..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Tous</option>
                  <option value="not_counted">Non comptés</option>
                  <option value="with_discrepancy">Avec écarts</option>
                  <option value="no_discrepancy">Sans écarts</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tableau des produits */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Produit
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock théorique
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantité réelle
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Écart
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Notes
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        Aucun produit trouvé
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const product = products[item.product_id];
                      if (!product) return null;

                      return (
                        <InventoryItemRow
                          key={item.id}
                          item={item}
                          product={product}
                          user={user}
                          onUpdate={handleItemUpdate}
                          disabled={inventory.status === 'completed' || finalizing}
                        />
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Pied de page */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="text-sm text-gray-600">
            {filteredItems.length} produit(s) affiché(s) sur {items.length}
          </div>
          <div className="flex items-center gap-3">
            {inventory.status !== 'completed' && (
              <button
                onClick={handleFinalize}
                disabled={!canFinalize || finalizing}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  canFinalize && !finalizing
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {finalizing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Finalisation...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Finaliser l'inventaire
                  </>
                )}
              </button>
            )}
            <button
              onClick={() => {
                // Synchroniser les données avant de fermer
                onUpdate();
                onClose();
              }}
              disabled={finalizing}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


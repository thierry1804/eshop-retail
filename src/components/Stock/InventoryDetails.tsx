import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Inventory, InventoryItem, Product, User } from '../../types';
import { X, Filter, CheckCircle, AlertTriangle, Save } from 'lucide-react';
import { SearchField } from '../ui/SearchField';
import { InventorySummary } from './InventorySummary';
import { InventoryItemRow } from './InventoryItemRow';
import { logger } from '../../lib/logger';
import { Offcanvas, OffcanvasHeader, OffcanvasBody, OffcanvasFooter } from '../ui/Offcanvas';
import { formatDateDisplay } from '../../lib/dateUtils';

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

  const handleClose = () => {
    onUpdate();
    onClose();
  };

  if (loading) {
    return (
      <Offcanvas onClose={handleClose} width="xl">
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--app-primary)]"></div>
        </div>
      </Offcanvas>
    );
  }

  return (
    <Offcanvas onClose={handleClose} width="xl">
        <OffcanvasHeader>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold app-text">
              Inventaire du {formatDateDisplay(inventory.inventory_date)}
            </h2>
            <p className="text-xs app-text-muted mt-0.5">
              ID: {inventory.id.substring(0, 8)}...
            </p>
          </div>
          <button
            onClick={handleClose}
            className="app-text-muted hover:text-[var(--app-ink-muted)] transition-colors"
            disabled={finalizing}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        </OffcanvasHeader>

        <OffcanvasBody className="px-4 sm:px-6 py-4">
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
          <div className="app-bg-muted rounded-lg p-4 mb-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <SearchField
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Rechercher un produit..."
                  className="w-full"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 app-text-muted" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-4 py-2 border app-border rounded-lg focus:ring-2 focus:ring-[var(--app-primary)] focus:border-transparent"
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
          <div className="app-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="app-table-striped min-w-full divide-y divide-[var(--app-border)]">
                <thead className="app-bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left app-label uppercase text-xs font-medium tracking-wider">
                      Produit
                    </th>
                    <th className="px-4 py-3 text-left app-label uppercase text-xs font-medium tracking-wider">
                      Stock théorique
                    </th>
                    <th className="px-4 py-3 text-left app-label uppercase text-xs font-medium tracking-wider">
                      Quantité réelle
                    </th>
                    <th className="px-4 py-3 text-left app-label uppercase text-xs font-medium tracking-wider">
                      Écart
                    </th>
                    <th className="px-4 py-3 text-left app-label uppercase text-xs font-medium tracking-wider">
                      Notes
                    </th>
                    <th className="px-4 py-3 text-left app-label uppercase text-xs font-medium tracking-wider">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-[var(--app-surface)] divide-y divide-[var(--app-border)]">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center app-text-muted">
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
        </OffcanvasBody>

        <OffcanvasFooter className="app-bg-muted">
          <div className="flex items-center justify-between gap-3">
          <div className="text-sm app-text-muted">
            {filteredItems.length} produit(s) affiché(s) sur {items.length}
          </div>
          <div className="flex items-center gap-3">
            {inventory.status !== 'completed' && (
              <button
                onClick={handleFinalize}
                disabled={!canFinalize || finalizing}
                className={`app-btn ${
                  canFinalize && !finalizing
                    ? 'app-btn-success'
                    : 'app-btn-secondary opacity-50 cursor-not-allowed'
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
              onClick={handleClose}
              disabled={finalizing}
              className="app-btn app-btn-secondary"
            >
              Fermer
            </button>
          </div>
          </div>
        </OffcanvasFooter>
    </Offcanvas>
  );
};


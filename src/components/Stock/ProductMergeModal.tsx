import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Package, TrendingUp, ShoppingCart, Eye, Trash2, ShoppingBag, ArrowUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Product, User, MergePreview } from '../../types';
import { useTranslation } from 'react-i18next';

interface ProductMergeModalProps {
  duplicateGroup: Product[];
  onClose: () => void;
  onMergeComplete: () => void;
  user: User;
}

export const ProductMergeModal: React.FC<ProductMergeModalProps> = ({
  duplicateGroup,
  onClose,
  onMergeComplete,
  user
}) => {
  const { t } = useTranslation();
  const [selectedMaster, setSelectedMaster] = useState<string>('');
  const [selectedDuplicate, setSelectedDuplicate] = useState<string>('');
  const [deleteDuplicate, setDeleteDuplicate] = useState<boolean>(false);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productLastOrders, setProductLastOrders] = useState<Record<string, { orderId: string; date: string; trackingNumber?: string }>>({});
  const [productLastSales, setProductLastSales] = useState<Record<string, { saleId: string; date: string }>>({});
  const [productLastStockIns, setProductLastStockIns] = useState<Record<string, { referenceId: string; referenceType?: string; date: string }>>({});
  const [loadingActivity, setLoadingActivity] = useState(true);

  // Charger les données d'activité pour tous les produits du groupe
  useEffect(() => {
    if (duplicateGroup.length > 0) {
      loadActivityData();
    }
  }, [duplicateGroup]);

  // Sélectionner automatiquement le master suggéré après chargement des données
  useEffect(() => {
    if (duplicateGroup.length > 0 && !selectedMaster && !loadingActivity) {
      // Suggérer le produit avec le plus d'activité
      const suggested = selectSuggestedMaster(duplicateGroup);
      setSelectedMaster(suggested.id);
    }
  }, [duplicateGroup, loadingActivity]);

  // Charger les données d'activité (commandes, ventes, approvisionnements)
  const loadActivityData = async () => {
    if (duplicateGroup.length === 0) return;

    setLoadingActivity(true);
    const productIds = duplicateGroup.map(p => p.id);

    try {
      // Charger en parallèle toutes les données d'activité
      const [ordersResult, salesResult, stockInsResult] = await Promise.all([
        fetchLastOrders(productIds),
        fetchLastSales(productIds),
        fetchLastStockIns(productIds)
      ]);

      setProductLastOrders(ordersResult);
      setProductLastSales(salesResult);
      setProductLastStockIns(stockInsResult);
    } catch (error) {
      console.error('Erreur lors du chargement des données d\'activité:', error);
    } finally {
      setLoadingActivity(false);
    }
  };

  // Récupérer les dernières commandes pour les produits
  const fetchLastOrders = async (productIds: string[]): Promise<Record<string, { orderId: string; date: string; trackingNumber?: string }>> => {
    try {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select(`
          product_id,
          purchase_order_id,
          purchase_orders!inner(
            id,
            created_at,
            tracking_number
          )
        `)
        .in('product_id', productIds);

      if (error) throw error;

      const lastOrdersMap: Record<string, { orderId: string; date: string; trackingNumber?: string }> = {};
      if (data) {
        type OrderItemWithOrder = {
          product_id: string;
          purchase_order_id: string;
          purchase_orders: {
            id: string;
            created_at: string;
            tracking_number?: string;
          } | {
            id: string;
            created_at: string;
            tracking_number?: string;
          }[] | null;
        };

        const sortedData = [...(data as OrderItemWithOrder[])].sort((a, b) => {
          const orderA = Array.isArray(a.purchase_orders) ? a.purchase_orders[0] : a.purchase_orders;
          const orderB = Array.isArray(b.purchase_orders) ? b.purchase_orders[0] : b.purchase_orders;
          const dateA = orderA?.created_at || '';
          const dateB = orderB?.created_at || '';
          return dateB.localeCompare(dateA);
        });

        for (const item of sortedData) {
          const productId = item.product_id;
          if (!lastOrdersMap[productId]) {
            const order = Array.isArray(item.purchase_orders) ? item.purchase_orders[0] : item.purchase_orders;
            if (order) {
              lastOrdersMap[productId] = {
                orderId: item.purchase_order_id,
                date: order.created_at,
                trackingNumber: order.tracking_number
              };
            }
          }
        }
      }

      return lastOrdersMap;
    } catch (error) {
      console.error('Erreur lors du chargement des commandes:', error);
      return {};
    }
  };

  // Récupérer les dernières ventes pour les produits
  const fetchLastSales = async (productIds: string[]): Promise<Record<string, { saleId: string; date: string }>> => {
    try {
      const { data, error } = await supabase
        .from('sale_items')
        .select(`
          article_id,
          sale_id,
          sales!inner(
            id,
            created_at
          )
        `)
        .in('article_id', productIds)
        .not('article_id', 'is', null);

      if (error) throw error;

      const lastSalesMap: Record<string, { saleId: string; date: string }> = {};
      if (data) {
        type SaleItemWithSale = {
          article_id: string;
          sale_id: string;
          sales: {
            id: string;
            created_at: string;
          } | {
            id: string;
            created_at: string;
          }[] | null;
        };

        const sortedData = [...(data as SaleItemWithSale[])].sort((a, b) => {
          const saleA = Array.isArray(a.sales) ? a.sales[0] : a.sales;
          const saleB = Array.isArray(b.sales) ? b.sales[0] : b.sales;
          const dateA = saleA?.created_at || '';
          const dateB = saleB?.created_at || '';
          return dateB.localeCompare(dateA);
        });

        for (const item of sortedData) {
          const productId = item.article_id;
          if (!lastSalesMap[productId]) {
            const sale = Array.isArray(item.sales) ? item.sales[0] : item.sales;
            if (sale) {
              lastSalesMap[productId] = {
                saleId: item.sale_id,
                date: sale.created_at
              };
            }
          }
        }
      }

      return lastSalesMap;
    } catch (error) {
      console.error('Erreur lors du chargement des ventes:', error);
      return {};
    }
  };

  // Récupérer les derniers approvisionnements pour les produits
  const fetchLastStockIns = async (productIds: string[]): Promise<Record<string, { referenceId: string; referenceType?: string; date: string }>> => {
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          product_id,
          reference_id,
          reference_type,
          created_at
        `)
        .in('product_id', productIds)
        .or('movement_type.eq.in,reference_type.eq.purchase')
        .not('product_id', 'is', null);

      if (error) throw error;

      const lastStockInsMap: Record<string, { referenceId: string; referenceType?: string; date: string }> = {};
      if (data) {
        type StockMovement = {
          product_id: string;
          reference_id: string | null;
          reference_type: string | null;
          created_at: string;
        };

        const sortedData = [...(data as StockMovement[])].sort((a, b) => {
          return b.created_at.localeCompare(a.created_at);
        });

        for (const movement of sortedData) {
          const productId = movement.product_id;
          if (!lastStockInsMap[productId] && movement.reference_id) {
            lastStockInsMap[productId] = {
              referenceId: movement.reference_id,
              referenceType: movement.reference_type || undefined,
              date: movement.created_at
            };
          }
        }
      }

      return lastStockInsMap;
    } catch (error) {
      console.error('Erreur lors du chargement des approvisionnements:', error);
      return {};
    }
  };

  // Fonction pour suggérer le master
  const selectSuggestedMaster = (products: Product[]): Product => {
    return products.reduce((best, current) => {
      // Critères de sélection : activité, stock, statut actif
      const bestHasOrder = productLastOrders[best.id] ? 1 : 0;
      const bestHasSale = productLastSales[best.id] ? 1 : 0;
      const bestHasStockIn = productLastStockIns[best.id] ? 1 : 0;
      const bestActivity = bestHasOrder + bestHasSale + bestHasStockIn;
      
      const currentHasOrder = productLastOrders[current.id] ? 1 : 0;
      const currentHasSale = productLastSales[current.id] ? 1 : 0;
      const currentHasStockIn = productLastStockIns[current.id] ? 1 : 0;
      const currentActivity = currentHasOrder + currentHasSale + currentHasStockIn;
      
      const bestScore = (bestActivity * 1000) + 
                       (best.current_stock || 0) + 
                       (best.status === 'active' ? 500 : 0);
      const currentScore = (currentActivity * 1000) + 
                          (current.current_stock || 0) + 
                          (current.status === 'active' ? 500 : 0);
      return currentScore > bestScore ? current : best;
    });
  };

  // Charger la prévisualisation
  const loadPreview = async () => {
    if (!selectedMaster || !selectedDuplicate) {
      setPreview(null);
      return;
    }
    
    setPreviewLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.rpc('preview_merge', {
        master_product_id: selectedMaster,
        duplicate_product_id: selectedDuplicate
      });
      
      if (error) throw error;
      setPreview(data as MergePreview);
    } catch (err: any) {
      setError(err.message);
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (selectedMaster && selectedDuplicate) {
      loadPreview();
    } else {
      setPreview(null);
    }
  }, [selectedMaster, selectedDuplicate]);

  // Exécuter la fusion
  const handleMerge = async () => {
    if (!selectedMaster || !selectedDuplicate) {
      setError('Veuillez sélectionner un produit maître et un produit à fusionner');
      return;
    }

    if (!user?.id) {
      setError('Utilisateur non identifié. Veuillez vous reconnecter.');
      return;
    }

    const masterProduct = duplicateGroup.find(p => p.id === selectedMaster);
    const duplicateProduct = duplicateGroup.find(p => p.id === selectedDuplicate);

    if (!window.confirm(
      `Êtes-vous sûr de vouloir fusionner ces produits ?\n\n` +
      `Produit maître: ${masterProduct?.name}\n` +
      `Produit à fusionner: ${duplicateProduct?.name}\n\n` +
      `${deleteDuplicate ? '⚠️ Le produit sera supprimé définitivement.' : 'Le produit sera marqué comme discontinué.'}\n\n` +
      `Cette action est irréversible.`
    )) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Valider les UUID avant l'appel
      const masterId = selectedMaster.trim();
      const duplicateId = selectedDuplicate.trim();
      const userId = user.id.trim();

      if (!masterId || !duplicateId || !userId) {
        throw new Error('IDs de produits ou utilisateur invalides');
      }

      console.log('Appel merge_products avec:', {
        master_product_id: masterId,
        duplicate_product_id: duplicateId,
        merge_user_id: userId,
        delete_duplicate: deleteDuplicate
      });

      const { data, error } = await supabase.rpc('merge_products', {
        master_product_id: masterId,
        duplicate_product_id: duplicateId,
        merge_user_id: userId,
        delete_duplicate: deleteDuplicate
      });

      if (error) {
        console.error('Erreur RPC merge_products:', error);
        throw new Error(error.message || `Erreur lors de la fusion: ${error.code || 'Unknown error'}`);
      }

      if (!data || !data.success) {
        throw new Error('La fusion a échoué sans retourner de succès');
      }

      alert(`Fusion réussie !\nStock consolidé: ${data.master_new_stock} ${masterProduct?.unit || ''}`);
      onMergeComplete();
      onClose();
    } catch (err: any) {
      console.error('Erreur complète lors de la fusion:', err);
      setError(err.message || 'Erreur lors de la fusion');
    } finally {
      setLoading(false);
    }
  };

  const masterProduct = duplicateGroup.find(p => p.id === selectedMaster);
  const duplicateProduct = duplicateGroup.find(p => p.id === selectedDuplicate);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Fusionner les produits en doublon
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {duplicateGroup.length} produits avec le même nom détectés
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Sélection du produit maître */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Produit maître (produit qui sera conservé) *
            </label>
            <div className="space-y-2">
              {duplicateGroup.map(product => (
                <label
                  key={product.id}
                  className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedMaster === product.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="master"
                    value={product.id}
                    checked={selectedMaster === product.id}
                    onChange={(e) => {
                      setSelectedMaster(e.target.value);
                      // Si le produit sélectionné était le duplicate, le désélectionner
                      if (selectedDuplicate === e.target.value) {
                        setSelectedDuplicate('');
                      }
                    }}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1 flex items-start gap-4">
                    {/* Informations principales à gauche */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{product.name}</span>
                        {selectedMaster === product.id && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            MAÎTRE
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mt-1 space-y-1">
                        <div>SKU: {product.sku}</div>
                        <div>Stock: {product.current_stock} {product.unit}</div>
                        <div>Statut: {product.status}</div>
                        <div className="text-xs text-gray-500">
                          Créé le: {new Date(product.created_at).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                    </div>
                    
                    {/* Détails d'activité à droite */}
                    <div className="flex-shrink-0 w-48">
                      {loadingActivity ? (
                        <div className="text-xs text-gray-400">Chargement...</div>
                      ) : (
                        <div className="space-y-2 text-xs">
                          {productLastOrders[product.id] && (
                            <div className="flex items-start gap-1.5 text-gray-600">
                              <ShoppingCart className="h-3.5 w-3.5 text-blue-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium">Dernière commande</div>
                                <div className="text-gray-500">{new Date(productLastOrders[product.id].date).toLocaleDateString('fr-FR')}</div>
                                {productLastOrders[product.id].trackingNumber && (
                                  <div className="text-gray-700 font-mono mt-0.5">
                                    {productLastOrders[product.id].trackingNumber}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          {productLastStockIns[product.id] && (
                            <div className="flex items-start gap-1.5 text-gray-600">
                              <ArrowUp className="h-3.5 w-3.5 text-purple-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium">Dernier approvisionnement</div>
                                <div className="text-gray-500">{new Date(productLastStockIns[product.id].date).toLocaleDateString('fr-FR')}</div>
                              </div>
                            </div>
                          )}
                          {productLastSales[product.id] && (
                            <div className="flex items-start gap-1.5 text-gray-600">
                              <ShoppingBag className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium">Dernière vente</div>
                                <div className="text-gray-500">{new Date(productLastSales[product.id].date).toLocaleDateString('fr-FR')}</div>
                              </div>
                            </div>
                          )}
                          {!productLastOrders[product.id] && !productLastStockIns[product.id] && !productLastSales[product.id] && (
                            <div className="text-gray-400 italic">Aucune activité</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Sélection du produit à fusionner */}
          {selectedMaster && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Produit à fusionner vers le maître *
              </label>
              <div className="space-y-2">
                {duplicateGroup
                  .filter(p => p.id !== selectedMaster)
                  .map(product => (
                    <label
                      key={product.id}
                      className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                        selectedDuplicate === product.id
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="duplicate"
                        value={product.id}
                        checked={selectedDuplicate === product.id}
                        onChange={(e) => setSelectedDuplicate(e.target.value)}
                        className="mt-1 mr-3"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{product.name}</span>
                          {selectedDuplicate === product.id && (
                            <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                              À FUSIONNER
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 mt-1 space-y-1">
                          <div>SKU: {product.sku}</div>
                          <div>Stock: {product.current_stock} {product.unit}</div>
                          <div>Statut: {product.status}</div>
                        </div>
                      </div>
                    </label>
                  ))}
              </div>
            </div>
          )}

          {/* Option de suppression */}
          {selectedMaster && selectedDuplicate && (
            <div className="border-t pt-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteDuplicate}
                  onChange={(e) => setDeleteDuplicate(e.target.checked)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-gray-900 flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    Supprimer définitivement le produit fusionné
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {deleteDuplicate ? (
                      <span className="text-red-600">
                        ⚠️ Le produit sera supprimé de la base de données. Cette action est irréversible.
                      </span>
                    ) : (
                      <span className="text-gray-600">
                        Le produit sera marqué comme "discontinué" mais conservé pour l'historique.
                      </span>
                    )}
                  </div>
                </div>
              </label>
            </div>
          )}

          {/* Prévisualisation */}
          {previewLoading && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-600 mt-2">Chargement de la prévisualisation...</p>
            </div>
          )}

          {preview && !previewLoading && (
            <div className="border-t pt-4">
              <h3 className="font-semibold text-gray-900 mb-3">Prévisualisation de la fusion</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>
                    <strong>{preview.impact.stock_movements}</strong> mouvements de stock transférés
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <ShoppingCart className="h-4 w-4 text-blue-600" />
                  <span>
                    <strong>{preview.impact.purchase_order_items}</strong> articles de commande transférés
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4 text-purple-600" />
                  <span>
                    <strong>{preview.impact.sale_items}</strong> articles de vente transférés
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span>
                    Nouveau stock du produit maître: <strong>{preview.impact.new_master_stock}</strong> {masterProduct?.unit || ''}
                  </span>
                </div>
                {preview.impact.receipt_items > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <span>
                      <strong>{preview.impact.receipt_items}</strong> articles de réception transférés
                    </span>
                  </div>
                )}
                {preview.impact.delivery_items > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <span>
                      <strong>{preview.impact.delivery_items}</strong> articles de livraison transférés
                    </span>
                  </div>
                )}
                {preview.impact.product_prices > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <span>
                      <strong>{preview.impact.product_prices}</strong> prix transférés
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Erreur */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-800">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">Erreur</span>
              </div>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          )}
        </div>

        {/* Footer avec boutons */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            Annuler
          </button>
          <button
            onClick={handleMerge}
            disabled={!selectedMaster || !selectedDuplicate || loading || previewLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Fusion en cours...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Confirmer la fusion
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};


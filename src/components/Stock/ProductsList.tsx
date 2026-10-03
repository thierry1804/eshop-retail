import React, { useState, useEffect } from 'react';
import { devLog } from '../../lib/devLog';
import { supabase } from '../../lib/supabase';
import { Product, User, PurchaseOrder, Sale } from '../../types';
import { Plus, Package, AlertTriangle, TrendingUp, TrendingDown, ShoppingCart, ArrowUpDown, CheckCircle, XCircle, Eye, Edit, ShoppingBag, ArrowUp, GitMerge, ClipboardCheck, Power, PowerOff, Archive, Globe } from 'lucide-react';
import { SearchField } from '../ui/SearchField';
import { useTranslation } from 'react-i18next';
import { ProductForm } from './ProductForm';
import { ProductDetails } from './ProductDetails';
import { PurchaseOrderDetails } from '../Supply/PurchaseOrderDetails';
import { SaleForm } from '../Sales/SaleForm';
import { ProductMergeModal } from './ProductMergeModal';
import { StockPeriodCloseModal } from './StockPeriodCloseModal';
import { DataTable, dtTh, dtTd } from '../ui/DataTable';

interface ProductsListProps {
  user: User;
}

export const ProductsList: React.FC<ProductsListProps> = ({ user }) => {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [sortBy, setSortBy] = useState<string>('name');
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState<boolean>(false);
  const [filterPublish, setFilterPublish] = useState<string>('all');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeScope, setCloseScope] = useState<'all' | 'selection'>('selection');
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  // État pour stocker les IDs des dernières commandes par produit
  const [productLastOrders, setProductLastOrders] = useState<Record<string, string>>({});
  // État pour stocker les IDs des dernières ventes par produit
  const [productLastSales, setProductLastSales] = useState<Record<string, string>>({});
  // État pour stocker les IDs des derniers approvisionnements par produit
  const [productLastStockIns, setProductLastStockIns] = useState<Record<string, { referenceId: string; referenceType?: string }>>({});
  // États pour les mouvements (non chargés pour réduire les requêtes)
  const [productMovements] = useState<Record<string, { hasMovement: boolean; lastMovementDate?: string; referenceId?: string; referenceType?: string }>>({});
  // État pour stocker les quantités entrées et sorties par produit
  const [productQuantities, setProductQuantities] = useState<Record<string, { quantityIn: number; quantityOut: number }>>({});
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [selectedDuplicateGroup, setSelectedDuplicateGroup] = useState<Product[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(30);
  const pageSizeOptions = [10, 25, 30, 50, 100];

  useEffect(() => {
    devLog('📦 ProductsList: Initialisation du composant');
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      devLog('📦 ProductsList: Début du chargement des produits');
      setLoading(true);
      const startTime = performance.now();
      
      // Exécuter les requêtes en parallèle pour optimiser les performances
      const [productsResult, lastOrdersResult, lastSalesResult, lastStockInsResult, quantitiesResult] = await Promise.all([
        supabase
          .from('products')
          .select(`
            *,
            category:categories(name),
            supplier:suppliers(name),
            prices:product_prices(*)
          `)
          .order('name'),
        fetchLastOrders(),
        fetchLastSales(),
        fetchLastStockIns(),
        fetchProductQuantities()
      ]);

      const endTime = performance.now();
      devLog(`📦 ProductsList: Requêtes terminées en ${(endTime - startTime).toFixed(2)}ms`);

      const { data, error } = productsResult;

      if (error) {
        console.error('❌ ProductsList: Erreur lors du chargement des produits:', error);
        throw error;
      }
      
      devLog(`✅ ProductsList: ${data?.length || 0} produits récupérés`);
      setProducts(data || []);
      setProductLastOrders(lastOrdersResult);
      setProductLastSales(lastSalesResult);
      setProductLastStockIns(lastStockInsResult);
      setProductQuantities(quantitiesResult);

      // Désactiver le loading immédiatement pour afficher les produits
      devLog('📦 ProductsList: Fin du chargement, désactivation du loading');
      setLoading(false);
    } catch (error) {
      console.error('❌ ProductsList: Erreur lors du chargement des produits:', error);
      setLoading(false);
    }
  };

  // NOTE: fetchProductOrdersAndMovements a été supprimée car elle générait trop de requêtes
  // (plusieurs lots de 50 produits) et déclenchait des rafraîchissements de token excessifs,
  // causant des erreurs 429. Les données sont déjà dans Supabase, pas besoin de les charger en masse.

  const fetchLastOrders = async (): Promise<Record<string, string>> => {
    try {
      devLog('📦 ProductsList: Début du chargement des dernières commandes');
      const startTime = performance.now();

      // Récupérer toutes les commandes avec leurs produits
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select(`
          product_id,
          purchase_order_id,
          purchase_orders!inner(
            id,
            created_at
          )
        `);

      if (error) {
        console.error('❌ ProductsList: Erreur lors du chargement des commandes:', error);
        return {};
      }

      // Grouper par product_id et garder seulement la plus récente (triée par created_at DESC)
      const lastOrdersMap: Record<string, string> = {};
      if (data) {
        // Type pour les données retournées par Supabase avec jointure
        type OrderItemWithOrder = {
          product_id: string;
          purchase_order_id: string;
          purchase_orders: {
            id: string;
            created_at: string;
          } | {
            id: string;
            created_at: string;
          }[] | null;
        };

        // Trier les données par date de commande décroissante
        const sortedData = [...(data as OrderItemWithOrder[])].sort((a, b) => {
          // Gérer le cas où purchase_orders peut être un objet ou un tableau
          const orderA = Array.isArray(a.purchase_orders) ? a.purchase_orders[0] : a.purchase_orders;
          const orderB = Array.isArray(b.purchase_orders) ? b.purchase_orders[0] : b.purchase_orders;
          const dateA = orderA?.created_at || '';
          const dateB = orderB?.created_at || '';
          return dateB.localeCompare(dateA); // Tri décroissant
        });

        // Prendre la première commande (la plus récente) pour chaque produit
        for (const item of sortedData) {
          const productId = item.product_id;
          // Si on n'a pas encore de commande pour ce produit, on garde celle-ci
          if (!lastOrdersMap[productId]) {
            lastOrdersMap[productId] = item.purchase_order_id;
          }
        }
      }

      const endTime = performance.now();
      devLog(`✅ ProductsList: Dernières commandes chargées en ${(endTime - startTime).toFixed(2)}ms`);
      devLog(`📦 ProductsList: ${Object.keys(lastOrdersMap).length} produits avec commandes`);

      return lastOrdersMap;
    } catch (error) {
      console.error('❌ ProductsList: Erreur lors du chargement des dernières commandes:', error);
      return {};
    }
  };

  const fetchLastSales = async (): Promise<Record<string, string>> => {
    try {
      devLog('📦 ProductsList: Début du chargement des dernières ventes');
      const startTime = performance.now();

      // Récupérer toutes les ventes avec leurs produits
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
        .not('article_id', 'is', null);

      if (error) {
        console.error('❌ ProductsList: Erreur lors du chargement des ventes:', error);
        return {};
      }

      // Grouper par article_id et garder seulement la plus récente
      const lastSalesMap: Record<string, string> = {};
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

        // Trier les données par date de vente décroissante
        const sortedData = [...(data as SaleItemWithSale[])].sort((a, b) => {
          const saleA = Array.isArray(a.sales) ? a.sales[0] : a.sales;
          const saleB = Array.isArray(b.sales) ? b.sales[0] : b.sales;
          const dateA = saleA?.created_at || '';
          const dateB = saleB?.created_at || '';
          return dateB.localeCompare(dateA); // Tri décroissant
        });

        // Prendre la première vente (la plus récente) pour chaque produit
        for (const item of sortedData) {
          const productId = item.article_id;
          // Si on n'a pas encore de vente pour ce produit, on garde celle-ci
          if (!lastSalesMap[productId]) {
            lastSalesMap[productId] = item.sale_id;
          }
        }
      }

      const endTime = performance.now();
      devLog(`✅ ProductsList: Dernières ventes chargées en ${(endTime - startTime).toFixed(2)}ms`);
      devLog(`📦 ProductsList: ${Object.keys(lastSalesMap).length} produits avec ventes`);

      return lastSalesMap;
    } catch (error) {
      console.error('❌ ProductsList: Erreur lors du chargement des dernières ventes:', error);
      return {};
    }
  };

  const fetchLastStockIns = async (): Promise<Record<string, { referenceId: string; referenceType?: string }>> => {
    try {
      devLog('📦 ProductsList: Début du chargement des derniers approvisionnements');
      const startTime = performance.now();

      // Récupérer tous les mouvements d'entrée (in) ou liés à des achats (purchase)
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          product_id,
          reference_id,
          reference_type,
          created_at
        `)
        .or('movement_type.eq.in,reference_type.eq.purchase')
        .not('product_id', 'is', null);

      if (error) {
        console.error('❌ ProductsList: Erreur lors du chargement des approvisionnements:', error);
        return {};
      }

      // Grouper par product_id et garder seulement le plus récent
      const lastStockInsMap: Record<string, { referenceId: string; referenceType?: string }> = {};
      if (data) {
        type StockMovement = {
          product_id: string;
          reference_id: string | null;
          reference_type: string | null;
          created_at: string;
        };

        // Trier les données par date décroissante
        const sortedData = [...(data as StockMovement[])].sort((a, b) => {
          return b.created_at.localeCompare(a.created_at); // Tri décroissant
        });

        // Prendre le premier mouvement (le plus récent) pour chaque produit
        for (const movement of sortedData) {
          const productId = movement.product_id;
          // Si on n'a pas encore d'approvisionnement pour ce produit, on garde celui-ci
          if (!lastStockInsMap[productId] && movement.reference_id) {
            lastStockInsMap[productId] = {
              referenceId: movement.reference_id,
              referenceType: movement.reference_type || undefined
            };
          }
        }
      }

      const endTime = performance.now();
      devLog(`✅ ProductsList: Derniers approvisionnements chargés en ${(endTime - startTime).toFixed(2)}ms`);
      devLog(`📦 ProductsList: ${Object.keys(lastStockInsMap).length} produits avec approvisionnements`);

      return lastStockInsMap;
    } catch (error) {
      console.error('❌ ProductsList: Erreur lors du chargement des derniers approvisionnements:', error);
      return {};
    }
  };

  const fetchLastClosureDates = async (): Promise<Record<string, string>> => {
    try {
      const { data, error } = await supabase
        .from('stock_period_closure_items')
        .select(`
          product_id,
          closure:stock_period_closures!inner(
            closed_at
          )
        `);

      if (error) {
        console.error('❌ ProductsList: Erreur chargement dernières clôtures:', error);
        return {};
      }

      const lastClosureMap: Record<string, string> = {};
      type ClosureItemRow = {
        product_id: string;
        closure: { closed_at: string } | { closed_at: string }[] | null;
      };

      for (const row of (data as ClosureItemRow[]) || []) {
        const closure = Array.isArray(row.closure) ? row.closure[0] : row.closure;
        const closedAt = closure?.closed_at;
        if (!closedAt) continue;
        const existing = lastClosureMap[row.product_id];
        if (!existing || new Date(closedAt) > new Date(existing)) {
          lastClosureMap[row.product_id] = closedAt;
        }
      }

      return lastClosureMap;
    } catch (error) {
      console.error('❌ ProductsList: Erreur chargement dernières clôtures:', error);
      return {};
    }
  };

  const fetchProductQuantities = async (): Promise<Record<string, { quantityIn: number; quantityOut: number }>> => {
    try {
      devLog('📦 ProductsList: Début du chargement des quantités entrées/sorties');
      const startTime = performance.now();

      const lastClosureMap = await fetchLastClosureDates();

      // Récupérer tous les mouvements de stock avec leurs quantités
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          product_id,
          movement_type,
          quantity,
          reference_type,
          reference_id,
          reason,
          created_at
        `)
        .not('product_id', 'is', null);

      if (error) {
        console.error('❌ ProductsList: Erreur lors du chargement des quantités:', error);
        return {};
      }

      // Calculer les quantités entrées et sorties par produit (après dernière clôture)
      const quantitiesMap: Record<string, { quantityIn: number; quantityOut: number }> = {};
      if (data) {
        type MovementData = {
          product_id: string;
          movement_type: 'in' | 'out' | 'adjustment' | 'transfer';
          quantity: number;
          reference_type?: 'purchase' | 'sale' | 'adjustment' | 'transfer' | 'return' | null;
          reference_id?: string | null;
          reason?: string | null;
          created_at: string;
        };

        for (const movement of data as MovementData[]) {
          const productId = movement.product_id;

          // Ignorer les mouvements de clôture de période
          if (movement.reason === 'period_close') {
            continue;
          }

          const lastClosureAt = lastClosureMap[productId];
          if (lastClosureAt && new Date(movement.created_at) <= new Date(lastClosureAt)) {
            continue;
          }

          if (!quantitiesMap[productId]) {
            quantitiesMap[productId] = { quantityIn: 0, quantityOut: 0 };
          }

          const quantity = movement.quantity || 0;

          // Les entrées sont les mouvements de type 'in'
          if (movement.movement_type === 'in') {
            quantitiesMap[productId].quantityIn += quantity;
          }
          // Les sorties sont les mouvements de type 'out'
          else if (movement.movement_type === 'out') {
            quantitiesMap[productId].quantityOut += quantity;
          }
          // Les ajustements : positifs comptent comme entrées, négatifs comme sorties
          else if (movement.movement_type === 'adjustment') {
            if (quantity > 0) {
              quantitiesMap[productId].quantityIn += quantity;
            } else if (quantity < 0) {
              quantitiesMap[productId].quantityOut += Math.abs(quantity);
            }
          }
          // Les transferts : si reference_type = 'transfer' et reference_id existe, c'est une sortie, sinon une entrée
          else if (movement.movement_type === 'transfer') {
            if (movement.reference_type === 'transfer' && movement.reference_id) {
              quantitiesMap[productId].quantityOut += quantity;
            } else {
              quantitiesMap[productId].quantityIn += quantity;
            }
          }
        }
      }

      const endTime = performance.now();
      devLog(`✅ ProductsList: Quantités chargées en ${(endTime - startTime).toFixed(2)}ms`);
      devLog(`📦 ProductsList: ${Object.keys(quantitiesMap).length} produits avec quantités`);

      return quantitiesMap;
    } catch (error) {
      console.error('❌ ProductsList: Erreur lors du chargement des quantités:', error);
      return {};
    }
  };

  // Fonction pour normaliser le nom d'un produit (similaire à la fonction SQL)
  const normalizeProductName = (name: string): string => {
    return name.toLowerCase().trim().replace(/[àáâãäåèéêëìíîïòóôõöùúûüýÿÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝŸ]/g, (char) => {
      const map: Record<string, string> = {
        'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a',
        'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
        'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
        'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
        'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
        'ý': 'y', 'ÿ': 'y',
        'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A', 'Å': 'A',
        'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E',
        'Ì': 'I', 'Í': 'I', 'Î': 'I', 'Ï': 'I',
        'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O',
        'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ü': 'U',
        'Ý': 'Y', 'Ÿ': 'Y'
      };
      return map[char] || char;
    });
  };

  // Fonction pour détecter les groupes de doublons
  const getDuplicateGroups = (): Product[][] => {
    const groups = new Map<string, Product[]>();
    
    products.forEach(product => {
      // Exclure les produits déjà discontinués
      if (product.status === 'discontinued') return;
      
      const normalizedName = normalizeProductName(product.name);
      if (!groups.has(normalizedName)) {
        groups.set(normalizedName, []);
      }
      groups.get(normalizedName)!.push(product);
    });
    
    // Retourner seulement les groupes avec plus d'un produit
    return Array.from(groups.values()).filter(group => group.length > 1);
  };

  const handleOrderClick = async (orderId: string) => {
    try {
      // Charger la commande avec tous les détails nécessaires en une seule requête
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          purchase_order_items (
            id,
            product_id,
            quantity_ordered,
            quantity_received,
            unit_price,
            total_price,
            products (
              name,
              sku,
              unit,
              image_url
            )
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      if (data) {
        setSelectedOrder(data as PurchaseOrder);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la commande:', error);
    }
  };

  const handleSaleClick = async (saleId: string) => {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          client:clients(*)
        `)
        .eq('id', saleId)
        .single();

      if (error) throw error;
      if (data) {
        setSelectedSale(data as Sale);
        setShowSaleForm(true);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la vente:', error);
    }
  };

  const handleMovementClick = async (referenceId: string, referenceType: string) => {
    try {
      if (referenceType === 'sale') {
        // Charger la vente
        await handleSaleClick(referenceId);
      } else if (referenceType === 'purchase') {
        // Charger la commande d'achat
        await handleOrderClick(referenceId);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la référence:', error);
    }
  };

  const toggleProductStatus = async (product: Product) => {
    try {
      const newStatus = product.status === 'active' ? 'inactive' : 'active';
      
      // @ts-ignore - Types Supabase non générés pour la table products
      const { error } = await (supabase.from('products') as any)
        .update({ 
          status: newStatus,
          updated_by: user.id
        })
        .eq('id', product.id);

      if (error) {
        console.error('Erreur lors de la mise à jour du statut:', error);
        throw error;
      }

      // Mettre à jour l'état local
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.id === product.id ? { ...p, status: newStatus } : p
        )
      );
    } catch (error) {
      console.error('Erreur lors de la désactivation du produit:', error);
      alert(t('stock.toggleStatusError'));
    }
  };

  const toggleProductStorePublish = async (product: Product) => {
    const nextValue = !product.is_published_to_store;
    try {
      // @ts-ignore - Types Supabase non générés pour la table products
      const { error } = await (supabase.from('products') as any)
        .update({
          is_published_to_store: nextValue,
          updated_by: user.id
        })
        .eq('id', product.id);

      if (error) throw error;

      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, is_published_to_store: nextValue } : p
        )
      );
    } catch (error) {
      console.error('Erreur lors de la mise à jour publication store:', error);
      alert('Impossible de mettre à jour la publication sur le store.');
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.barcode?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || product.status === filterStatus;
    const matchesPublish =
      filterPublish === 'all' ||
      (filterPublish === 'published' && product.is_published_to_store) ||
      (filterPublish === 'unpublished' && !product.is_published_to_store);
    
    // Filtrer les produits avec des noms identiques si le filtre est activé
    let matchesDuplicates = true;
    if (showDuplicatesOnly) {
      const nameCount = products.filter(p => 
        p.name.toLowerCase() === product.name.toLowerCase()
      ).length;
      matchesDuplicates = nameCount > 1;
    }
    
    return matchesSearch && matchesStatus && matchesPublish && matchesDuplicates;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'sku':
        return a.sku.localeCompare(b.sku);
      case 'stock':
        return b.current_stock - a.current_stock;
      case 'price':
        const priceA = a.prices?.find(p => p.is_active)?.price || 0;
        const priceB = b.prices?.find(p => p.is_active)?.price || 0;
        return priceB - priceA;
      default:
        return 0;
    }
  });

  // Calcul de la pagination
  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = sortedProducts.slice(startIndex, endIndex);

  // Réinitialiser à la page 1 quand les filtres ou la taille de page changent
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterPublish, sortBy, showDuplicatesOnly, itemsPerPage]);

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const toggleSelectPage = () => {
    const pageIds = paginatedProducts.map((p) => p.id);
    const allSelected = pageIds.every((id) => selectedProductIds.has(id));
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const openCloseModal = (scope: 'all' | 'selection') => {
    if (scope === 'selection' && selectedProductIds.size === 0) {
      alert('Sélectionnez au moins un produit à clôturer.');
      return;
    }
    setCloseScope(scope);
    setShowCloseModal(true);
  };

  const getStockStatus = (product: Product) => {
    if (product.current_stock === 0) return { status: 'out', color: 'app-text-danger', icon: AlertTriangle };
    if (product.current_stock <= product.min_stock_level) return { status: 'low', color: 'text-yellow-600', icon: AlertTriangle };
    if (product.max_stock_level && product.current_stock > product.max_stock_level) return { status: 'high', color: 'app-text-link', icon: TrendingUp };
    return { status: 'normal', color: 'app-text-success', icon: TrendingDown };
  };

  const getCurrentPrice = (product: Product) => {
    const activePrice = product.prices?.find(p => p.is_active);
    return activePrice ? `${activePrice.price.toLocaleString()} ${activePrice.currency}` : 'N/A';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--app-primary)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="app-sticky-chrome space-y-2">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <div className="min-w-0">
          <h1 className="app-page-title">{t('stock.title')}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('navigate', { detail: 'inventories' }));
            }}
            className="app-btn app-btn-secondary app-btn-sm"
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            Inventaires
          </button>
          <button
            onClick={() => openCloseModal('selection')}
            disabled={selectedProductIds.size === 0}
            className="app-btn app-btn-secondary app-btn-sm disabled:opacity-50"
            title="Clôturer la période pour la sélection"
          >
            <Archive className="h-3.5 w-3.5" />
            Clôturer ({selectedProductIds.size})
          </button>
          <button
            onClick={() => openCloseModal('all')}
            className="app-btn app-btn-secondary app-btn-sm"
            title="Clôturer tous les produits actifs"
          >
            <Archive className="h-3.5 w-3.5" />
            Tous
          </button>
          {getDuplicateGroups().length > 0 && (
            <button
              onClick={() => {
                const groups = getDuplicateGroups();
                if (groups.length > 0) {
                  setSelectedDuplicateGroup(groups[0]);
                  setShowMergeModal(true);
                }
              }}
              title={`Fusionner les doublons (${getDuplicateGroups().length})`}
              className="app-btn app-btn-secondary app-btn-sm"
            >
              <GitMerge className="h-3.5 w-3.5" />
              ({getDuplicateGroups().length})
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="app-btn app-btn-primary app-btn-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Nouveau
          </button>
        </div>
      </div>

      {/* Filtres et recherche — une seule ligne compacte */}
      <div className="app-toolbar">
          <SearchField
            className="min-w-[12rem]"
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t('stock.searchPlaceholder')}
            inputClassName="text-xs py-1.5"
          />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="app-input text-xs py-1.5 w-auto"
            >
              <option value="all">{t('stock.filters.allStatuses')}</option>
              <option value="active">{t('stock.status.active')}</option>
              <option value="inactive">{t('stock.status.inactive')}</option>
              <option value="discontinued">{t('stock.status.discontinued')}</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="app-input text-xs py-1.5 w-auto"
            >
              <option value="name">{t('stock.filters.sortByName')}</option>
              <option value="sku">{t('stock.filters.sortBySku')}</option>
              <option value="stock">{t('stock.filters.sortByStock')}</option>
              <option value="price">{t('stock.filters.sortByPrice')}</option>
            </select>
            <select
              value={filterPublish}
              onChange={(e) => setFilterPublish(e.target.value)}
              className="app-input text-xs py-1.5 w-auto"
            >
              <option value="all">Store</option>
              <option value="published">Publiés</option>
              <option value="unpublished">Non publiés</option>
            </select>
            <label
              className="flex items-center gap-1.5 px-2 py-1.5 border app-border rounded-md cursor-pointer hover:bg-[var(--app-surface-muted)] text-xs app-text-muted"
              title={t('stock.filters.showDuplicatesOnly')}
            >
              <input
                type="checkbox"
                checked={showDuplicatesOnly}
                onChange={(e) => setShowDuplicatesOnly(e.target.checked)}
                className="w-3.5 h-3.5 rounded border app-border accent-[var(--app-primary)]"
              />
              Doublons
            </label>
            <label
              className="flex items-center gap-1.5 px-2 py-1.5 border app-border rounded-md cursor-pointer hover:bg-[var(--app-surface-muted)] text-xs app-text-muted"
              title="Tout sélectionner (page)"
            >
              <input
                type="checkbox"
                checked={
                  paginatedProducts.length > 0 &&
                  paginatedProducts.every((p) => selectedProductIds.has(p.id))
                }
                onChange={toggleSelectPage}
                className="w-3.5 h-3.5 rounded border app-border accent-[var(--app-primary)]"
              />
              Page
            </label>
      </div>
      </div>

      {/* Liste des produits - Mobile Card View */}
      <div className="md:hidden space-y-3">
        {paginatedProducts.map((product) => {
          const stockStatus = getStockStatus(product);
          const StockIcon = stockStatus.icon;
          
          return (
            <div key={product.id} className="app-list-card">
              <div className="flex items-start space-x-3 mb-3">
                <input
                  type="checkbox"
                  checked={selectedProductIds.has(product.id)}
                  onChange={() => toggleProductSelection(product.id)}
                  className="mt-1 w-4 h-4 rounded border app-border accent-[var(--app-primary)] flex-shrink-0"
                />
                {product.image_url && !imageErrors[product.id] ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-16 w-16 object-cover rounded-md border app-border flex-shrink-0"
                    onError={() => {
                      setImageErrors(prev => ({ ...prev, [product.id]: true }));
                    }}
                  />
                ) : (
                  <div className="h-16 w-16 bg-[var(--app-stripe)] rounded-md border app-border flex items-center justify-center flex-shrink-0">
                    <Package className="h-8 w-8 app-text-muted" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium app-text truncate">
                    {product.name}
                  </div>
                  <div className="text-xs app-text-muted mt-1">
                    {product.category?.name || 'Sans catégorie'} • <span className="font-mono app-text-muted">{product.sku}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2 text-xs pt-2 border-t app-divider">
                <div className="flex items-center justify-between">
                  <span className="app-text-muted">Stock:</span>
                  <div className="flex items-center">
                    <StockIcon className={`h-4 w-4 mr-1 ${stockStatus.color}`} />
                    <span className="app-text font-medium">
                      {product.current_stock} / {product.min_stock_level}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="app-text-muted">Qté entrée:</span>
                  <span className="app-text font-medium">{productQuantities[product.id]?.quantityIn || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="app-text-muted">Qté sortie:</span>
                  <span className="app-text font-medium">{productQuantities[product.id]?.quantityOut || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="app-text-muted">Prix:</span>
                  <span className="app-text font-medium">{getCurrentPrice(product)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="app-text-muted">Activité:</span>
                  <div className="flex items-center gap-2">
                    {productLastOrders[product.id] && (
                      <button
                        onClick={() => handleOrderClick(productLastOrders[product.id])}
                        className="cursor-pointer hover:opacity-70 transition-opacity p-1 rounded hover:bg-[color-mix(in_srgb,var(--app-primary)_10%,transparent)]"
                        title={t('stock.table.hasOrder')}
                      >
                        <ShoppingCart 
                          className="h-4 w-4 app-text-link" 
                        />
                      </button>
                    )}
                    {productLastSales[product.id] && (
                      <button
                        onClick={() => handleSaleClick(productLastSales[product.id])}
                        className="cursor-pointer hover:opacity-70 transition-opacity p-1 rounded hover:bg-[color-mix(in_srgb,var(--app-success)_12%,transparent)]"
                        title="Dernière vente"
                      >
                        <ShoppingBag 
                          className="h-4 w-4 app-text-success" 
                        />
                      </button>
                    )}
                    {productLastStockIns[product.id] && (
                      <button
                        onClick={() => {
                          const stockIn = productLastStockIns[product.id];
                          if (stockIn.referenceType === 'purchase') {
                            handleOrderClick(stockIn.referenceId);
                          } else {
                            handleMovementClick(stockIn.referenceId, stockIn.referenceType || '');
                          }
                        }}
                        className="cursor-pointer hover:opacity-70 transition-opacity p-1 rounded hover:bg-[var(--app-surface-muted)]"
                        title="Dernier approvisionnement"
                      >
                        <ArrowUp 
                          className="h-4 w-4 app-text-muted" 
                        />
                      </button>
                    )}
                    {productMovements[product.id]?.hasMovement && 
                     productMovements[product.id]?.referenceId && 
                     productMovements[product.id]?.referenceType && (
                      <button
                        onClick={() => handleMovementClick(
                          productMovements[product.id].referenceId!,
                          productMovements[product.id].referenceType!
                        )}
                        className="cursor-pointer hover:opacity-70 transition-opacity"
                        title={t('stock.table.hasMovement')}
                      >
                        <ArrowUpDown 
                          className="h-4 w-4 app-text-muted" 
                        />
                      </button>
                    )}
                    {!productLastOrders[product.id] && !productLastSales[product.id] && !productLastStockIns[product.id] && !productMovements[product.id]?.hasMovement && (
                      <span className="app-text-muted">-</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full ${
                    product.status === 'active' ? 'bg-green-100 text-green-800' :
                    product.status === 'inactive' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}
                  title={t(`stock.status.${product.status}`)}
                  >
                    {product.status === 'active' ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : product.status === 'inactive' ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleProductStorePublish(product)}
                      className={`transition-colors p-1 rounded hover:bg-[var(--app-surface-muted)] ${
                        product.is_published_to_store
                          ? 'app-text-link'
                          : 'app-text-muted hover:app-text-link'
                      }`}
                      title={
                        product.is_published_to_store
                          ? 'Retirer du store'
                          : 'Publier sur le store'
                      }
                    >
                      <Globe className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => toggleProductStatus(product)}
                      className={`transition-colors p-1 rounded hover:bg-[var(--app-surface-muted)] ${
                        product.status === 'active' 
                          ? 'app-text-danger'
                          : 'app-text-success'
                      }`}
                      title={product.status === 'active' ? t('stock.disableProduct') : t('stock.enableProduct')}
                    >
                      {product.status === 'active' ? (
                        <PowerOff className="h-5 w-5" />
                      ) : (
                        <Power className="h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={() => setSelectedProduct(product)}
                      className="app-icon-btn app-icon-btn-primary"
                      title={t('stock.viewDetails')}
                      aria-label={t('stock.viewDetails')}
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedProduct(product);
                        setShowForm(true);
                      }}
                      className="app-icon-btn"
                      title={t('app.edit')}
                      aria-label={t('app.edit')}
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {sortedProducts.length === 0 && (
          <div className="app-empty">
            <p className="app-empty-text">{t('stock.noProducts')}</p>
          </div>
        )}
      </div>

      {/* Pagination - Mobile */}
      {sortedProducts.length > 0 && (
        <div className="md:hidden app-surface rounded-md px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs app-text-muted">
              <span>
                {startIndex + 1}-{Math.min(endIndex, sortedProducts.length)} / {sortedProducts.length}
              </span>
              <label className="flex items-center gap-1">
                <span className="app-text-muted">Par page</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="px-1.5 py-1 border app-border rounded-md text-xs"
                >
                  {pageSizeOptions.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </label>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs border app-border rounded-md hover:bg-[var(--app-surface-muted)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('app.previous')}
                </button>
                <span className="text-xs app-text-muted">
                  {currentPage}/{totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-xs border app-border rounded-md hover:bg-[var(--app-surface-muted)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('app.next')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Liste des produits - Desktop Table View */}
      <div className="hidden md:block app-table-wrap">
        <DataTable>
            <thead className="app-bg-muted">
              <tr>
                <th className="sticky top-0 left-0 z-40 app-bg-muted px-3 py-2 text-left w-12 min-w-[3rem] border-b app-border">
                  <input
                    type="checkbox"
                    checked={
                      paginatedProducts.length > 0 &&
                      paginatedProducts.every((p) => selectedProductIds.has(p.id))
                    }
                    onChange={toggleSelectPage}
                    className="w-4 h-4 rounded border app-border accent-[var(--app-primary)]"
                    title="Tout sélectionner (page)"
                  />
                </th>
                <th className={`sticky top-0 left-12 z-40 min-w-[16rem] border-b border-r app-border shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] ${dtTh}`}>
                  {t('stock.table.product')}
                </th>
                <th className={dtTh}>{t('stock.table.stock')}</th>
                <th className={dtTh}>IN</th>
                <th className={dtTh}>OUT</th>
                <th className={dtTh}>{t('stock.table.price')}</th>
                <th className={dtTh}>{t('stock.table.status')}</th>
                <th className={dtTh}>{t('stock.table.activity')}</th>
                <th className={`sticky top-0 right-0 z-40 border-b border-l app-border shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.08)] ${dtTh}`}>
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--app-border)]">
              {paginatedProducts.map((product) => {
                const stockStatus = getStockStatus(product);
                const StockIcon = stockStatus.icon;
                
                return (
                  <tr key={product.id} className="group hover:bg-[var(--app-surface-muted)]">
                    <td className="sticky left-0 z-20  px-3 py-1.5 whitespace-nowrap w-12 min-w-[3rem]">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.has(product.id)}
                        onChange={() => toggleProductSelection(product.id)}
                        className="w-4 h-4 rounded border app-border accent-[var(--app-primary)]"
                      />
                    </td>
                    <td className="sticky left-12 z-20  px-3 py-1.5 whitespace-nowrap min-w-[16rem] border-r app-divider shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                      <div className="flex items-center">
                        {product.image_url && !imageErrors[product.id] ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-7 w-7 object-cover rounded-md border app-border mr-2 flex-shrink-0"
                            onError={() => {
                              setImageErrors(prev => ({ ...prev, [product.id]: true }));
                            }}
                          />
                        ) : (
                          <div className="h-7 w-7 bg-[var(--app-stripe)] rounded-md border app-border flex items-center justify-center mr-2 flex-shrink-0">
                            <Package className="h-3.5 w-3.5 app-text-muted" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-medium app-text truncate">{product.name}</div>
                          <div className="text-[11px] app-text-muted truncate">
                            {product.category?.name || 'Sans catégorie'} • <span className="font-mono app-text-muted">{product.sku}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={dtTd}>
                      <div className="flex items-center">
                        <StockIcon className={`h-3.5 w-3.5 mr-1.5 flex-shrink-0 ${stockStatus.color}`} />
                        <span>
                          {product.current_stock} / {product.min_stock_level}
                        </span>
                      </div>
                    </td>
                    <td className={dtTd}>
                      {productQuantities[product.id]?.quantityIn || 0}
                    </td>
                    <td className={dtTd}>
                      {productQuantities[product.id]?.quantityOut || 0}
                    </td>
                    <td className={dtTd}>
                      {getCurrentPrice(product)}
                    </td>
                    <td className={dtTd}>
                      <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full ${
                        product.status === 'active' ? 'bg-green-100 text-green-800' :
                        product.status === 'inactive' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}
                      title={t(`stock.status.${product.status}`)}
                      >
                        {product.status === 'active' ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : product.status === 'inactive' ? (
                          <XCircle className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                      </span>
                    </td>
                    <td className={dtTd}>
                      <div className="flex items-center gap-1.5">
                        {productLastOrders[product.id] && (
                          <button
                            onClick={() => handleOrderClick(productLastOrders[product.id])}
                            className="cursor-pointer hover:opacity-70 transition-opacity p-1 rounded hover:bg-[color-mix(in_srgb,var(--app-primary)_10%,transparent)]"
                            title={t('stock.table.hasOrder')}
                          >
                            <ShoppingCart 
                              className="h-4 w-4 app-text-link" 
                            />
                          </button>
                        )}
                        {productLastStockIns[product.id] && (
                          <button
                            className="hover:opacity-70 transition-opacity p-1 rounded hover:bg-[var(--app-surface-muted)]"
                            title="Dernier approvisionnement"
                          >
                            <ArrowUp 
                              className="h-4 w-4 app-text-muted" 
                            />
                          </button>
                        )}
                        {productLastSales[product.id] && (
                          <button
                            onClick={() => handleSaleClick(productLastSales[product.id])}
                            className="cursor-pointer hover:opacity-70 transition-opacity p-1 rounded hover:bg-[color-mix(in_srgb,var(--app-success)_12%,transparent)]"
                            title="Dernière vente"
                          >
                            <ShoppingBag 
                              className="h-4 w-4 app-text-success" 
                            />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="sticky right-0 z-20  px-3 py-1.5 whitespace-nowrap text-xs font-medium border-l app-divider shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleProductStorePublish(product)}
                          className={`transition-colors p-1 rounded hover:bg-[var(--app-surface-muted)] ${
                            product.is_published_to_store
                              ? 'app-text-link'
                              : 'app-text-muted hover:app-text-link'
                          }`}
                          title={
                            product.is_published_to_store
                              ? 'Retirer du store'
                              : 'Publier sur le store'
                          }
                        >
                          <Globe className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleProductStatus(product)}
                          className={`transition-colors p-1 rounded hover:bg-[var(--app-surface-muted)] ${
                            product.status === 'active' 
                              ? 'app-text-danger' 
                              : 'app-text-success'
                          }`}
                          title={product.status === 'active' ? t('stock.disableProduct') : t('stock.enableProduct')}
                        >
                          {product.status === 'active' ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => setSelectedProduct(product)}
                          className="app-text-link transition-colors p-1 rounded hover:bg-[color-mix(in_srgb,var(--app-primary)_10%,transparent)]"
                          title={t('stock.viewDetails')}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedProduct(product);
                            setShowForm(true);
                          }}
                          className="app-text-muted hover:app-text transition-colors p-1 rounded hover:bg-[var(--app-surface-muted)]"
                          title={t('app.edit')}
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
        </DataTable>
        {sortedProducts.length === 0 && (
          <div className="text-center py-8">
            <p className="app-text-muted">{t('stock.noProducts')}</p>
          </div>
        )}
      </div>

      {/* Pagination - Desktop */}
      {sortedProducts.length > 0 && (
        <div className="hidden md:block app-surface rounded-md px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs app-text-muted">
              <span>
                {startIndex + 1}–{Math.min(endIndex, sortedProducts.length)} sur {sortedProducts.length}
              </span>
              <label className="flex items-center gap-1.5">
                <span className="app-text-muted">Par page</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="px-2 py-1 border app-border rounded-md text-xs"
                >
                  {pageSizeOptions.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </label>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 text-xs border app-border rounded-md hover:bg-[var(--app-surface-muted)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('app.previous')}
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-2 py-1 text-xs border rounded-md ${
                            currentPage === page
                              ? 'bg-[var(--app-primary)] text-white border-[var(--app-primary)]'
                              : 'app-border hover:bg-[var(--app-surface-muted)]'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return <span key={page} className="px-1 app-text-muted text-xs">...</span>;
                    }
                    return null;
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 text-xs border app-border rounded-md hover:bg-[var(--app-surface-muted)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('app.next')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modales */}
      {showForm && (
        <ProductForm
          product={selectedProduct}
          onClose={() => {
            setShowForm(false);
            setSelectedProduct(null);
          }}
          onSave={() => {
            fetchProducts();
            setShowForm(false);
            setSelectedProduct(null);
          }}
          user={user}
        />
      )}

      {selectedProduct && !showForm && (
        <ProductDetails
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onEdit={() => {
            setShowForm(true);
          }}
          user={user}
        />
      )}

      {selectedOrder && (
        <PurchaseOrderDetails
          order={selectedOrder}
          onClose={() => {
            setSelectedOrder(null);
          }}
          onEdit={() => {
            setSelectedOrder(null);
          }}
          user={user}
        />
      )}

      {showSaleForm && selectedSale && (
        <SaleForm
          sale={selectedSale}
          onClose={() => {
            setShowSaleForm(false);
            setSelectedSale(null);
          }}
          onSubmit={() => {
            setShowSaleForm(false);
            setSelectedSale(null);
            fetchProducts();
          }}
        />
      )}

      {showMergeModal && selectedDuplicateGroup.length > 0 && (
        <ProductMergeModal
          duplicateGroup={selectedDuplicateGroup}
          onClose={() => {
            setShowMergeModal(false);
            setSelectedDuplicateGroup([]);
          }}
          onMergeComplete={() => {
            fetchProducts();
            setShowMergeModal(false);
            setSelectedDuplicateGroup([]);
          }}
          user={user}
        />
      )}

      {showCloseModal && (
        <StockPeriodCloseModal
          user={user}
          scope={closeScope}
          products={products}
          selectedProductIds={Array.from(selectedProductIds)}
          onClose={() => setShowCloseModal(false)}
          onComplete={() => {
            setShowCloseModal(false);
            setSelectedProductIds(new Set());
            fetchProducts();
          }}
        />
      )}
    </div>
  );
};

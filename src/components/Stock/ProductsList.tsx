import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Product, User, PurchaseOrder, Sale } from '../../types';
import { Plus, Search, Package, AlertTriangle, TrendingUp, TrendingDown, ShoppingCart, ArrowUpDown, CheckCircle, XCircle, Eye, Edit, ShoppingBag, ArrowUp, GitMerge, ClipboardCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ProductForm } from './ProductForm';
import { ProductDetails } from './ProductDetails';
import { PurchaseOrderDetails } from '../Supply/PurchaseOrderDetails';
import { SaleForm } from '../Sales/SaleForm';
import { ProductMergeModal } from './ProductMergeModal';

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
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState<boolean>(false);
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
  const itemsPerPage = 30;

  useEffect(() => {
    console.log('📦 ProductsList: Initialisation du composant');
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      console.log('📦 ProductsList: Début du chargement des produits');
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
      console.log(`📦 ProductsList: Requêtes terminées en ${(endTime - startTime).toFixed(2)}ms`);

      const { data, error } = productsResult;

      if (error) {
        console.error('❌ ProductsList: Erreur lors du chargement des produits:', error);
        throw error;
      }
      
      console.log(`✅ ProductsList: ${data?.length || 0} produits récupérés`);
      setProducts(data || []);
      setProductLastOrders(lastOrdersResult);
      setProductLastSales(lastSalesResult);
      setProductLastStockIns(lastStockInsResult);
      setProductQuantities(quantitiesResult);

      // Désactiver le loading immédiatement pour afficher les produits
      console.log('📦 ProductsList: Fin du chargement, désactivation du loading');
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
      console.log('📦 ProductsList: Début du chargement des dernières commandes');
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
      console.log(`✅ ProductsList: Dernières commandes chargées en ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`📦 ProductsList: ${Object.keys(lastOrdersMap).length} produits avec commandes`);

      return lastOrdersMap;
    } catch (error) {
      console.error('❌ ProductsList: Erreur lors du chargement des dernières commandes:', error);
      return {};
    }
  };

  const fetchLastSales = async (): Promise<Record<string, string>> => {
    try {
      console.log('📦 ProductsList: Début du chargement des dernières ventes');
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
      console.log(`✅ ProductsList: Dernières ventes chargées en ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`📦 ProductsList: ${Object.keys(lastSalesMap).length} produits avec ventes`);

      return lastSalesMap;
    } catch (error) {
      console.error('❌ ProductsList: Erreur lors du chargement des dernières ventes:', error);
      return {};
    }
  };

  const fetchLastStockIns = async (): Promise<Record<string, { referenceId: string; referenceType?: string }>> => {
    try {
      console.log('📦 ProductsList: Début du chargement des derniers approvisionnements');
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
      console.log(`✅ ProductsList: Derniers approvisionnements chargés en ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`📦 ProductsList: ${Object.keys(lastStockInsMap).length} produits avec approvisionnements`);

      return lastStockInsMap;
    } catch (error) {
      console.error('❌ ProductsList: Erreur lors du chargement des derniers approvisionnements:', error);
      return {};
    }
  };

  const fetchProductQuantities = async (): Promise<Record<string, { quantityIn: number; quantityOut: number }>> => {
    try {
      console.log('📦 ProductsList: Début du chargement des quantités entrées/sorties');
      const startTime = performance.now();

      // Récupérer tous les mouvements de stock avec leurs quantités
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          product_id,
          movement_type,
          quantity
        `)
        .not('product_id', 'is', null);

      if (error) {
        console.error('❌ ProductsList: Erreur lors du chargement des quantités:', error);
        return {};
      }

      // Calculer les quantités entrées et sorties par produit
      const quantitiesMap: Record<string, { quantityIn: number; quantityOut: number }> = {};
      if (data) {
        type MovementData = {
          product_id: string;
          movement_type: 'in' | 'out' | 'adjustment' | 'transfer';
          quantity: number;
        };

        for (const movement of data as MovementData[]) {
          const productId = movement.product_id;
          if (!quantitiesMap[productId]) {
            quantitiesMap[productId] = { quantityIn: 0, quantityOut: 0 };
          }

          // Les entrées sont les mouvements de type 'in'
          if (movement.movement_type === 'in') {
            quantitiesMap[productId].quantityIn += movement.quantity || 0;
          }
          // Les sorties sont les mouvements de type 'out'
          else if (movement.movement_type === 'out') {
            quantitiesMap[productId].quantityOut += movement.quantity || 0;
          }
        }
      }

      const endTime = performance.now();
      console.log(`✅ ProductsList: Quantités chargées en ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`📦 ProductsList: ${Object.keys(quantitiesMap).length} produits avec quantités`);

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

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.barcode?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || product.status === filterStatus;
    
    // Filtrer les produits avec des noms identiques si le filtre est activé
    let matchesDuplicates = true;
    if (showDuplicatesOnly) {
      const nameCount = products.filter(p => 
        p.name.toLowerCase() === product.name.toLowerCase()
      ).length;
      matchesDuplicates = nameCount > 1;
    }
    
    return matchesSearch && matchesStatus && matchesDuplicates;
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

  // Réinitialiser à la page 1 quand les filtres changent
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, sortBy, showDuplicatesOnly]);

  const getStockStatus = (product: Product) => {
    if (product.current_stock === 0) return { status: 'out', color: 'text-red-600', icon: AlertTriangle };
    if (product.current_stock <= product.min_stock_level) return { status: 'low', color: 'text-yellow-600', icon: AlertTriangle };
    if (product.max_stock_level && product.current_stock > product.max_stock_level) return { status: 'high', color: 'text-blue-600', icon: TrendingUp };
    return { status: 'normal', color: 'text-green-600', icon: TrendingDown };
  };

  const getCurrentPrice = (product: Product) => {
    const activePrice = product.prices?.find(p => p.is_active);
    return activePrice ? `${activePrice.price.toLocaleString()} ${activePrice.currency}` : 'N/A';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('stock.title')}</h1>
          <p className="text-sm sm:text-base text-gray-600">{t('stock.subtitle')}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <button
            onClick={() => {
              // Utiliser un événement personnalisé pour changer de page
              window.dispatchEvent(new CustomEvent('navigate', { detail: 'inventories' }));
            }}
            className="bg-purple-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <ClipboardCheck className="h-4 w-4" />
            Inventaires
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
              className="bg-orange-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-orange-700 flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <GitMerge className="h-4 w-4" />
              ({getDuplicateGroups().length})
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <Plus className="h-4 w-4" />
            {t('stock.newProduct')}
          </button>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder={t('stock.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
            >
              <option value="all">{t('stock.filters.allStatuses')}</option>
              <option value="active">{t('stock.status.active')}</option>
              <option value="inactive">{t('stock.status.inactive')}</option>
              <option value="discontinued">{t('stock.status.discontinued')}</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
            >
              <option value="name">{t('stock.filters.sortByName')}</option>
              <option value="sku">{t('stock.filters.sortBySku')}</option>
              <option value="stock">{t('stock.filters.sortByStock')}</option>
              <option value="price">{t('stock.filters.sortByPrice')}</option>
            </select>
            <label className="flex items-center gap-2 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-sm sm:text-base">
              <input
                type="checkbox"
                checked={showDuplicatesOnly}
                onChange={(e) => setShowDuplicatesOnly(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-gray-700">{t('stock.filters.showDuplicatesOnly')}</span>
            </label>
          </div>
        </div>
      </div>

      {/* Liste des produits - Mobile Card View */}
      <div className="md:hidden space-y-3">
        {paginatedProducts.map((product) => {
          const stockStatus = getStockStatus(product);
          const StockIcon = stockStatus.icon;
          
          return (
            <div key={product.id} className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-start space-x-3 mb-3">
                {product.image_url && !imageErrors[product.id] ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-16 w-16 object-cover rounded-md border border-gray-300 flex-shrink-0"
                    onError={() => {
                      setImageErrors(prev => ({ ...prev, [product.id]: true }));
                    }}
                  />
                ) : (
                  <div className="h-16 w-16 bg-gray-100 rounded-md border border-gray-300 flex items-center justify-center flex-shrink-0">
                    <Package className="h-8 w-8 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{product.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {product.category?.name || 'Sans catégorie'} • <span className="font-mono text-gray-400">{product.sku}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2 text-xs pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Stock:</span>
                  <div className="flex items-center">
                    <StockIcon className={`h-4 w-4 mr-1 ${stockStatus.color}`} />
                    <span className="text-gray-900 font-medium">
                      {product.current_stock} / {product.min_stock_level}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Qté entrée:</span>
                  <span className="text-gray-900 font-medium">{productQuantities[product.id]?.quantityIn || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Qté sortie:</span>
                  <span className="text-gray-900 font-medium">{productQuantities[product.id]?.quantityOut || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Prix:</span>
                  <span className="text-gray-900 font-medium">{getCurrentPrice(product)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Activité:</span>
                  <div className="flex items-center gap-2">
                    {productLastOrders[product.id] && (
                      <button
                        onClick={() => handleOrderClick(productLastOrders[product.id])}
                        className="cursor-pointer hover:opacity-70 transition-opacity p-1 rounded hover:bg-blue-50"
                        title={t('stock.table.hasOrder')}
                      >
                        <ShoppingCart 
                          className="h-4 w-4 text-blue-600" 
                        />
                      </button>
                    )}
                    {productLastSales[product.id] && (
                      <button
                        onClick={() => handleSaleClick(productLastSales[product.id])}
                        className="cursor-pointer hover:opacity-70 transition-opacity p-1 rounded hover:bg-green-50"
                        title="Dernière vente"
                      >
                        <ShoppingBag 
                          className="h-4 w-4 text-green-600" 
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
                        className="cursor-pointer hover:opacity-70 transition-opacity p-1 rounded hover:bg-purple-50"
                        title="Dernier approvisionnement"
                      >
                        <ArrowUp 
                          className="h-4 w-4 text-purple-600" 
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
                          className="h-4 w-4 text-orange-600" 
                        />
                      </button>
                    )}
                    {!productLastOrders[product.id] && !productLastSales[product.id] && !productLastStockIns[product.id] && !productMovements[product.id]?.hasMovement && (
                      <span className="text-gray-400">-</span>
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
                      onClick={() => setSelectedProduct(product)}
                      className="text-blue-600 hover:text-blue-900 transition-colors p-1 rounded hover:bg-blue-50"
                      title={t('stock.viewDetails')}
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedProduct(product);
                        setShowForm(true);
                      }}
                      className="text-indigo-600 hover:text-indigo-900 transition-colors p-1 rounded hover:bg-indigo-50"
                      title={t('app.edit')}
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
          <div className="text-center py-8 bg-white rounded-lg shadow-md">
            <p className="text-gray-500">{t('stock.noProducts')}</p>
          </div>
        )}
      </div>

      {/* Pagination - Mobile */}
      {sortedProducts.length > itemsPerPage && (
        <div className="md:hidden bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              {startIndex + 1}-{Math.min(endIndex, sortedProducts.length)} sur {sortedProducts.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('app.previous')}
              </button>
              <span className="text-sm text-gray-700">
                Page {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('app.next')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Liste des produits - Desktop Table View */}
      <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('stock.table.product')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('stock.table.stock')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IN
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  OUT
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('stock.table.price')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('stock.table.status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('stock.table.activity')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedProducts.map((product) => {
                const stockStatus = getStockStatus(product);
                const StockIcon = stockStatus.icon;
                
                return (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {product.image_url && !imageErrors[product.id] ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-10 w-10 object-cover rounded-md border border-gray-300 mr-3 flex-shrink-0"
                            onError={() => {
                              setImageErrors(prev => ({ ...prev, [product.id]: true }));
                            }}
                          />
                        ) : (
                          <div className="h-10 w-10 bg-gray-100 rounded-md border border-gray-300 flex items-center justify-center mr-3 flex-shrink-0">
                            <Package className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">{product.name}</div>
                          <div className="text-sm text-gray-500">
                            {product.category?.name || 'Sans catégorie'} • <span className="font-mono text-gray-400">{product.sku}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <StockIcon className={`h-4 w-4 mr-2 ${stockStatus.color}`} />
                        <span className="text-sm text-gray-900">
                          {product.current_stock} / {product.min_stock_level}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {productQuantities[product.id]?.quantityIn || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {productQuantities[product.id]?.quantityOut || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getCurrentPrice(product)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
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
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {productLastOrders[product.id] && (
                          <button
                            onClick={() => handleOrderClick(productLastOrders[product.id])}
                            className="cursor-pointer hover:opacity-70 transition-opacity p-1 rounded hover:bg-blue-50"
                            title={t('stock.table.hasOrder')}
                          >
                            <ShoppingCart 
                              className="h-4 w-4 text-blue-600" 
                            />
                          </button>
                        )}
                        {productLastStockIns[product.id] && (
                          <button
                            className="hover:opacity-70 transition-opacity p-1 rounded hover:bg-purple-50"
                            title="Dernier approvisionnement"
                          >
                            <ArrowUp 
                              className="h-4 w-4 text-purple-600" 
                            />
                          </button>
                        )}
                        {productLastSales[product.id] && (
                          <button
                            onClick={() => handleSaleClick(productLastSales[product.id])}
                            className="cursor-pointer hover:opacity-70 transition-opacity p-1 rounded hover:bg-green-50"
                            title="Dernière vente"
                          >
                            <ShoppingBag 
                              className="h-4 w-4 text-green-600" 
                            />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setSelectedProduct(product)}
                          className="text-blue-600 hover:text-blue-900 transition-colors p-1 rounded hover:bg-blue-50"
                          title={t('stock.viewDetails')}
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedProduct(product);
                            setShowForm(true);
                          }}
                          className="text-indigo-600 hover:text-indigo-900 transition-colors p-1 rounded hover:bg-indigo-50"
                          title={t('app.edit')}
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {sortedProducts.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">{t('stock.noProducts')}</p>
          </div>
        )}
      </div>

      {/* Pagination - Desktop */}
      {sortedProducts.length > itemsPerPage && (
        <div className="hidden md:block bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Affichage de {startIndex + 1} à {Math.min(endIndex, sortedProducts.length)} sur {sortedProducts.length} produits
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className={`px-3 py-2 text-sm border rounded-lg ${
                          currentPage === page
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  } else if (page === currentPage - 2 || page === currentPage + 2) {
                    return <span key={page} className="px-2 text-gray-500">...</span>;
                  }
                  return null;
                })}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('app.next')}
              </button>
            </div>
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
    </div>
  );
};

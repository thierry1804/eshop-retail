import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Product, User, PurchaseOrder, Sale } from '../../types';
import { Plus, Search, Package, AlertTriangle, TrendingUp, TrendingDown, Image as ImageIcon, ShoppingCart, ArrowUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ProductForm } from './ProductForm';
import { ProductDetails } from './ProductDetails';
import { PurchaseOrderDetails } from '../Supply/PurchaseOrderDetails';
import { SaleForm } from '../Sales/SaleForm';

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
  const [productOrders, setProductOrders] = useState<Record<string, { hasOrder: boolean; lastOrderDate?: string; orderId?: string }>>({});
  const [productMovements, setProductMovements] = useState<Record<string, { hasMovement: boolean; lastMovementDate?: string; referenceId?: string; referenceType?: string }>>({});
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showSaleForm, setShowSaleForm] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(name),
          supplier:suppliers(name),
          prices:product_prices(*)
        `)
        .order('name');

      if (error) throw error;
      setProducts(data || []);

      // Récupérer les informations sur les commandes et mouvements
      if (data && data.length > 0) {
        await fetchProductOrdersAndMovements(data.map(p => p.id));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductOrdersAndMovements = async (productIds: string[]) => {
    try {
      // Récupérer les dernières commandes pour chaque produit
      const { data: ordersData, error: ordersError } = await supabase
        .from('purchase_order_items')
        .select('product_id, purchase_order_id, purchase_orders(created_at)')
        .in('product_id', productIds);

      if (ordersError) {
        console.error('Erreur lors du chargement des commandes:', ordersError);
      } else {
        const ordersMap: Record<string, { hasOrder: boolean; lastOrderDate?: string; orderId?: string }> = {};
        productIds.forEach(id => {
          ordersMap[id] = { hasOrder: false };
        });
        
        if (ordersData) {
          // Trier par date de commande (plus récente en premier)
          const sortedOrders = [...ordersData].sort((a: any, b: any) => {
            const dateA = Array.isArray(a.purchase_orders) 
              ? a.purchase_orders[0]?.created_at 
              : a.purchase_orders?.created_at;
            const dateB = Array.isArray(b.purchase_orders) 
              ? b.purchase_orders[0]?.created_at 
              : b.purchase_orders?.created_at;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
          });

          sortedOrders.forEach((item: any) => {
            const productId = item.product_id;
            if (productId && !ordersMap[productId]?.hasOrder) {
              const purchaseOrder = Array.isArray(item.purchase_orders) 
                ? item.purchase_orders[0] 
                : item.purchase_orders;
              const orderDate = purchaseOrder?.created_at;
              const orderId = item.purchase_order_id;
              
              ordersMap[productId] = {
                hasOrder: true,
                lastOrderDate: orderDate || undefined,
                orderId: orderId
              };
            }
          });
        }
        setProductOrders(ordersMap);
      }

      // Récupérer les derniers mouvements (vente ou approvisionnement) pour chaque produit
      const { data: movementsData, error: movementsError } = await supabase
        .from('stock_movements')
        .select('product_id, reference_type, reference_id, created_at')
        .in('product_id', productIds)
        .in('reference_type', ['purchase', 'sale'])
        .order('created_at', { ascending: false });

      if (movementsError) {
        console.error('Erreur lors du chargement des mouvements:', movementsError);
      } else {
        const movementsMap: Record<string, { hasMovement: boolean; lastMovementDate?: string; referenceId?: string; referenceType?: string }> = {};
        productIds.forEach(id => {
          movementsMap[id] = { hasMovement: false };
        });
        
        if (movementsData) {
          movementsData.forEach((movement: any) => {
            const productId = movement.product_id;
            if (productId && !movementsMap[productId]?.hasMovement) {
              movementsMap[productId] = {
                hasMovement: true,
                lastMovementDate: movement.created_at,
                referenceId: movement.reference_id,
                referenceType: movement.reference_type
              };
            }
          });
        }
        setProductMovements(movementsMap);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des commandes et mouvements:', error);
    }
  };

  const handleOrderClick = async (orderId: string) => {
    try {
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
              sku
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

  const handleMovementClick = async (referenceId: string, referenceType: string) => {
    try {
      if (referenceType === 'sale') {
        // Charger la vente
        const { data, error } = await supabase
          .from('sales')
          .select(`
            *,
            client:clients(*)
          `)
          .eq('id', referenceId)
          .single();

        if (error) throw error;
        if (data) {
          setSelectedSale(data as Sale);
          setShowSaleForm(true);
        }
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
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm sm:text-base"
        >
          <Plus className="h-4 w-4" />
          {t('stock.newProduct')}
        </button>
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
        {sortedProducts.map((product) => {
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
                  <div className="text-xs text-gray-500 mt-1">{product.category?.name || 'Sans catégorie'}</div>
                  <div className="text-xs text-gray-400 mt-1 font-mono">{product.sku}</div>
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
                  <span className="text-gray-600">Prix:</span>
                  <span className="text-gray-900 font-medium">{getCurrentPrice(product)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Activité:</span>
                  <div className="flex items-center gap-2">
                    {productOrders[product.id]?.hasOrder && productOrders[product.id]?.orderId && (
                      <button
                        onClick={() => handleOrderClick(productOrders[product.id].orderId!)}
                        className="cursor-pointer hover:opacity-70 transition-opacity"
                        title={t('stock.table.hasOrder')}
                      >
                        <ShoppingCart 
                          className="h-4 w-4 text-blue-600" 
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
                          className="h-4 w-4 text-green-600" 
                        />
                      </button>
                    )}
                    {!productOrders[product.id]?.hasOrder && !productMovements[product.id]?.hasMovement && (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    product.status === 'active' ? 'bg-green-100 text-green-800' :
                    product.status === 'inactive' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {t(`stock.status.${product.status}`)}
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setSelectedProduct(product)}
                      className="text-blue-600 hover:text-blue-900 text-xs font-medium"
                    >
                      {t('stock.viewDetails')}
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => {
                        setSelectedProduct(product);
                        setShowForm(true);
                      }}
                      className="text-indigo-600 hover:text-indigo-900 text-xs font-medium"
                    >
                      {t('app.edit')}
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
                  {t('stock.table.sku')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('stock.table.stock')}
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
              {sortedProducts.map((product) => {
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
                          <div className="text-sm text-gray-500">{product.category?.name || 'Sans catégorie'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.sku}
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
                      {getCurrentPrice(product)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        product.status === 'active' ? 'bg-green-100 text-green-800' :
                        product.status === 'inactive' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {t(`stock.status.${product.status}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {productOrders[product.id]?.hasOrder && productOrders[product.id]?.orderId && (
                          <button
                            onClick={() => handleOrderClick(productOrders[product.id].orderId!)}
                            className="cursor-pointer hover:opacity-70 transition-opacity"
                            title={t('stock.table.hasOrder')}
                          >
                            <ShoppingCart 
                              className="h-4 w-4 text-blue-600" 
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
                              className="h-4 w-4 text-green-600" 
                            />
                          </button>
                        )}
                        {!productOrders[product.id]?.hasOrder && !productMovements[product.id]?.hasMovement && (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setSelectedProduct(product)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        {t('stock.viewDetails')}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setShowForm(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        {t('app.edit')}
                      </button>
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
    </div>
  );
};

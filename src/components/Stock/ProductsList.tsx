import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Product, User } from '../../types';
import { Plus, Search, Package, AlertTriangle, TrendingUp, TrendingDown, Image as ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ProductForm } from './ProductForm';
import { ProductDetails } from './ProductDetails';

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
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

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
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.barcode?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || product.status === filterStatus;
    return matchesSearch && matchesStatus;
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
    </div>
  );
};

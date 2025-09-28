import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Product, User, ProductPrice, StockMovement } from '../../types';
import { Package, Edit, Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { ProductPrices } from './ProductPrices';
import { StockMovements } from './StockMovements';

interface ProductDetailsProps {
  product: Product;
  onClose: () => void;
  onEdit: () => void;
  user: User;
}

export const ProductDetails: React.FC<ProductDetailsProps> = ({ product, onClose, onEdit, user }) => {
  const [prices, setPrices] = useState<ProductPrice[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'prices' | 'movements'>('details');

  useEffect(() => {
    fetchProductData();
  }, [product.id]);

  const fetchProductData = async () => {
    try {
      const [pricesRes, movementsRes] = await Promise.all([
        supabase.from('product_prices').select('*').eq('product_id', product.id).order('created_at', { ascending: false }),
        supabase.from('stock_movements').select('*').eq('product_id', product.id).order('created_at', { ascending: false }).limit(10)
      ]);
      setPrices(pricesRes.data || []);
      setMovements(movementsRes.data || []);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = () => {
    if (product.current_stock === 0) return { status: 'Épuisé', color: 'text-red-600' };
    if (product.current_stock <= product.min_stock_level) return { status: 'Stock bas', color: 'text-yellow-600' };
    return { status: 'Normal', color: 'text-green-600' };
  };

  const stockStatus = getStockStatus();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h2 className="text-2xl font-bold">{product.name}</h2>
              <p className="text-gray-600">SKU: {product.sku}</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={onEdit}
              className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Edit className="h-4 w-4 mr-1" />
              Modifier
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Fermer
            </button>
          </div>
        </div>

        {/* Onglets */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'details'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Détails
            </button>
            <button
              onClick={() => setActiveTab('prices')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'prices'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Prix
            </button>
            <button
              onClick={() => setActiveTab('movements')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'movements'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Mouvements
            </button>
          </nav>
        </div>

        {/* Contenu des onglets */}
        {activeTab === 'details' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Informations générales */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Informations générales</h3>
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div><strong>Description:</strong> {product.description || 'Aucune'}</div>
                <div><strong>Code-barres:</strong> {product.barcode || 'Aucun'}</div>
                <div><strong>Unitaire:</strong> {product.unit}</div>
                <div><strong>Statut:</strong> 
                  <span className={`ml-2 ${product.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                    {product.status === 'active' ? 'Actif' : 'Inactif'}
                  </span>
                </div>
              </div>

              {/* Stock */}
              <div>
                <h4 className="font-semibold mb-2">Stock</h4>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span>Stock actuel:</span>
                    <span className="font-semibold">{product.current_stock}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Stock réservé:</span>
                    <span>{product.reserved_stock}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Stock disponible:</span>
                    <span className="font-semibold text-blue-600">{product.available_stock}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Stock minimum:</span>
                    <span>{product.min_stock_level}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Statut:</span>
                    <span className={stockStatus.color}>{stockStatus.status}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Prix actuels */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Prix actuels</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                {prices.length > 0 ? (
                  <div className="space-y-2">
                    {prices.slice(0, 3).map(price => (
                      <div key={price.id} className="flex justify-between">
                        <span className="capitalize">{price.price_type}:</span>
                        <span className="font-semibold">
                          {price.price.toLocaleString()} {price.currency}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">Aucun prix défini</p>
                )}
              </div>

              {/* Derniers mouvements */}
              <div>
                <h4 className="font-semibold mb-2">Derniers mouvements</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  {movements.length > 0 ? (
                    <div className="space-y-2">
                      {movements.map(movement => (
                        <div key={movement.id} className="flex justify-between items-center">
                          <div className="flex items-center">
                            {movement.movement_type === 'in' ? (
                              <TrendingUp className="h-4 w-4 text-green-600 mr-2" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-600 mr-2" />
                            )}
                            <span className="text-sm">
                              {movement.movement_type === 'in' ? '+' : '-'}{movement.quantity}
                            </span>
                          </div>
                          <span className="text-sm text-gray-500">
                            {new Date(movement.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">Aucun mouvement récent</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'prices' && (
          <ProductPrices
            product={product}
            user={user}
            onPricesChange={() => {
              fetchProductData();
            }}
          />
        )}

        {activeTab === 'movements' && (
          <StockMovements
            product={product}
            user={user}
            onMovementsChange={() => {
              fetchProductData();
            }}
          />
        )}
      </div>
    </div>
  );
};

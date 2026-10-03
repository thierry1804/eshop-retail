import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Product, User, ProductPrice, StockMovement } from '../../types';
import { Package, Edit, TrendingUp, TrendingDown, Image as ImageIcon, X } from 'lucide-react';
import { Offcanvas, OffcanvasHeader, OffcanvasBody } from '../ui/Offcanvas';
import { ProductPrices } from './ProductPrices';
import { StockMovements } from './StockMovements';
import { formatDateDisplay } from '../../lib/dateUtils';

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
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    fetchProductData();
    setImageError(false); // Réinitialiser l'erreur d'image quand le produit change
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
    <Offcanvas onClose={onClose} width="lg" ariaLabel={`Détails produit — ${product.name}`}>
      <OffcanvasHeader className="pt-3 sm:pt-4">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Image du produit */}
              {product.image_url && !imageError ? (
                <div className="flex-shrink-0">
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-12 h-12 sm:w-14 sm:h-14 object-cover rounded-md border app-border"
                    onError={() => setImageError(true)}
                  />
                </div>
              ) : (
                <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 app-bg-muted rounded-md border app-border flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 app-text-muted" />
                </div>
              )}
              <div className="flex items-center min-w-0 flex-1">
                <Package className="h-5 w-5 app-text-link mr-2 flex-shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-semibold truncate leading-tight">{product.name}</h2>
                  <p className="text-xs app-text-muted">SKU: {product.sku}</p>
                </div>
              </div>
            </div>
            <div className="flex space-x-1.5 flex-shrink-0">
              <button
                onClick={onEdit}
                className="app-btn app-btn-primary app-btn-sm"
              >
                <Edit className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">Modifier</span>
                <span className="sm:hidden">Modif.</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="app-icon-btn flex-shrink-0"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Onglets */}
          <nav className="flex space-x-4">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-1.5 px-1 border-b-2 font-medium text-xs ${
                activeTab === 'details'
                  ? 'app-tab-active'
                  : 'app-tab'
              }`}
            >
              Détails
            </button>
            <button
              onClick={() => setActiveTab('prices')}
              className={`py-1.5 px-1 border-b-2 font-medium text-xs ${
                activeTab === 'prices'
                  ? 'app-tab-active'
                  : 'app-tab'
              }`}
            >
              Prix
            </button>
            <button
              onClick={() => setActiveTab('movements')}
              className={`py-1.5 px-1 border-b-2 font-medium text-xs ${
                activeTab === 'movements'
                  ? 'app-tab-active'
                  : 'app-tab'
              }`}
            >
              Mouvements
            </button>
          </nav>
      </OffcanvasHeader>

      <OffcanvasBody>
        {/* Contenu des onglets */}
        {activeTab === 'details' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Informations générales */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Informations générales</h3>
              
              {/* Image en grand si disponible */}
              {product.image_url && !imageError && (
                <div className="app-bg-muted p-4 rounded-lg">
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full max-w-md mx-auto rounded-lg shadow-md object-cover"
                    style={{ maxHeight: '400px' }}
                    onError={() => setImageError(true)}
                  />
                </div>
              )}
              
              <div className="app-bg-muted p-4 rounded-lg space-y-2">
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
                <div className="app-bg-muted p-4 rounded-lg space-y-2">
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
                    <span className="font-semibold app-text-link">{product.available_stock}</span>
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
              <div className="app-bg-muted p-4 rounded-lg">
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
                  <p className="app-text-muted">Aucun prix défini</p>
                )}
              </div>

              {/* Derniers mouvements */}
              <div>
                <h4 className="font-semibold mb-2">Derniers mouvements</h4>
                <div className="app-bg-muted p-4 rounded-lg">
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
                          <span className="text-sm app-text-muted">
                            {formatDateDisplay(movement.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="app-text-muted">Aucun mouvement récent</p>
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
      </OffcanvasBody>
    </Offcanvas>
  );
};

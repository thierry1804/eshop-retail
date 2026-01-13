import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Product } from '../../types';
import { Plus, X, Package, Search, AlertCircle, ChevronDown } from 'lucide-react';
import { generateIncrementalSKU } from '../../lib/skuGenerator';

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

interface SaleItemsManagerProps {
  items: SaleItem[];
  onItemsChange: (items: SaleItem[]) => void;
  deposit: number;
  onDepositChange: (deposit: number) => void;
}

export const SaleItemsManager: React.FC<SaleItemsManagerProps> = ({ items, onItemsChange, deposit, onDepositChange }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [currentItem, setCurrentItem] = useState<Partial<SaleItem>>({
    product_name: '',
    quantity: 1,
    unit_price: 0,
    total_price: 0
  });

  // Fonction pour sélectionner tout le texte au focus
  const handleNumberInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };
  const [selectedProductPrices, setSelectedProductPrices] = useState<any[]>([]);
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [generatedSKU, setGeneratedSKU] = useState('');
  const productSearchRef = useRef<HTMLDivElement>(null);
  const [newProductData, setNewProductData] = useState({
    name: '',
    description: '',
    sku: '',
    unit: 'pièce',
    min_stock_level: 0,
    current_stock: 1
  });
  const [creatingProduct, setCreatingProduct] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  // Effet pour gérer les clics en dehors du composant de recherche de produit
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productSearchRef.current && !productSearchRef.current.contains(event.target as Node)) {
        setShowProductDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  }, [products, searchTerm]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error);
    }
  };

  const fetchProductPrices = async (productId: string) => {
    try {
      const { data, error } = await supabase
        .from('product_prices')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('price_type');

      if (error) throw error;
      setSelectedProductPrices(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des prix:', error);
      setSelectedProductPrices([]);
    }
  };

  // Générer le SKU quand le nom du produit change
  useEffect(() => {
    const generateSKU = async () => {
      if (newProductData.name && newProductData.name.length >= 3) {
        try {
          const sku = await generateIncrementalSKU(newProductData.name);
          setGeneratedSKU(sku);
        } catch (error) {
          console.error('Erreur lors de la génération du SKU:', error);
          setGeneratedSKU('');
        }
      } else {
        setGeneratedSKU('');
      }
    };

    generateSKU();
  }, [newProductData.name]);

  const createNewProduct = async () => {
    if (!newProductData.name.trim()) {
      alert('Le nom du produit est obligatoire');
      return;
    }

    setCreatingProduct(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const productData = {
        name: newProductData.name,
        description: newProductData.description,
        sku: generatedSKU,
        unit: newProductData.unit,
        min_stock_level: newProductData.min_stock_level,
        current_stock: 0, // Sera calculé automatiquement par le trigger
        reserved_stock: 0,
        status: 'active',
        created_by: user?.id
      };

      const { data, error } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single();

      if (error) throw error;

      // Créer un mouvement de stock d'entrée pour initialiser le stock
      if (newProductData.current_stock > 0) {
        const { error: movementError } = await supabase
          .from('stock_movements')
          .insert({
            product_id: data.id,
            movement_type: 'in',
            quantity: newProductData.current_stock,
            reference_type: 'initial_stock',
            reference_id: data.id,
            notes: `Stock initial - ${data.name}`,
            created_by: user?.id
          } as any);

        if (movementError) {
          console.error('Erreur lors de la création du mouvement de stock initial:', movementError);
          // Continuer même si le mouvement de stock échoue
        }
      }

      // Ajouter le nouveau produit à la liste
      setProducts(prev => [...prev, data]);
      
      // Sélectionner automatiquement le nouveau produit
      setCurrentItem(prev => ({
        ...prev,
        article_id: data.id,
        product_name: data.name,
        sku: data.sku,
        unit_price: 0
      }));

      // Mettre à jour le terme de recherche avec le nom du produit créé
      setSearchTerm(data.name);

      // Réinitialiser le formulaire
      setNewProductData({
        name: '',
        description: '',
        sku: '',
        unit: 'pièce',
        min_stock_level: 0,
        current_stock: 1
      });
      setGeneratedSKU('');
      setShowNewProductForm(false);
    } catch (error) {
      console.error('Erreur lors de la création du produit:', error);
      alert('Erreur lors de la création du produit');
    } finally {
      setCreatingProduct(false);
    }
  };

  const handleProductSelect = (product: Product) => {
    setCurrentItem(prev => ({
      ...prev,
      article_id: product.id,
      product_name: product.name,
      sku: product.sku,
      unit_price: 0
    }));
    setSearchTerm(product.name);
    setShowProductDropdown(false);
    
    // Récupérer les prix du produit sélectionné
    fetchProductPrices(product.id);
  };

  const handleQuantityChange = (quantity: number) => {
    const unitPrice = currentItem.unit_price || 0;
    setCurrentItem(prev => ({
      ...prev,
      quantity,
      total_price: quantity * unitPrice
    }));
  };

  const handleUnitPriceChange = (unitPrice: number) => {
    const quantity = currentItem.quantity || 1;
    setCurrentItem(prev => ({
      ...prev,
      unit_price: unitPrice,
      total_price: quantity * unitPrice
    }));
  };

  const handlePriceSelect = (price: number) => {
    const quantity = currentItem.quantity || 1;
    setCurrentItem(prev => ({
      ...prev,
      unit_price: price,
      total_price: quantity * price
    }));
  };

  const addItem = () => {
    if (!currentItem.product_name?.trim()) {
      alert('Veuillez sélectionner ou créer un produit');
      return;
    }

    if (!currentItem.quantity || currentItem.quantity <= 0) {
      alert('La quantité doit être supérieure à 0');
      return;
    }

    if (!currentItem.unit_price || currentItem.unit_price <= 0) {
      alert('Le prix unitaire doit être supérieur à 0');
      return;
    }

    const newItem: SaleItem = {
      id: Date.now().toString(),
      article_id: currentItem.article_id,
      product_name: currentItem.product_name,
      sku: currentItem.sku || '',
      quantity: currentItem.quantity,
      unit_price: currentItem.unit_price,
      total_price: currentItem.total_price,
      isNewProduct: !currentItem.article_id
    };

    onItemsChange([...items, newItem]);

    // Réinitialiser le formulaire
    setCurrentItem({
      product_name: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0
    });
    setSearchTerm('');
    setSelectedProductPrices([]);
  };

  const removeItem = (itemId: string) => {
    onItemsChange(items.filter(item => item.id !== itemId));
  };

  const totalAmount = items.reduce((sum, item) => {
    const itemTotal = Number(item.total_price) || 0;
    return sum + (isNaN(itemTotal) ? 0 : itemTotal);
  }, 0);
  const remainingBalance = totalAmount - deposit;

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
          <Package className="h-5 w-5" />
          Articles de la vente
        </h3>
        <span className="text-sm text-gray-500">
          Total: {isNaN(totalAmount) ? '0' : totalAmount.toLocaleString()} MGA
        </span>
      </div>

      {/* Formulaire de création de produit (modal) */}
      {showNewProductForm && (
        <div className="bg-blue-50 p-3 rounded border border-blue-200 space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Créer un nouveau produit</span>
            </div>
            <button
              type="button"
              onClick={() => setShowNewProductForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nom du produit *
              </label>
              <input
                type="text"
                placeholder="Nom du produit"
                value={newProductData.name}
                onChange={(e) => setNewProductData({ ...newProductData, name: e.target.value })}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                SKU (généré automatiquement)
              </label>
              <input
                type="text"
                placeholder="SKU généré automatiquement"
                value={generatedSKU}
                readOnly
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-50 text-gray-600"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Unité
              </label>
              <input
                type="text"
                placeholder="pièce, kg, etc."
                value={newProductData.unit}
                onChange={(e) => setNewProductData({ ...newProductData, unit: e.target.value })}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Stock actuel
              </label>
              <input
                type="number"
                placeholder="1"
                value={newProductData.current_stock}
                onChange={(e) => setNewProductData({ ...newProductData, current_stock: Number(e.target.value) })}
                onFocus={handleNumberInputFocus}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Stock minimum
              </label>
              <input
                type="number"
                placeholder="0"
                value={newProductData.min_stock_level}
                onChange={(e) => setNewProductData({ ...newProductData, min_stock_level: Number(e.target.value) })}
                onFocus={handleNumberInputFocus}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Description (optionnel)
            </label>
            <textarea
              placeholder="Description du produit..."
              value={newProductData.description}
              onChange={(e) => setNewProductData({ ...newProductData, description: e.target.value })}
              rows={2}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowNewProductForm(false)}
              className="px-3 py-1 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={createNewProduct}
              disabled={creatingProduct}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {creatingProduct ? 'Création...' : 'Créer le produit'}
            </button>
          </div>
        </div>
      )}

      {/* Tableau des articles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700">Articles de la vente</h4>
          <button
            type="button"
            onClick={() => setShowNewProductForm(!showNewProductForm)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 hidden"
          >
            <Plus className="h-4 w-4" />
            Nouveau produit
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Article
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Qté
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PU
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Ligne d'ajout d'article */}
              <tr className="bg-blue-50 border-2 border-blue-200">
                <td className="px-3 py-2">
                  <div className="relative" ref={productSearchRef}>
                    <Search className="absolute left-2 top-2 h-3 w-3 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setShowProductDropdown(true);
                      }}
                      onFocus={() => setShowProductDropdown(true)}
                      placeholder="Rechercher un produit..."
                      className="w-full pl-7 pr-6 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowProductDropdown(!showProductDropdown)}
                      className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    {showProductDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-40 overflow-y-auto">
                        {filteredProducts.length > 0 ? (
                          filteredProducts.map((product) => (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => handleProductSelect(product)}
                              className="w-full px-2 py-1 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none border-b border-gray-100 last:border-b-0 text-xs"
                            >
                              <div className="font-medium text-gray-900">{product.name}</div>
                              <div className="text-xs text-gray-500">SKU: {product.sku} | Stock: {product.current_stock}</div>
                            </button>
                          ))
                        ) : (
                          <div className="px-2 py-1">
                            {searchTerm.trim() ? (
                              <div className="space-y-1">
                                <div className="text-gray-500 text-xs">Aucun produit trouvé</div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewProductData(prev => ({ ...prev, name: searchTerm }));
                                    setShowNewProductForm(true);
                                    setShowProductDropdown(false);
                                  }}
                                  className="w-full flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 rounded border border-blue-200"
                                >
                                  <Plus className="h-3 w-3" />
                                  Créer "{searchTerm}"
                                </button>
                              </div>
                            ) : (
                              <div className="text-gray-500 text-xs">Aucun produit disponible</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="number"
                    min="1"
                    value={currentItem.quantity || 1}
                    onChange={(e) => handleQuantityChange(Number(e.target.value))}
                    onFocus={handleNumberInputFocus}
                    className="w-16 px-1 py-1 text-sm border border-gray-300 rounded text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="space-y-1">
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={currentItem.unit_price || 0}
                      onChange={(e) => handleUnitPriceChange(Number(e.target.value))}
                      onFocus={handleNumberInputFocus}
                      className="w-20 px-1 py-1 text-sm border border-gray-300 rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="0"
                    />
                    {selectedProductPrices.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-end">
                        {selectedProductPrices.map((price, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handlePriceSelect(price.price)}
                            className={`px-1 py-0.5 text-xs rounded border ${
                              currentItem.unit_price === price.price
                                ? 'bg-blue-100 border-blue-300 text-blue-800'
                                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {price.price_type}: {price.price.toLocaleString()}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="text-sm font-medium text-gray-900">
                    {currentItem.total_price || 0}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center justify-center w-8 h-8 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    title="Ajouter l'article"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </td>
              </tr>

              {/* Articles existants */}
              {items.length > 0 ? (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                        {item.isNewProduct && (
                          <span className="inline-flex items-center px-1.5 py-0.5 mt-1 bg-blue-100 text-blue-800 text-xs rounded w-fit">
                            Nouveau
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="text-sm text-gray-900">{item.quantity}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-sm text-gray-900">
                        {isNaN(item.unit_price) ? '0' : item.unit_price.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-sm font-medium text-gray-900">
                        {isNaN(item.total_price) ? '0' : item.total_price.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-50 transition-colors"
                        title="Supprimer l'article"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-gray-500 text-sm">
                    Aucun article ajouté
                  </td>
                </tr>
              )}
              
              {/* Ligne de séparation */}
              <tr>
                <td colSpan={5} className="px-3 py-1">
                  <hr className="border-gray-300" />
                </td>
              </tr>
              
              {/* Ligne Total */}
              <tr className="bg-gray-50">
                <td colSpan={3} className="px-3 py-2 text-right font-medium text-gray-900">
                  Total:
                </td>
                <td className="px-3 py-2 text-right font-bold text-gray-900">
                  {isNaN(totalAmount) ? '0' : totalAmount.toLocaleString()} MGA
                </td>
                <td className="px-3 py-2"></td>
              </tr>
              
              {/* Ligne Acompte */}
              <tr className="bg-gray-50">
                <td colSpan={3} className="px-3 py-2 text-right font-medium text-gray-900">
                  Acompte:
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    min="0"
                    max={totalAmount}
                    step="100"
                    value={deposit}
                    onChange={(e) => onDepositChange(Number(e.target.value))}
                    onFocus={handleNumberInputFocus}
                    className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                  />
                </td>
                <td className="px-3 py-2"></td>
              </tr>
              
              {/* Ligne Reste */}
              <tr className="bg-gray-50">
                <td colSpan={3} className="px-3 py-2 text-right font-medium text-gray-900">
                  Reste:
                </td>
                <td className="px-3 py-2 text-right font-bold text-red-600">
                  {isNaN(remainingBalance) ? '0' : remainingBalance.toLocaleString()} MGA
                </td>
                <td className="px-3 py-2"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

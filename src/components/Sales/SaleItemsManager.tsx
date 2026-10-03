import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Product } from '../../types';
import { Plus, X, Package, AlertCircle, ChevronDown } from 'lucide-react';
import { SearchField } from '../ui/SearchField';
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
        <h3 className="text-lg font-medium app-text flex items-center gap-2">
          <Package className="h-5 w-5" />
          Articles de la vente
        </h3>
        <span className="text-sm app-text-muted">
          Total: {isNaN(totalAmount) ? '0' : totalAmount.toLocaleString()} MGA
        </span>
      </div>

      {/* Formulaire de création de produit (modal) */}
      {showNewProductForm && (
        <div className="app-bg-muted p-3 rounded border app-border space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 app-text-link" />
              <span className="text-sm font-medium app-text-link">Créer un nouveau produit</span>
            </div>
            <button
              type="button"
              onClick={() => setShowNewProductForm(false)}
              className="app-text-muted hover:app-text-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="app-label">Nom du produit *</label>
              <input
                type="text"
                placeholder="Nom du produit"
                value={newProductData.name}
                onChange={(e) => setNewProductData({ ...newProductData, name: e.target.value })}
                className="app-input"
              />
            </div>
            <div>
              <label className="app-label">SKU (auto)</label>
              <input
                type="text"
                placeholder="SKU généré automatiquement"
                value={generatedSKU}
                readOnly
                className="app-input"
                style={{ backgroundColor: 'var(--app-surface-muted)', color: 'var(--app-ink-muted)' }}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="app-label">Unité</label>
              <input
                type="text"
                placeholder="pièce, kg…"
                value={newProductData.unit}
                onChange={(e) => setNewProductData({ ...newProductData, unit: e.target.value })}
                className="app-input"
              />
            </div>
            <div>
              <label className="app-label">Stock actuel</label>
              <input
                type="number"
                placeholder="1"
                value={newProductData.current_stock}
                onChange={(e) => setNewProductData({ ...newProductData, current_stock: Number(e.target.value) })}
                onFocus={handleNumberInputFocus}
                className="app-input"
              />
            </div>
            <div>
              <label className="app-label">Stock minimum</label>
              <input
                type="number"
                placeholder="0"
                value={newProductData.min_stock_level}
                onChange={(e) => setNewProductData({ ...newProductData, min_stock_level: Number(e.target.value) })}
                onFocus={handleNumberInputFocus}
                className="app-input"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-medium app-text-muted mb-1">
              Description (optionnel)
            </label>
            <textarea
              placeholder="Description du produit..."
              value={newProductData.description}
              onChange={(e) => setNewProductData({ ...newProductData, description: e.target.value })}
              rows={2}
              className="app-input text-sm py-1 px-2"
            />
          </div>
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowNewProductForm(false)}
              className="app-btn app-btn-secondary app-btn-sm"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={createNewProduct}
              disabled={creatingProduct}
              className="app-btn app-btn-primary app-btn-sm disabled:opacity-50"
            >
              {creatingProduct ? 'Création...' : 'Créer le produit'}
            </button>
          </div>
        </div>
      )}

      {/* Articles — mobile : cartes ; desktop : tableau */}
      <div className="space-y-3" ref={productSearchRef}>
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium" style={{ color: 'var(--app-ink)' }}>Articles</h4>
        </div>

        {/* Mobile: formulaire d'ajout + liste */}
        <div className="md:hidden space-y-3">
          <div className="app-surface p-3 space-y-3">
            <div className="relative">
              <SearchField
                value={searchTerm}
                onChange={(value) => {
                  setSearchTerm(value);
                  setShowProductDropdown(true);
                }}
                onFocus={() => setShowProductDropdown(true)}
                placeholder="Rechercher un produit…"
                className="w-full"
              />
              {showProductDropdown && (
                <div
                  className="absolute z-20 w-full mt-1 max-h-48 overflow-y-auto app-surface md:hidden"
                  style={{ boxShadow: 'var(--app-shadow-panel)' }}
                >
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleProductSelect(product)}
                        className="w-full px-3 py-3 text-left border-b last:border-b-0 min-h-[44px]"
                        style={{ borderColor: 'var(--app-border)' }}
                      >
                        <div className="text-sm font-medium" style={{ color: 'var(--app-ink)' }}>{product.name}</div>
                        <div className="text-xs" style={{ color: 'var(--app-ink-muted)' }}>
                          SKU: {product.sku} · Stock: {product.current_stock}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-3 space-y-2">
                      <div className="text-xs" style={{ color: 'var(--app-ink-muted)' }}>
                        {searchTerm.trim() ? 'Aucun produit trouvé' : 'Aucun produit'}
                      </div>
                      {searchTerm.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewProductData((prev) => ({ ...prev, name: searchTerm }));
                            setShowNewProductForm(true);
                            setShowProductDropdown(false);
                          }}
                          className="app-btn app-btn-secondary app-btn-sm w-full"
                        >
                          <Plus className="h-4 w-4" />
                          Créer « {searchTerm} »
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="app-label">Qté</label>
                <input
                  type="number"
                  min="1"
                  value={currentItem.quantity || 1}
                  onChange={(e) => handleQuantityChange(Number(e.target.value))}
                  onFocus={handleNumberInputFocus}
                  className="app-input"
                />
              </div>
              <div>
                <label className="app-label">Prix unit.</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={currentItem.unit_price || 0}
                  onChange={(e) => handleUnitPriceChange(Number(e.target.value))}
                  onFocus={handleNumberInputFocus}
                  className="app-input"
                />
              </div>
            </div>

            {selectedProductPrices.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedProductPrices.map((price, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handlePriceSelect(price.price)}
                    className={`app-btn app-btn-sm ${
                      currentItem.unit_price === price.price ? 'app-btn-primary' : 'app-btn-secondary'
                    }`}
                  >
                    {price.price_type}: {price.price.toLocaleString()}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span style={{ color: 'var(--app-ink-muted)' }}>Total ligne</span>
              <span className="font-semibold" style={{ color: 'var(--app-ink)' }}>
                {(currentItem.total_price || 0).toLocaleString()} MGA
              </span>
            </div>

            <button
              type="button"
              onClick={addItem}
              className="app-btn app-btn-success w-full min-h-[44px]"
            >
              <Plus className="h-4 w-4" />
              Ajouter l’article
            </button>
          </div>

          {items.length === 0 ? (
            <div className="app-empty py-6">
              <p className="app-empty-text">Aucun article ajouté</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="app-list-card flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--app-ink)' }}>
                    {item.product_name}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--app-ink-muted)' }}>
                    {item.quantity} × {(item.unit_price || 0).toLocaleString()} MGA
                  </div>
                  <div className="text-sm font-semibold mt-1" style={{ color: 'var(--app-ink)' }}>
                    {(item.total_price || 0).toLocaleString()} MGA
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="app-icon-btn app-icon-btn-danger flex-shrink-0"
                  aria-label="Supprimer l’article"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))
          )}

          <div className="app-surface p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--app-ink-muted)' }}>Total</span>
              <span className="font-semibold">{(isNaN(totalAmount) ? 0 : totalAmount).toLocaleString()} MGA</span>
            </div>
            <div>
              <label className="app-label" htmlFor="sale-deposit-mobile">Acompte</label>
              <input
                id="sale-deposit-mobile"
                type="number"
                min="0"
                max={totalAmount}
                step="100"
                value={deposit}
                onChange={(e) => onDepositChange(Number(e.target.value))}
                onFocus={handleNumberInputFocus}
                className="app-input"
              />
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span>Reste</span>
              <span style={{ color: 'var(--app-danger)' }}>
                {(isNaN(remainingBalance) ? 0 : remainingBalance).toLocaleString()} MGA
              </span>
            </div>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="app-table-striped w-full border app-border rounded-lg">
            <thead className="app-bg-muted">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium app-text-muted uppercase tracking-wider">
                  Article
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium app-text-muted uppercase tracking-wider">
                  Qté
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium app-text-muted uppercase tracking-wider">
                  PU
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium app-text-muted uppercase tracking-wider">
                  Total
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium app-text-muted uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-[var(--app-border)]">
              {/* Ligne d'ajout d'article */}
              <tr className="app-bg-muted border-2 app-border">
                <td className="px-3 py-2">
                  <div className="relative">
                    <SearchField
                      value={searchTerm}
                      onChange={(value) => {
                        setSearchTerm(value);
                        setShowProductDropdown(true);
                      }}
                      onFocus={() => setShowProductDropdown(true)}
                      placeholder="Rechercher un produit..."
                      className="w-full"
                      inputClassName="text-sm py-1 pr-6"
                    />
                    <button
                      type="button"
                      onClick={() => setShowProductDropdown(!showProductDropdown)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 app-icon-btn"
                      aria-label="Liste des produits"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    {showProductDropdown && (
                      <div className="app-dropdown absolute z-10 w-full mt-1 max-h-40 overflow-y-auto hidden md:block">
                        {filteredProducts.length > 0 ? (
                          filteredProducts.map((product) => (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => handleProductSelect(product)}
                              className="app-dropdown-item text-xs"
                            >
                              <div className="font-medium app-text">{product.name}</div>
                              <div className="text-xs app-text-muted">SKU: {product.sku} | Stock: {product.current_stock}</div>
                            </button>
                          ))
                        ) : (
                          <div className="px-2 py-1">
                            {searchTerm.trim() ? (
                              <div className="space-y-1">
                                <div className="app-text-muted text-xs">Aucun produit trouvé</div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewProductData(prev => ({ ...prev, name: searchTerm }));
                                    setShowNewProductForm(true);
                                    setShowProductDropdown(false);
                                  }}
                                  className="w-full flex items-center gap-1 px-2 py-1 text-xs app-bg-muted app-text-link hover:bg-[var(--app-surface-muted)] rounded border app-border"
                                >
                                  <Plus className="h-3 w-3" />
                                  Créer "{searchTerm}"
                                </button>
                              </div>
                            ) : (
                              <div className="app-text-muted text-xs">Aucun produit disponible</div>
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
                    className="app-input w-16 text-sm py-1 px-1 text-center"
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
                      className="app-input w-20 text-sm py-1 px-1 text-right"
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
                                ? 'app-badge app-badge-info'
                                : 'app-bg-muted border app-divider app-text-muted hover:bg-[var(--app-surface-muted)]'
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
                  <span className="text-sm font-medium app-text">
                    {currentItem.total_price || 0}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    type="button"
                    onClick={addItem}
                    className="app-btn app-btn-success app-btn-sm"
                    aria-label="Ajouter l'article"
                    title="Ajouter l'article"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </td>
              </tr>

              {/* Articles existants */}
              {items.length > 0 ? (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--app-surface-muted)]">
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium app-text">{item.product_name}</div>
                        {item.isNewProduct && (
                          <span className="inline-flex items-center px-1.5 py-0.5 mt-1 app-badge app-badge-info w-fit">
                            Nouveau
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="text-sm app-text">{item.quantity}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-sm app-text">
                        {isNaN(item.unit_price) ? '0' : item.unit_price.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-sm font-medium app-text">
                        {isNaN(item.total_price) ? '0' : item.total_price.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="app-icon-btn app-icon-btn-danger"
                        aria-label="Supprimer l'article"
                        title="Supprimer l'article"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center app-text-muted text-sm">
                    Aucun article ajouté
                  </td>
                </tr>
              )}
              
              {/* Ligne de séparation */}
              <tr>
                <td colSpan={5} className="px-3 py-1">
                  <hr className="border app-border" />
                </td>
              </tr>
              
              {/* Ligne Total */}
              <tr className="app-bg-muted">
                <td colSpan={3} className="px-3 py-2 text-right font-medium app-text">
                  Total:
                </td>
                <td className="px-3 py-2 text-right font-bold app-text">
                  {isNaN(totalAmount) ? '0' : totalAmount.toLocaleString()} MGA
                </td>
                <td className="px-3 py-2"></td>
              </tr>
              
              {/* Ligne Acompte */}
              <tr className="app-bg-muted">
                <td colSpan={3} className="px-3 py-2 text-right font-medium app-text">
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
                    className="app-input w-24 text-sm py-1 px-2 text-right"
                  />
                </td>
                <td className="px-3 py-2"></td>
              </tr>
              
              {/* Ligne Reste */}
              <tr className="app-bg-muted">
                <td colSpan={3} className="px-3 py-2 text-right font-medium app-text">
                  Reste:
                </td>
                <td className="px-3 py-2 text-right font-bold app-text-danger">
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

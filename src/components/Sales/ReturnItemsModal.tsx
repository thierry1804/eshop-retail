import React, { useState, useEffect } from 'react';
import { devLog } from '../../lib/devLog';
import { X, RotateCcw, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { Sale } from '../../types';
import { Offcanvas, OffcanvasHeader, OffcanvasBody, OffcanvasFooter } from '../ui/Offcanvas';

interface SaleItem {
  id: string;
  sale_id: string;
  article_id?: string;
  product_name: string;
  quantity: number;
  returned_quantity?: number;
  unit_price: number;
  total_price: number;
}

interface ReturnItemsModalProps {
  sale: Sale;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReturnItemsModal: React.FC<ReturnItemsModalProps> = ({ sale, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [returning, setReturning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnNotes, setReturnNotes] = useState('');

  useEffect(() => {
    fetchSaleItems();
  }, [sale.id]);

  const fetchSaleItems = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Récupérer les articles de vente (utiliser select('*') pour éviter les problèmes de colonnes manquantes)
      const { data, error } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', sale.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Identifier les articles qui ont un article_id pour récupérer les noms depuis products
      const itemsWithArticleId = (data || []).filter((item: any) => item.article_id);
      const articleIds = itemsWithArticleId.map((item: any) => item.article_id).filter(Boolean);

      // Récupérer les noms des produits depuis la table products
      const productNamesMap: Record<string, string> = {};
      if (articleIds.length > 0) {
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('id, name')
          .in('id', articleIds);

        if (!productsError && productsData) {
          productsData.forEach((product: any) => {
            productNamesMap[product.id] = product.name;
          });
        }
      }

      // Mapper les articles avec les noms de produits et calculer total_price si nécessaire
      const items = (data || []).map((item: any) => {
        const quantity = Number(item.quantity) || 0;
        const unitPrice = Number(item.unit_price) || 0;
        // Calculer total_price si manquant ou invalide
        const totalPrice = item.total_price != null ? Number(item.total_price) : (quantity * unitPrice);
        
        const productName = item.article_id && productNamesMap[item.article_id] 
          ? productNamesMap[item.article_id] 
          : (item.product_name?.trim() || 'Article sans nom');
        
        return {
          ...item,
          product_name: productName,
          quantity: quantity,
          unit_price: unitPrice,
          total_price: isNaN(totalPrice) ? 0 : totalPrice,
          returned_quantity: item.returned_quantity || 0
        };
      });

      devLog('📦 ReturnItemsModal: Articles récupérés:', items);
      setSaleItems(items);
      
      // Initialiser les quantités de retour à 0
      const initialQuantities: Record<string, number> = {};
      items.forEach((item: SaleItem) => {
        initialQuantities[item.id] = 0;
      });
      setReturnQuantities(initialQuantities);
    } catch (err: any) {
      console.error('Erreur lors de la récupération des articles:', err);
      setError(err.message || 'Erreur lors du chargement des articles');
    } finally {
      setLoading(false);
    }
  };

  const getRemainingQuantity = (item: SaleItem): number => {
    const returned = item.returned_quantity || 0;
    return item.quantity - returned;
  };

  const handleQuantityChange = (itemId: string, value: string) => {
    const numValue = parseInt(value) || 0;
    const item = saleItems.find(i => i.id === itemId);
    if (!item) return;

    const remaining = getRemainingQuantity(item);
    const finalValue = Math.max(0, Math.min(numValue, remaining));
    
    setReturnQuantities(prev => ({
      ...prev,
      [itemId]: finalValue
    }));
  };

  const getSelectedItemsCount = (): number => {
    return Object.values(returnQuantities).filter(qty => qty > 0).length;
  };

  const getTotalReturnQuantity = (): number => {
    return Object.values(returnQuantities).reduce((sum, qty) => sum + qty, 0);
  };

  const handleReturn = async () => {
    // Vérifier qu'au moins un article est sélectionné
    const itemsToReturn = Object.entries(returnQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([sale_item_id, quantity_to_return]) => ({
        sale_item_id,
        quantity_to_return
      }));

    if (itemsToReturn.length === 0) {
      setError(t('sales.return.error.noItemsSelected'));
      return;
    }

    try {
      setReturning(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError(t('sales.return.error.noUser'));
        return;
      }

      // Appeler la fonction SQL pour retourner les articles
      const { data, error } = await supabase.rpc('return_sale_items', {
        p_sale_id: sale.id,
        p_user_id: user.id,
        p_items_to_return: itemsToReturn,
        p_return_notes: returnNotes || null
      });

      if (error) {
        console.error('Erreur lors du retour des articles:', error);
        setError(t('sales.return.error.failed') + ': ' + error.message);
        return;
      }

      if (data && !data.success) {
        setError(t('sales.return.error.failed') + ': ' + (data.error || t('errors.general')));
        return;
      }

      // Succès
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erreur lors du retour des articles:', err);
      setError(t('sales.return.error.failed') + ': ' + err.message);
    } finally {
      setReturning(false);
    }
  };

  if (loading) {
    return (
      <Offcanvas onClose={onClose} width="lg">
        <OffcanvasBody className="flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--app-primary)] mx-auto"></div>
            <p className="mt-4 app-text-muted">{t('sales.return.loading')}</p>
          </div>
        </OffcanvasBody>
      </Offcanvas>
    );
  }

  return (
    <Offcanvas onClose={onClose} width="lg">
      <OffcanvasHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <RotateCcw className="app-text-danger" size={22} />
            <h2 className="text-lg font-semibold app-text">
              {t('sales.return.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="app-text-muted hover:app-text-muted transition-colors"
          >
            <X size={22} />
          </button>
        </div>
      </OffcanvasHeader>

      <OffcanvasBody>
        <div className="mb-6 p-4 app-bg-muted rounded-lg border app-border">
          <p className="text-sm app-text-muted mb-1">
            <strong>{t('sales.saleClient')}:</strong> {sale.client ? `${sale.client.first_name} ${sale.client.last_name}` : t('sales.client.notFound')}
          </p>
          <p className="text-sm app-text-muted mb-1">
            <strong>{t('sales.saleDescription')}:</strong> {sale.description}
          </p>
          <p className="text-sm app-text-muted">
            <strong>{t('sales.amounts.total')}:</strong> {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MGA' }).format(sale.total_amount)}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
            <AlertCircle className="app-text-danger flex-shrink-0 mt-0.5" size={20} />
            <p className="text-sm app-text-danger">{error}</p>
          </div>
        )}

        <div className="mb-6">
          <h3 className="text-lg font-medium app-text mb-4">
            {t('sales.return.selectItems')}
          </h3>

          {saleItems.length === 0 ? (
            <p className="app-text-muted text-center py-8">
              {t('sales.return.noItems')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="app-table-striped w-full border-collapse">
                <thead>
                  <tr className="app-bg-muted border-b-2 border app-divider">
                    <th className="text-left py-3 px-4 text-sm font-semibold app-text-muted">
                      Nom de l'article
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold app-text-muted">
                      Quantité
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold app-text-muted">
                      Prix unitaire
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold app-text-muted">
                      Quantité à retourner
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold app-text-muted">
                      Montant retour
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {saleItems.map((item) => {
                    const remaining = getRemainingQuantity(item);
                    const returnQty = returnQuantities[item.id] || 0;
                    const canReturn = remaining > 0;
                    const returnAmount = returnQty * item.unit_price;

                    return (
                      <tr
                        key={item.id}
                        className={`border-b border app-divider ${
                          canReturn ? 'hover:bg-[var(--app-surface-muted)]' : 'app-bg-muted'
                        } transition-colors`}
                      >
                        <td className="py-3 px-4">
                          <span className="font-medium app-text">
                            {item.product_name || item.name || 'Article sans nom'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-sm app-text-muted">
                          {item.quantity}
                        </td>
                        <td className="py-3 px-4 text-right text-sm app-text-muted">
                          {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MGA' }).format(item.unit_price)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {canReturn ? (
                            <div className="flex items-center justify-center gap-2">
                              <input
                                type="number"
                                min="0"
                                max={remaining}
                                value={returnQty}
                                onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                onFocus={(e) => e.target.select()}
                                className="w-20 px-2 py-1 border app-border rounded text-sm  text-center"
                                disabled={!canReturn}
                              />
                              <span className="text-xs app-text-muted whitespace-nowrap">/ {remaining}</span>
                            </div>
                          ) : (
                            <span className="px-2 py-1 text-xs app-bg-muted app-text-muted rounded">
                              {t('sales.return.fullyReturned')}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-sm">
                          {returnQty > 0 ? (
                            <span className="app-text-success font-semibold">
                              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MGA' }).format(returnAmount)}
                            </span>
                          ) : (
                            <span className="app-text-muted">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mb-6">
          <label className="app-label mb-2">
            {t('sales.return.notes')} ({t('common.optional')})
          </label>
          <textarea
            value={returnNotes}
            onChange={(e) => setReturnNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border app-border rounded-md "
            placeholder={t('sales.return.notesPlaceholder')}
          />
        </div>

        {getSelectedItemsCount() > 0 && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm app-text-success">
              <strong>{t('sales.return.summary')}:</strong>{' '}
              {getSelectedItemsCount()} {t('sales.return.itemsSelected')} |{' '}
              {getTotalReturnQuantity()} {t('sales.return.totalQuantity')}
            </p>
          </div>
        )}
      </OffcanvasBody>

      <OffcanvasFooter>
        <div className="flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="app-btn app-btn-secondary transition-colors"
            disabled={returning}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleReturn}
            disabled={returning || getSelectedItemsCount() === 0}
            className="app-btn app-btn-danger disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {returning ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>{t('sales.return.processing')}</span>
              </>
            ) : (
              <>
                <RotateCcw size={18} />
                <span>{t('sales.return.confirmReturn')}</span>
              </>
            )}
          </button>
        </div>
      </OffcanvasFooter>
    </Offcanvas>
  );
};


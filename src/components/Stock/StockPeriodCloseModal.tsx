import React, { useMemo, useState } from 'react';
import { AlertTriangle, Archive, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CloseStockPeriodResult, Product, User } from '../../types';
import { Offcanvas, OffcanvasHeader, OffcanvasBody, OffcanvasFooter } from '../ui/Offcanvas';

interface StockPeriodCloseModalProps {
  user: User;
  scope: 'all' | 'selection';
  products: Product[];
  selectedProductIds: string[];
  onClose: () => void;
  onComplete: () => void;
}

export const StockPeriodCloseModal: React.FC<StockPeriodCloseModalProps> = ({
  user,
  scope,
  products,
  selectedProductIds,
  onClose,
  onComplete
}) => {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CloseStockPeriodResult | null>(null);

  const targetProducts = useMemo(() => {
    if (scope === 'all') {
      return products.filter((p) => p.status === 'active');
    }
    const selected = new Set(selectedProductIds);
    return products.filter((p) => selected.has(p.id));
  }, [products, scope, selectedProductIds]);

  const eligibleProducts = targetProducts.filter((p) => p.reserved_stock === 0);
  const reservedProducts = targetProducts.filter((p) => p.reserved_stock > 0);
  const totalStockBefore = eligibleProducts.reduce((sum, p) => sum + (p.current_stock || 0), 0);

  const handleConfirm = async () => {
    if (eligibleProducts.length === 0) {
      setError(
        reservedProducts.length > 0
          ? 'Tous les produits concernés ont un stock réservé et ne peuvent pas être clôturés.'
          : 'Aucun produit à clôturer.'
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('close_stock_period', {
        p_product_ids: scope === 'all' ? null : eligibleProducts.map((p) => p.id),
        p_notes: notes.trim() || null,
        p_closed_by: user.id
      });

      if (rpcError) throw rpcError;

      const payload = data as CloseStockPeriodResult;
      if (!payload?.success) {
        setResult(payload);
        setError(payload?.error || 'La clôture a échoué.');
        return;
      }

      setResult(payload);
      setTimeout(() => {
        onComplete();
      }, 900);
    } catch (err: any) {
      console.error('Erreur clôture de période:', err);
      setError(err?.message || 'Erreur lors de la clôture de période.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Offcanvas onClose={onClose} width="md">
      <OffcanvasHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5 app-text" />
            <h2 className="text-lg font-semibold app-text">Clôturer la période</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--app-surface-muted)] app-text-muted"
            disabled={loading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </OffcanvasHeader>

      <OffcanvasBody className="space-y-4">
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>
            Les quantités seront historisées puis remises à 0. Les mouvements existants sont
            conservés. Cette action n’est pas annulable.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded border app-border p-3">
            <div className="app-text-muted">Portée</div>
            <div className="font-medium app-text">
              {scope === 'all' ? 'Tous les produits actifs' : 'Sélection'}
            </div>
          </div>
          <div className="rounded border app-border p-3">
            <div className="app-text-muted">Produits à clôturer</div>
            <div className="font-medium app-text">{eligibleProducts.length}</div>
          </div>
          <div className="rounded border app-border p-3">
            <div className="app-text-muted">Stock total avant</div>
            <div className="font-medium app-text">{totalStockBefore}</div>
          </div>
          <div className="rounded border app-border p-3">
            <div className="app-text-muted">Exclus (réservés)</div>
            <div className="font-medium app-text">{reservedProducts.length}</div>
          </div>
        </div>

        {reservedProducts.length > 0 && (
          <div className="text-sm app-text">
            <p className="font-medium mb-1">Exclus à cause d’un stock réservé :</p>
            <ul className="max-h-28 overflow-y-auto space-y-1 app-text-muted">
              {reservedProducts.slice(0, 10).map((p) => (
                <li key={p.id}>
                  {p.name} <span className="font-mono app-text-muted">({p.sku})</span> — réservé {p.reserved_stock}
                </li>
              ))}
              {reservedProducts.length > 10 && (
                <li>… et {reservedProducts.length - 10} autre(s)</li>
              )}
            </ul>
          </div>
        )}

        <div>
          <label className="app-label mb-1">Notes (optionnel)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border app-border rounded-md focus:ring-2 focus:ring-[var(--app-primary)] focus:border-transparent text-sm"
            placeholder="Ex. Redémarrage stocks octobre 2026"
            disabled={loading || !!result?.success}
          />
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {result?.success && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            Clôture réussie : {result.closed_count} produit(s), {result.adjustments_count} ajustement(s).
            {(result.excluded?.length || 0) > 0 && (
              <span> {result.excluded!.length} exclu(s) (stock réservé).</span>
            )}
          </div>
        )}
      </OffcanvasBody>

      <OffcanvasFooter>
        <div className="app-actions flex-col-reverse sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="app-btn app-btn-secondary app-btn-sm"
          >
            {result?.success ? 'Fermer' : 'Annuler'}
          </button>
          {!result?.success && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading || eligibleProducts.length === 0}
              className="app-btn app-btn-primary app-btn-sm"
            >
              {loading ? 'Clôture…' : 'Confirmer la clôture'}
            </button>
          )}
        </div>
      </OffcanvasFooter>
    </Offcanvas>
  );
};

import React, { useEffect, useState } from 'react';
import { Archive, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { StockPeriodClosure, StockPeriodClosureItem } from '../../types';
import { DataTable, dtTh, dtThRight, dtTd, dtTdMuted, dtTdWrap } from '../ui/DataTable';
import { formatDateTimeDisplay } from '../../lib/dateUtils';

export const StockPeriodClosuresList: React.FC = () => {
  const [closures, setClosures] = useState<StockPeriodClosure[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsByClosure, setItemsByClosure] = useState<Record<string, StockPeriodClosureItem[]>>({});
  const [loadingItems, setLoadingItems] = useState<string | null>(null);

  useEffect(() => {
    fetchClosures();
  }, []);

  const fetchClosures = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stock_period_closures')
        .select('*')
        .order('closed_at', { ascending: false });

      if (error) throw error;
      setClosures((data as StockPeriodClosure[]) || []);
    } catch (error) {
      console.error('Erreur chargement clôtures:', error);
      setClosures([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleDetails = async (closureId: string) => {
    if (expandedId === closureId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(closureId);

    if (itemsByClosure[closureId]) return;

    try {
      setLoadingItems(closureId);
      const { data, error } = await supabase
        .from('stock_period_closure_items')
        .select(`
          *,
          product:products(id, name, sku)
        `)
        .eq('closure_id', closureId)
        .order('stock_before', { ascending: false });

      if (error) throw error;
      setItemsByClosure((prev) => ({
        ...prev,
        [closureId]: (data as StockPeriodClosureItem[]) || []
      }));
    } catch (error) {
      console.error('Erreur chargement détail clôture:', error);
      setItemsByClosure((prev) => ({ ...prev, [closureId]: [] }));
    } finally {
      setLoadingItems(null);
    }
  };

  if (loading) {
    return (
      <div className="app-surface p-6 text-center text-sm app-text-muted">
        Chargement des clôtures…
      </div>
    );
  }

  const renderItems = (closureId: string, items: StockPeriodClosureItem[]) => {
    if (loadingItems === closureId) {
      return <p className="text-sm app-text-muted">Chargement…</p>;
    }
    if (items.length === 0) {
      return <p className="text-sm app-text-muted">Aucun produit dans ce snapshot.</p>;
    }

    return (
      <>
        {/* Mobile item cards */}
        <div className="md:hidden space-y-2">
          {items.map((item) => (
            <div key={item.id} className="app-list-card py-2.5 space-y-1">
              <div className="text-sm font-medium app-text">
                {item.product?.name || item.product_id}
              </div>
              {item.product?.sku && (
                <div className="text-[11px] font-mono app-text-muted">{item.product.sku}</div>
              )}
              <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                <div>
                  <div className="app-text-muted">Avant</div>
                  <div className="font-medium app-text">{item.stock_before}</div>
                </div>
                <div>
                  <div className="app-text-muted">Réservé</div>
                  <div className="app-text">{item.reserved_before}</div>
                </div>
                <div>
                  <div className="app-text-muted">Min</div>
                  <div className="app-text">{item.min_stock_level_before}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block border app-border rounded-md overflow-hidden">
          <DataTable maxHeightClass="max-h-80">
            <thead className="app-bg-muted">
              <tr>
                <th className={dtTh}>Produit</th>
                <th className={dtThRight}>Stock avant</th>
                <th className={dtThRight}>Réservé</th>
                <th className={dtThRight}>Min</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--app-border)]">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className={dtTdWrap}>
                    {item.product?.name || item.product_id}
                    {item.product?.sku && (
                      <span className="ml-1 font-mono text-[11px] app-text-muted">
                        {item.product.sku}
                      </span>
                    )}
                  </td>
                  <td className={`${dtTd} text-right`}>{item.stock_before}</td>
                  <td className={`${dtTdMuted} text-right`}>{item.reserved_before}</td>
                  <td className={`${dtTdMuted} text-right`}>{item.min_stock_level_before}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      </>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Archive className="h-4 w-4 app-text-muted" />
        <h2 className="text-base font-semibold app-text">Historique des clôtures de période</h2>
      </div>

      {closures.length === 0 ? (
        <div className="app-empty">
          <p className="app-empty-text">Aucune clôture de période pour le moment.</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {closures.map((closure) => {
              const expanded = expandedId === closure.id;
              const items = itemsByClosure[closure.id] || [];

              return (
                <div key={closure.id} className="app-list-card space-y-3">
                  <div>
                    <div className="text-sm font-medium app-text">
                      {formatDateTimeDisplay(closure.closed_at)}
                    </div>
                    <div className="text-xs mt-1 app-text-muted space-y-0.5">
                      <div>
                        {closure.scope === 'all' ? 'Tous les actifs' : 'Sélection'}
                      </div>
                      <div>
                        {closure.product_count} produit(s) · stock avant {closure.total_stock_before}
                      </div>
                      {closure.notes && <div className="truncate">{closure.notes}</div>}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleDetails(closure.id)}
                    className="app-btn app-btn-secondary w-full min-h-[44px]"
                  >
                    {expanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <Eye className="h-4 w-4" />
                    {expanded ? 'Masquer le détail' : 'Voir le détail'}
                  </button>

                  {expanded && <div className="pt-1">{renderItems(closure.id, items)}</div>}
                </div>
              );
            })}
          </div>

          {/* Desktop accordion list */}
          <div className="hidden md:block app-table-wrap">
            <div className="divide-y divide-[var(--app-border)]">
              {closures.map((closure) => {
                const expanded = expandedId === closure.id;
                const items = itemsByClosure[closure.id] || [];

                return (
                  <div key={closure.id}>
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium app-text">
                          {formatDateTimeDisplay(closure.closed_at)}
                        </div>
                        <div className="text-xs mt-0.5 app-text-muted truncate">
                          {closure.scope === 'all' ? 'Tous les actifs' : 'Sélection'} ·{' '}
                          {closure.product_count} produit(s) · stock avant {closure.total_stock_before}
                          {closure.notes ? ` · ${closure.notes}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleDetails(closure.id)}
                        className="app-btn app-btn-ghost app-btn-sm app-text-link flex-shrink-0"
                      >
                        {expanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <Eye className="h-4 w-4" />
                        Détail
                      </button>
                    </div>

                    {expanded && (
                      <div className="px-4 pb-4">{renderItems(closure.id, items)}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

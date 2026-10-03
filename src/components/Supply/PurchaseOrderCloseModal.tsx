import React, { useMemo, useState } from 'react';
import { AlertTriangle, Archive, PackageCheck, X, XCircle, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { PurchaseOrder, PurchaseOrderItem, User } from '../../types';
import { Offcanvas, OffcanvasHeader, OffcanvasBody, OffcanvasFooter } from '../ui/Offcanvas';

export type ClosePurchaseOrderMode = 'short_close' | 'cancel' | 'receive' | 'auto';

interface CloseResult {
  success: boolean;
  error?: string;
  mode?: string;
  status?: string;
  items_adjusted?: number;
  items_removed?: number;
  note?: string;
}

function getOrderQty(order: PurchaseOrder, itemsOverride?: PurchaseOrderItem[]) {
  const items = itemsOverride || order.purchase_order_items || [];
  const ordered = items.reduce((s, i) => s + (i.quantity_ordered || 0), 0);
  const received = items.reduce((s, i) => s + (i.quantity_received || 0), 0);
  const open = Math.max(0, ordered - received);
  const zeroReceivedLines = items.filter((i) => (i.quantity_received || 0) === 0).length;
  const partialLines = items.filter(
    (i) => (i.quantity_received || 0) > 0 && i.quantity_received < i.quantity_ordered
  ).length;
  return { ordered, received, open, zeroReceivedLines, partialLines, items };
}

interface PurchaseOrderCloseModalProps {
  /** Une commande (mode unitaire) */
  order?: PurchaseOrder;
  items?: PurchaseOrderItem[];
  /** Plusieurs commandes (mode masse) */
  orders?: PurchaseOrder[];
  user: User;
  onClose: () => void;
  onComplete: () => void;
  onReceiveRemaining?: () => void;
}

export const PurchaseOrderCloseModal: React.FC<PurchaseOrderCloseModalProps> = ({
  order,
  items: itemsProp,
  orders: ordersProp,
  user,
  onClose,
  onComplete,
  onReceiveRemaining
}) => {
  const { t } = useTranslation();
  const orders = useMemo(() => {
    if (ordersProp && ordersProp.length > 0) return ordersProp;
    return order ? [order] : [];
  }, [order, ordersProp]);
  const isBulk = orders.length > 1;

  const singleOrder = !isBulk && orders.length === 1 ? orders[0] : null;
  const singleItems = singleOrder
    ? itemsProp || singleOrder.purchase_order_items || []
    : [];

  const [mode, setMode] = useState<ClosePurchaseOrderMode | null>(isBulk ? 'auto' : null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const singleSummary = useMemo(
    () => (singleOrder ? getOrderQty(singleOrder, singleItems) : null),
    [singleOrder, singleItems]
  );

  const bulkSummary = useMemo(() => {
    let cancelable = 0;
    let shortCloseable = 0;
    let skipped = 0;
    for (const o of orders) {
      const q = getOrderQty(o);
      const closable =
        (o.status === 'ordered' || o.status === 'partial' || o.status === 'pending') && !o.closed_at;
      if (!closable) {
        skipped += 1;
        continue;
      }
      if (q.received === 0) cancelable += 1;
      else if (q.open > 0) shortCloseable += 1;
      else skipped += 1;
    }
    return { cancelable, shortCloseable, skipped, total: orders.length };
  }, [orders]);

  const canCancel = singleSummary ? singleSummary.received === 0 : bulkSummary.cancelable > 0;
  const canShortClose = singleSummary
    ? singleSummary.received > 0 && singleSummary.open > 0
    : bulkSummary.shortCloseable > 0;
  const canReceive =
    !!singleOrder &&
    !!onReceiveRemaining &&
    (singleOrder.status === 'ordered' || singleOrder.status === 'partial') &&
    (singleSummary?.open || 0) > 0;

  const resolveModeForOrder = (
    o: PurchaseOrder,
    chosen: ClosePurchaseOrderMode
  ): 'short_close' | 'cancel' | null => {
    const q = getOrderQty(o, o === singleOrder ? singleItems : undefined);
    const closable =
      (o.status === 'ordered' || o.status === 'partial' || o.status === 'pending') && !o.closed_at;
    if (!closable) return null;

    if (chosen === 'auto') {
      if (q.received === 0) return 'cancel';
      if (q.open > 0) return 'short_close';
      return null;
    }
    if (chosen === 'cancel') return q.received === 0 ? 'cancel' : null;
    if (chosen === 'short_close') return q.received > 0 && q.open > 0 ? 'short_close' : null;
    return null;
  };

  const handleConfirm = async () => {
    if (!mode || mode === 'receive') return;

    if (!reason.trim()) {
      setError(t('supply.close.reasonRequired'));
      return;
    }

    setLoading(true);
    setError(null);
    setProgress(null);

    try {
      let ok = 0;
      let failed = 0;
      const errors: string[] = [];

      for (let i = 0; i < orders.length; i++) {
        const o = orders[i];
        const rpcMode = resolveModeForOrder(o, mode);
        if (!rpcMode) {
          failed += 1;
          errors.push(`${o.order_number}: ${t('supply.close.skippedIneligible')}`);
          continue;
        }

        if (isBulk) {
          setProgress(`${i + 1}/${orders.length} — ${o.order_number}`);
        }

        const { data, error: rpcError } = await supabase.rpc('close_purchase_order', {
          p_order_id: o.id,
          p_mode: rpcMode,
          p_reason: reason.trim(),
          p_closed_by: user.id
        });

        if (rpcError) {
          failed += 1;
          errors.push(`${o.order_number}: ${rpcError.message}`);
          continue;
        }

        const result = data as CloseResult;
        if (!result?.success) {
          failed += 1;
          errors.push(`${o.order_number}: ${result?.error || t('supply.close.failed')}`);
          continue;
        }
        ok += 1;
      }

      if (ok === 0) {
        setError(errors.slice(0, 5).join('\n') || t('supply.close.failed'));
        return;
      }

      if (failed > 0) {
        setError(
          t('supply.close.bulkPartial', { ok, failed }) +
            (errors.length ? `\n${errors.slice(0, 5).join('\n')}` : '')
        );
        // Still complete so list refreshes
        setTimeout(() => onComplete(), 1200);
        return;
      }

      onComplete();
    } catch (err: any) {
      console.error('Erreur clôture commande:', err);
      setError(err?.message || t('supply.close.failed'));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const handleReceive = () => {
    onClose();
    onReceiveRemaining?.();
  };

  const titleSuffix = isBulk
    ? t('supply.close.bulkCount', { count: orders.length })
    : singleOrder?.order_number;

  return (
    <Offcanvas onClose={onClose} width="md" panelZ={90} backdropZ={85}>
      <OffcanvasHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Archive className="h-5 w-5 app-text-muted flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold app-text truncate">
                {isBulk ? t('supply.close.bulkTitle') : t('supply.close.title')}
              </h2>
              <p className="text-xs app-text-muted truncate">{titleSuffix}</p>
            </div>
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
        {singleSummary && !isBulk && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded border app-border p-2">
              <div className="app-text-muted">{t('supply.quantityOrdered')}</div>
              <div className="font-semibold app-text">{singleSummary.ordered}</div>
            </div>
            <div className="rounded border app-border p-2">
              <div className="app-text-muted">{t('supply.quantityReceived')}</div>
              <div className="font-semibold app-text">{singleSummary.received}</div>
            </div>
            <div className="rounded border app-border p-2">
              <div className="app-text-muted">{t('supply.remainingQuantity')}</div>
              <div className="font-semibold text-amber-700">{singleSummary.open}</div>
            </div>
          </div>
        )}

        {isBulk && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded border app-border p-2">
              <div className="app-text-muted">{t('supply.close.bulkCancelable')}</div>
              <div className="font-semibold app-text">{bulkSummary.cancelable}</div>
            </div>
            <div className="rounded border app-border p-2">
              <div className="app-text-muted">{t('supply.close.bulkShortCloseable')}</div>
              <div className="font-semibold app-text">{bulkSummary.shortCloseable}</div>
            </div>
            <div className="rounded border app-border p-2">
              <div className="app-text-muted">{t('supply.close.bulkSkipped')}</div>
              <div className="font-semibold app-text-muted">{bulkSummary.skipped}</div>
            </div>
          </div>
        )}

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>{isBulk ? t('supply.close.bulkHint') : t('supply.close.hint')}</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium app-text-muted">{t('supply.close.chooseAction')}</p>

          {isBulk && (
            <button
              type="button"
              onClick={() => setMode('auto')}
              className={`w-full text-left rounded-md border px-3 py-2.5 transition-colors ${
                mode === 'auto' ? 'border-[var(--app-ink)] app-bg-muted' : 'border app-border hover:bg-[var(--app-surface-muted)]'
              }`}
            >
              <div className="flex items-start gap-2">
                <Layers className="h-4 w-4 app-text-muted mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium app-text">
                    {t('supply.close.auto')}
                  </div>
                  <div className="text-xs app-text-muted mt-0.5">
                    {t('supply.close.autoHelp')}
                  </div>
                </div>
              </div>
            </button>
          )}

          {canReceive && (
            <button
              type="button"
              onClick={() => setMode('receive')}
              className={`w-full text-left rounded-md border px-3 py-2.5 transition-colors ${
                mode === 'receive'
                  ? 'border-green-500 bg-green-50'
                  : 'border app-border hover:bg-[var(--app-surface-muted)]'
              }`}
            >
              <div className="flex items-start gap-2">
                <PackageCheck className="h-4 w-4 app-text-success mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium app-text">
                    {t('supply.close.receiveRemaining')}
                  </div>
                  <div className="text-xs app-text-muted mt-0.5">
                    {t('supply.close.receiveRemainingHelp')}
                  </div>
                </div>
              </div>
            </button>
          )}

          {canShortClose && (
            <button
              type="button"
              onClick={() => setMode('short_close')}
              className={`w-full text-left rounded-md border px-3 py-2.5 transition-colors ${
                mode === 'short_close'
                  ? 'border-[var(--app-primary)] bg-[color-mix(in_srgb,var(--app-primary)_10%,var(--app-surface))]'
                  : 'border app-border hover:bg-[var(--app-surface-muted)]'
              }`}
            >
              <div className="flex items-start gap-2">
                <Archive className="h-4 w-4 app-text-link mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium app-text">
                    {t('supply.close.shortClose')}
                    {isBulk ? ` (${bulkSummary.shortCloseable})` : ''}
                  </div>
                  <div className="text-xs app-text-muted mt-0.5">
                    {isBulk
                      ? t('supply.close.shortCloseBulkHelp')
                      : t('supply.close.shortCloseHelp', {
                          adjusted: singleSummary?.partialLines || 0,
                          removed: singleSummary?.zeroReceivedLines || 0
                        })}
                  </div>
                </div>
              </div>
            </button>
          )}

          {canCancel && (
            <button
              type="button"
              onClick={() => setMode('cancel')}
              className={`w-full text-left rounded-md border px-3 py-2.5 transition-colors ${
                mode === 'cancel'
                  ? 'border-red-500 bg-red-50'
                  : 'border app-border hover:bg-[var(--app-surface-muted)]'
              }`}
            >
              <div className="flex items-start gap-2">
                <XCircle className="h-4 w-4 app-text-danger mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium app-text">
                    {t('supply.close.cancel')}
                    {isBulk ? ` (${bulkSummary.cancelable})` : ''}
                  </div>
                  <div className="text-xs app-text-muted mt-0.5">
                    {isBulk ? t('supply.close.cancelBulkHelp') : t('supply.close.cancelHelp')}
                  </div>
                </div>
              </div>
            </button>
          )}

          {!canCancel && !canShortClose && !canReceive && !isBulk && (
            <p className="text-sm app-text-muted">{t('supply.close.nothingToDo')}</p>
          )}
        </div>

        {(mode === 'short_close' || mode === 'cancel' || mode === 'auto') && (
          <div>
            <label className="block text-sm font-medium app-text-muted mb-1">
              {t('supply.close.reason')} *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="app-input text-sm"
              placeholder={t('supply.close.reasonPlaceholder')}
              disabled={loading}
            />
          </div>
        )}

        {progress && (
          <p className="text-xs app-text-muted">{progress}</p>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 whitespace-pre-wrap">
            {error}
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
            {t('app.cancel')}
          </button>
          {mode === 'receive' ? (
            <button
              type="button"
              onClick={handleReceive}
              className="app-btn app-btn-success app-btn-sm"
            >
              {t('supply.createReceipt')}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={
                loading ||
                !mode ||
                mode === 'receive' ||
                !reason.trim() ||
                (isBulk &&
                  bulkSummary.cancelable + bulkSummary.shortCloseable === 0)
              }
              className={`app-btn app-btn-sm disabled:opacity-50 ${
                mode === 'cancel' ? 'app-btn-danger' : 'app-btn-primary'
              }`}
            >
              {loading
                ? t('app.saving')
                : isBulk
                  ? t('supply.close.confirmBulk', { count: orders.length })
                  : t('supply.close.confirm')}
            </button>
          )}
        </div>
      </OffcanvasFooter>
    </Offcanvas>
  );
};

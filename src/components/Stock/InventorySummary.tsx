import React from 'react';
import { Inventory } from '../../types';
import { Package, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { formatDateTimeDisplay } from '../../lib/dateUtils';

interface InventorySummaryProps {
  inventory: Inventory;
}

export const InventorySummary: React.FC<InventorySummaryProps> = ({ inventory }) => {
  const progressPercentage = inventory.total_products > 0
    ? Math.round((inventory.counted_products / inventory.total_products) * 100)
    : 0;

  const getStatusColor = () => {
    switch (inventory.status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress':
        return 'app-badge-info border-[color-mix(in_srgb,var(--app-primary)_30%,var(--app-border))]';
      case 'draft':
        return 'app-badge border-[var(--app-border)]';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'app-badge border-[var(--app-border)]';
    }
  };

  const getStatusLabel = () => {
    switch (inventory.status) {
      case 'completed':
        return 'Terminé';
      case 'in_progress':
        return 'En cours';
      case 'draft':
        return 'Brouillon';
      case 'cancelled':
        return 'Annulé';
      default:
        return inventory.status;
    }
  };

  return (
    <div className="app-surface p-4 mb-4">
      <div className="flex items-start justify-between gap-4">
        {/* Colonne principale avec les métriques */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold app-text">Résumé de l'inventaire</h2>
            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor()}`}>
              {getStatusLabel()}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            {/* Total produits */}
            <div className="app-bg-muted rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs app-text-muted">Total produits</p>
                  <p className="text-xl font-bold app-text">{inventory.total_products}</p>
                </div>
                <Package className="h-6 w-6 app-text-muted" />
              </div>
            </div>

            {/* Produits comptés */}
            <div className="app-badge-info rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs app-text-link">Produits comptés</p>
                  <p className="text-xl font-bold app-text-link">{inventory.counted_products}</p>
                </div>
                <CheckCircle className="h-6 w-6 app-text-link opacity-80" />
              </div>
            </div>

            {/* Produits avec écarts */}
            <div className="bg-orange-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-orange-600">Avec écarts</p>
                  <p className="text-xl font-bold text-orange-900">{inventory.total_discrepancies}</p>
                </div>
                <AlertTriangle className="h-6 w-6 text-orange-400" />
              </div>
            </div>

            {/* Progression */}
            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-600">Progression</p>
                  <p className="text-xl font-bold text-green-900">{progressPercentage}%</p>
                </div>
                {progressPercentage === 100 ? (
                  <CheckCircle className="h-6 w-6 text-green-400" />
                ) : (
                  <TrendingUp className="h-6 w-6 text-green-400" />
                )}
              </div>
            </div>
          </div>

          {/* Barre de progression */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="app-label">Avancement du comptage</span>
              <span className="text-xs app-text-muted">
                {inventory.counted_products} / {inventory.total_products}
              </span>
            </div>
            <div className="w-full bg-[var(--app-border)] rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  progressPercentage === 100 ? 'bg-[var(--app-success)]' : 'bg-[var(--app-primary)]'
                }`}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Colonne droite avec date et notes */}
        <div className="flex-shrink-0 w-48 space-y-3 pt-7">
          {inventory.completed_at && (
            <div>
              <p className="text-xs app-text-muted mb-1">Date de finalisation</p>
              <p className="text-sm font-medium app-text">
                {formatDateTimeDisplay(inventory.completed_at)}
              </p>
            </div>
          )}
          {inventory.notes && (
            <div>
              <p className="text-xs app-text-muted mb-1">Notes</p>
              <p className="text-sm font-medium app-text uppercase">{inventory.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


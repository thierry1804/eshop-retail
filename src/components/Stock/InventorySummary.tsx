import React from 'react';
import { Inventory } from '../../types';
import { Package, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';

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
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
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
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex items-start justify-between gap-4">
        {/* Colonne principale avec les métriques */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">Résumé de l'inventaire</h2>
            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor()}`}>
              {getStatusLabel()}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            {/* Total produits */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600">Total produits</p>
                  <p className="text-xl font-bold text-gray-900">{inventory.total_products}</p>
                </div>
                <Package className="h-6 w-6 text-gray-400" />
              </div>
            </div>

            {/* Produits comptés */}
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600">Produits comptés</p>
                  <p className="text-xl font-bold text-blue-900">{inventory.counted_products}</p>
                </div>
                <CheckCircle className="h-6 w-6 text-blue-400" />
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
              <span className="text-xs font-medium text-gray-700">Avancement du comptage</span>
              <span className="text-xs text-gray-600">
                {inventory.counted_products} / {inventory.total_products}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  progressPercentage === 100 ? 'bg-green-600' : 'bg-blue-600'
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
              <p className="text-xs text-gray-600 mb-1">Date de finalisation</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(inventory.completed_at).toLocaleDateString('fr-FR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          )}
          {inventory.notes && (
            <div>
              <p className="text-xs text-gray-600 mb-1">Notes</p>
              <p className="text-sm font-medium text-gray-900 uppercase">{inventory.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


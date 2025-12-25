import React from 'react';
import { Inventory } from '../../types';
import { Package, CheckCircle, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

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
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Résumé de l'inventaire</h2>
        <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor()}`}>
          {getStatusLabel()}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Total produits */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total produits</p>
              <p className="text-2xl font-bold text-gray-900">{inventory.total_products}</p>
            </div>
            <Package className="h-8 w-8 text-gray-400" />
          </div>
        </div>

        {/* Produits comptés */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600">Produits comptés</p>
              <p className="text-2xl font-bold text-blue-900">{inventory.counted_products}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-blue-400" />
          </div>
        </div>

        {/* Produits avec écarts */}
        <div className="bg-orange-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600">Avec écarts</p>
              <p className="text-2xl font-bold text-orange-900">{inventory.total_discrepancies}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-orange-400" />
          </div>
        </div>

        {/* Progression */}
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600">Progression</p>
              <p className="text-2xl font-bold text-green-900">{progressPercentage}%</p>
            </div>
            {progressPercentage === 100 ? (
              <CheckCircle className="h-8 w-8 text-green-400" />
            ) : (
              <TrendingUp className="h-8 w-8 text-green-400" />
            )}
          </div>
        </div>
      </div>

      {/* Barre de progression */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Avancement du comptage</span>
          <span className="text-sm text-gray-600">
            {inventory.counted_products} / {inventory.total_products}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-300 ${
              progressPercentage === 100 ? 'bg-green-600' : 'bg-blue-600'
            }`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Informations supplémentaires */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
        <div>
          <p className="text-sm text-gray-600">Date de l'inventaire</p>
          <p className="text-sm font-medium text-gray-900">
            {new Date(inventory.inventory_date).toLocaleDateString('fr-FR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
        {inventory.completed_at && (
          <div>
            <p className="text-sm text-gray-600">Date de finalisation</p>
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
          <div className="md:col-span-2">
            <p className="text-sm text-gray-600">Notes</p>
            <p className="text-sm text-gray-900">{inventory.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
};


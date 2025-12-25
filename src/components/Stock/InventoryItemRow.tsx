import React, { useState, useEffect } from 'react';
import { InventoryItem, Product, User } from '../../types';
import { Package, AlertCircle, CheckCircle } from 'lucide-react';

interface InventoryItemRowProps {
  item: InventoryItem;
  product: Product;
  user: User;
  onUpdate: (itemId: string, actualQuantity: number, notes?: string) => Promise<void>;
  disabled?: boolean;
}

export const InventoryItemRow: React.FC<InventoryItemRowProps> = ({
  item,
  product,
  user,
  onUpdate,
  disabled = false
}) => {
  const [actualQuantity, setActualQuantity] = useState<string>(
    item.actual_quantity !== null && item.actual_quantity !== undefined 
      ? item.actual_quantity.toString() 
      : ''
  );
  const [notes, setNotes] = useState<string>(item.notes || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Mettre à jour les valeurs si l'item change
  useEffect(() => {
    setActualQuantity(
      item.actual_quantity !== null && item.actual_quantity !== undefined 
        ? item.actual_quantity.toString() 
        : ''
    );
    setNotes(item.notes || '');
  }, [item.actual_quantity, item.notes]);

  const handleQuantityChange = async (value: string) => {
    const numValue = value === '' ? null : parseInt(value, 10);
    
    // Validation : nombre positif ou vide
    if (value !== '' && (isNaN(numValue!) || numValue! < 0)) {
      return;
    }

    setActualQuantity(value);

    // Sauvegarder automatiquement après 500ms de pause
    if (value === '' || numValue !== null) {
      setIsUpdating(true);
      try {
        await onUpdate(item.id, numValue || 0, notes);
        setLastSaved(new Date());
      } catch (error) {
        console.error('Erreur lors de la mise à jour:', error);
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const handleNotesChange = async (value: string) => {
    setNotes(value);
    // Sauvegarder les notes si une quantité est déjà saisie
    if (actualQuantity !== '') {
      setIsUpdating(true);
      try {
        await onUpdate(item.id, parseInt(actualQuantity, 10), value);
        setLastSaved(new Date());
      } catch (error) {
        console.error('Erreur lors de la mise à jour des notes:', error);
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const discrepancy = item.discrepancy || 0;
  const hasDiscrepancy = discrepancy !== 0;
  const isCounted = item.actual_quantity !== null && item.actual_quantity !== undefined;

  return (
    <tr className={`hover:bg-gray-50 ${disabled ? 'opacity-50' : ''} ${isCounted ? 'bg-green-50' : ''}`}>
      {/* Produit */}
      <td className="px-4 py-3">
        <div className="flex items-center">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-10 w-10 object-cover rounded-md border border-gray-300 mr-3 flex-shrink-0"
            />
          ) : (
            <div className="h-10 w-10 bg-gray-100 rounded-md border border-gray-300 flex items-center justify-center mr-3 flex-shrink-0">
              <Package className="h-6 w-6 text-gray-400" />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{product.name}</div>
            <div className="text-xs text-gray-500">
              {product.category?.name || 'Sans catégorie'} • <span className="font-mono">{product.sku}</span>
            </div>
          </div>
        </div>
      </td>

      {/* Stock théorique */}
      <td className="px-4 py-3">
        <div className="text-sm text-gray-900 font-medium">
          {item.theoretical_quantity}
        </div>
      </td>

      {/* Quantité réelle */}
      <td className="px-4 py-3">
        <div className="relative">
          <input
            type="number"
            min="0"
            value={actualQuantity}
            onChange={(e) => handleQuantityChange(e.target.value)}
            onBlur={(e) => {
              if (e.target.value === '') {
                handleQuantityChange('0');
              }
            }}
            disabled={disabled || isUpdating}
            className={`w-24 px-3 py-2 border rounded-md text-sm ${
              hasDiscrepancy && isCounted
                ? discrepancy > 0
                  ? 'border-green-500 bg-green-50'
                  : 'border-red-500 bg-red-50'
                : 'border-gray-300'
            } ${disabled || isUpdating ? 'bg-gray-100 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500'}`}
            placeholder="0"
          />
          {isUpdating && (
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            </div>
          )}
        </div>
      </td>

      {/* Écart */}
      <td className="px-4 py-3">
        {isCounted ? (
          <div className={`flex items-center text-sm font-medium ${
            discrepancy > 0 
              ? 'text-green-600' 
              : discrepancy < 0 
                ? 'text-red-600' 
                : 'text-gray-600'
          }`}>
            {discrepancy > 0 && <span className="mr-1">+</span>}
            {discrepancy}
            {hasDiscrepancy && (
              <span className="ml-2">
                {discrepancy > 0 ? (
                  <AlertCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
              </span>
            )}
            {!hasDiscrepancy && (
              <CheckCircle className="h-4 w-4 text-green-600 ml-2" />
            )}
          </div>
        ) : (
          <span className="text-sm text-gray-400">-</span>
        )}
      </td>

      {/* Notes */}
      <td className="px-4 py-3">
        <input
          type="text"
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          disabled={disabled || isUpdating}
          placeholder="Notes..."
          className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm ${
            disabled || isUpdating ? 'bg-gray-100 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500'
          }`}
        />
      </td>

      {/* Statut */}
      <td className="px-4 py-3">
        {isCounted ? (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Compté
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            En attente
          </span>
        )}
        {lastSaved && (
          <div className="text-xs text-gray-400 mt-1">
            Sauvegardé {lastSaved.toLocaleTimeString()}
          </div>
        )}
      </td>
    </tr>
  );
};


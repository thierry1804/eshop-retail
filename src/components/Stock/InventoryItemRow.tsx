import React, { useState, useEffect } from 'react';
import { InventoryItem, Product, User } from '../../types';
import { Package, AlertCircle, CheckCircle } from 'lucide-react';
import { formatDateTimeDisplay } from '../../lib/dateUtils';

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

  // Fonction pour mettre à jour l'état local uniquement (sans sauvegarder)
  const handleQuantityInputChange = (value: string) => {
    // Validation : nombre positif ou vide
    if (value !== '' && (isNaN(parseInt(value, 10)) || parseInt(value, 10) < 0)) {
      return;
    }
    setActualQuantity(value);
  };

  // Fonction pour sauvegarder la quantité (appelée sur onBlur)
  const handleQuantityBlur = async () => {
    const numValue = actualQuantity === '' ? null : parseInt(actualQuantity, 10);
    const valueToSave = numValue === null || isNaN(numValue) ? 0 : numValue;
    
    // Si la valeur a changé, sauvegarder
    const currentValue = item.actual_quantity !== null && item.actual_quantity !== undefined ? item.actual_quantity : null;
    if (valueToSave !== currentValue) {
      setIsUpdating(true);
      try {
        await onUpdate(item.id, valueToSave, notes);
        setLastSaved(new Date());
      } catch (error) {
        console.error('Erreur lors de la mise à jour:', error);
      } finally {
        setIsUpdating(false);
      }
    }
  };

  // Fonction pour mettre à jour l'état local des notes uniquement (sans sauvegarder)
  const handleNotesInputChange = (value: string) => {
    setNotes(value);
  };

  // Fonction pour sauvegarder les notes (appelée sur onBlur)
  const handleNotesBlur = async () => {
    // Si les notes ont changé, sauvegarder
    const currentNotes = item.notes || '';
    if (notes !== currentNotes) {
      const quantityToSave = actualQuantity === '' ? 0 : (parseInt(actualQuantity, 10) || 0);
      setIsUpdating(true);
      try {
        await onUpdate(item.id, quantityToSave, notes);
        setLastSaved(new Date());
      } catch (error) {
        console.error('Erreur lors de la mise à jour des notes:', error);
      } finally {
        setIsUpdating(false);
      }
    }
  };

  // Calculer l'écart basé sur la valeur actuelle (saisie ou sauvegardée)
  const currentQuantity = actualQuantity === '' ? null : parseInt(actualQuantity, 10);
  const calculatedDiscrepancy = currentQuantity !== null && !isNaN(currentQuantity) 
    ? currentQuantity - item.theoretical_quantity 
    : (item.discrepancy || 0);
  const discrepancy = calculatedDiscrepancy;
  const hasDiscrepancy = discrepancy !== 0;
  const isCounted = currentQuantity !== null && !isNaN(currentQuantity);

  return (
    <tr className={`hover:bg-[var(--app-surface-muted)] ${disabled ? 'opacity-50' : ''} ${isCounted ? 'bg-green-50' : ''}`}>
      {/* Produit */}
      <td className="px-4 py-3">
        <div className="flex items-center">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-10 w-10 object-cover rounded-md border app-border mr-3 flex-shrink-0"
            />
          ) : (
            <div className="h-10 w-10 app-bg-muted rounded-md border app-border flex items-center justify-center mr-3 flex-shrink-0">
              <Package className="h-6 w-6 app-text-muted" />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium app-text truncate">{product.name}</div>
            <div className="text-xs app-text-muted">
              {product.category?.name || 'Sans catégorie'} • <span className="font-mono">{product.sku}</span>
            </div>
          </div>
        </div>
      </td>

      {/* Stock théorique */}
      <td className="px-4 py-3">
        <div className="text-sm app-text font-medium">
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
            onChange={(e) => handleQuantityInputChange(e.target.value)}
            onBlur={handleQuantityBlur}
            disabled={disabled || isUpdating}
            className={`w-24 px-3 py-2 border rounded-md text-sm ${
              hasDiscrepancy && isCounted
                ? discrepancy > 0
                  ? 'border-green-500 bg-green-50'
                  : 'border-red-500 bg-red-50'
                : 'border-[var(--app-border)]'
            } ${disabled || isUpdating ? 'app-bg-muted cursor-not-allowed' : 'focus:ring-2 focus:ring-[var(--app-primary)]'}`}
            placeholder="0"
          />
          {isUpdating && (
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--app-primary)]"></div>
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
                : 'app-text-muted'
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
          <span className="text-sm app-text-muted">-</span>
        )}
      </td>

      {/* Notes */}
      <td className="px-4 py-3">
        <input
          type="text"
          value={notes}
          onChange={(e) => handleNotesInputChange(e.target.value)}
          onBlur={handleNotesBlur}
          disabled={disabled || isUpdating}
          placeholder="Notes..."
          className={`w-full px-3 py-2 border app-border rounded-md text-sm ${
            disabled || isUpdating ? 'app-bg-muted cursor-not-allowed' : 'focus:ring-2 focus:ring-[var(--app-primary)]'
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
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium app-badge">
            En attente
          </span>
        )}
        {lastSaved && (
          <div className="text-xs app-text-muted mt-1">
            Sauvegardé {formatDateTimeDisplay(lastSaved)}
          </div>
        )}
      </td>
    </tr>
  );
};


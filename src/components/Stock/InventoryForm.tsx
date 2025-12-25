import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { User } from '../../types';
import { X, Calendar, FileText } from 'lucide-react';
import { logger } from '../../lib/logger';

interface InventoryFormProps {
  user: User;
  onClose: () => void;
  onSuccess: (inventoryId: string) => void;
}

export const InventoryForm: React.FC<InventoryFormProps> = ({ user, onClose, onSuccess }) => {
  const [inventoryDate, setInventoryDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Appeler la fonction SQL pour créer l'inventaire avec tous les produits
      const { data, error: functionError } = await supabase.rpc(
        'create_inventory_with_all_products',
        {
          p_inventory_date: inventoryDate,
          p_created_by: user.id,
          p_notes: notes || null
        }
      );

      if (functionError) {
        throw functionError;
      }

      if (!data) {
        throw new Error('Aucun ID d\'inventaire retourné');
      }

      // Logger l'action
      await logger.log('INVENTORY_CREATED', {
        component: 'InventoryForm',
        inventory_id: data,
        inventory_date: inventoryDate,
        notes: notes || null,
        user_id: user.id,
        user_email: user.email
      });

      onSuccess(data);
      onClose();
    } catch (err: any) {
      console.error('Erreur lors de la création de l\'inventaire:', err);
      setError(err.message || 'Erreur lors de la création de l\'inventaire');
      
      await logger.logError(err as Error, 'InventoryForm');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Nouvel inventaire</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Date de l'inventaire */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="h-4 w-4 inline mr-2" />
              Date de l'inventaire
            </label>
            <input
              type="date"
              value={inventoryDate}
              onChange={(e) => setInventoryDate(e.target.value)}
              required
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="h-4 w-4 inline mr-2" />
              Notes (optionnel)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
              rows={3}
              placeholder="Ajoutez des notes sur cet inventaire..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
            />
          </div>

          {/* Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-800">
              <strong>Note :</strong> Tous les produits actifs seront automatiquement inclus dans cet inventaire avec leur stock théorique actuel.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Création...
                </>
              ) : (
                'Créer l\'inventaire'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


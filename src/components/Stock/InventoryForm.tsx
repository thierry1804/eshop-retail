import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { User } from '../../types';
import { X, Calendar, FileText } from 'lucide-react';
import { logger } from '../../lib/logger';
import { Offcanvas, OffcanvasHeader, OffcanvasBody, OffcanvasFooter } from '../ui/Offcanvas';

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
      const { data, error: functionError } = await supabase.rpc(
        'create_inventory_with_all_products',
        {
          p_inventory_date: inventoryDate,
          p_created_by: user.id,
          p_notes: notes || null
        }
      );

      if (functionError) throw functionError;
      if (!data) throw new Error('Aucun ID d\'inventaire retourné');

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
    <Offcanvas onClose={onClose} width="md">
      <OffcanvasHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold app-text">Nouvel inventaire</h2>
          <button
            onClick={onClose}
            className="app-text-muted hover:text-[var(--app-ink-muted)] transition-colors"
            disabled={loading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </OffcanvasHeader>

      <form id="inventory-form" onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <OffcanvasBody className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="inventory-date" className="app-label">
              <Calendar className="h-4 w-4 inline mr-2" />
              Date de l'inventaire
            </label>
            <input
              id="inventory-date"
              type="date"
              value={inventoryDate}
              onChange={(e) => setInventoryDate(e.target.value)}
              required
              disabled={loading}
              className="app-input disabled:bg-[var(--app-surface-muted)] disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="inventory-notes" className="app-label">
              <FileText className="h-4 w-4 inline mr-2" />
              Notes (optionnel)
            </label>
            <textarea
              id="inventory-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
              rows={3}
              placeholder="Ajoutez des notes sur cet inventaire..."
              className="app-input resize-none disabled:bg-[var(--app-surface-muted)] disabled:opacity-50"
            />
          </div>

          <div className="app-badge-info border border-[color-mix(in_srgb,var(--app-primary)_30%,var(--app-border))] rounded-md p-3">
            <p className="text-sm app-text-link">
              <strong>Note :</strong> Tous les produits actifs seront automatiquement inclus dans cet inventaire avec leur stock théorique actuel.
            </p>
          </div>
        </OffcanvasBody>

        <OffcanvasFooter>
          <div className="app-actions">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="app-btn app-btn-secondary app-btn-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="inventory-form"
              disabled={loading}
              className="app-btn app-btn-primary app-btn-sm"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Création...
                </>
              ) : (
                "Créer l'inventaire"
              )}
            </button>
          </div>
        </OffcanvasFooter>
      </form>
    </Offcanvas>
  );
};

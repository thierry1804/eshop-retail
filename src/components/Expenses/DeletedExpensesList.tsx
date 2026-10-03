import React, { useState, useEffect } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/supabase';
import { DataTable, dtTh, dtTd, dtTdWrap } from '../ui/DataTable';
import { formatDateDisplay } from '../../lib/dateUtils';

type Expense = Database['public']['Tables']['expenses']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];
type Supplier = Database['public']['Tables']['suppliers']['Row'];

interface ExpenseWithDetails extends Expense {
  category?: Category;
  supplier?: Supplier;
  created_by_user?: { name: string; email: string };
  updated_by_user?: { name: string; email: string };
  deleted_by_user?: { name: string; email: string };
}

interface DeletedExpensesListProps {
  onRestore?: () => void;
}

const DeletedExpensesList: React.FC<DeletedExpensesListProps> = ({ onRestore }) => {
  const [expenses, setExpenses] = useState<ExpenseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeletedExpenses = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select(`
          *,
          category:categories(*),
          supplier:suppliers(*),
          created_by_user:user_profiles!expenses_created_by_fkey(*),
          updated_by_user:user_profiles!expenses_updated_by_fkey(*),
          deleted_by_user:user_profiles!expenses_deleted_by_fkey(*)
        `)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (expensesError) {
        console.error('Erreur lors de la récupération des dépenses supprimées:', expensesError);
        setError('Erreur lors de la récupération des dépenses supprimées');
        return;
      }

      setExpenses(expensesData || []);
    } catch (err) {
      console.error('Erreur inattendue:', err);
      setError('Erreur inattendue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletedExpenses();
  }, []);

  const handleRestoreExpense = async (expenseId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir restaurer cette dépense ?')) {
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc('restore_expense', { expense_id: expenseId });

      if (error) {
        console.error('Erreur lors de la restauration de la dépense:', error);
        setError('Erreur lors de la restauration');
        return;
      }

      if (!data) {
        setError('Dépense non trouvée ou déjà restaurée');
        return;
      }

      fetchDeletedExpenses();
      if (onRestore) {
        onRestore();
      }
    } catch (err) {
      console.error('Erreur inattendue lors de la restauration:', err);
      setError('Erreur inattendue');
    }
  };

  const handlePermanentDelete = async (expenseId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer définitivement cette dépense ? Cette action est irréversible.')) {
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc('permanently_delete_expense', { expense_id: expenseId });

      if (error) {
        console.error('Erreur lors de la suppression définitive:', error);
        setError('Erreur lors de la suppression définitive');
        return;
      }

      if (!data) {
        setError('Dépense non trouvée');
        return;
      }

      fetchDeletedExpenses();
    } catch (err) {
      console.error('Erreur inattendue lors de la suppression définitive:', err);
      setError('Erreur inattendue');
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'MGA'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="p-3 sm:p-6">
        <div className="app-surface p-8 text-center text-sm app-text-muted">
          Chargement des dépenses supprimées...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 sm:p-6">
        <div className="app-surface p-8 text-center">
          <div className="text-sm mb-4 app-text-danger">{error}</div>
          <button onClick={fetchDeletedExpenses} className="app-btn app-btn-primary">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h2 className="app-page-title">Dépenses supprimées</h2>
        <p className="app-page-subtitle">
          Restauration ou suppression définitive
        </p>
      </div>

      {expenses.length === 0 ? (
        <div className="app-empty">
          <p className="app-empty-text">Aucune dépense supprimée</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {expenses.map((expense) => (
              <div key={expense.id} className="app-list-card space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium app-text truncate">
                      {expense.description || 'Sans description'}
                    </div>
                    <div className="text-xs app-text-muted mt-0.5">
                      {formatDateDisplay(expense.date)}
                    </div>
                  </div>
                  <div className="text-sm font-semibold app-text-danger flex-shrink-0">
                    {formatAmount(Number(expense.amount))}
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="app-text-muted">Supprimé par</span>
                    <span className="app-text truncate text-right">
                      {expense.deleted_by_user?.name || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="app-text-muted">Date suppression</span>
                    <span className="app-text">
                      {expense.deleted_at ? formatDateDisplay(expense.deleted_at) : '-'}
                    </span>
                  </div>
                </div>

                <div className="app-actions flex-col w-full pt-1 border-t app-border">
                  <button
                    type="button"
                    onClick={() => handleRestoreExpense(expense.id)}
                    className="app-btn app-btn-secondary w-full min-h-[44px]"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Restaurer
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePermanentDelete(expense.id)}
                    className="app-btn app-btn-danger w-full min-h-[44px]"
                  >
                    <Trash2 className="h-4 w-4" />
                    Supprimer définitivement
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block app-table-wrap">
            <DataTable>
              <thead className="app-bg-muted">
                <tr>
                  <th className={dtTh}>Date</th>
                  <th className={dtTh}>Description</th>
                  <th className={dtTh}>Montant</th>
                  <th className={dtTh}>Supprimé par</th>
                  <th className={dtTh}>Date suppression</th>
                  <th className={dtTh}>Actions</th>
                </tr>
              </thead>
              <tbody className="bg-[var(--app-surface)] divide-y divide-[var(--app-border)]">
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-[var(--app-surface-muted)]">
                    <td className={dtTd}>{formatDateDisplay(expense.date)}</td>
                    <td className={dtTdWrap}>
                      <div className="max-w-xs truncate">
                        {expense.description || '-'}
                      </div>
                    </td>
                    <td className={`${dtTd} font-medium app-text-danger`}>
                      {formatAmount(Number(expense.amount))}
                    </td>
                    <td className={dtTd}>{expense.deleted_by_user?.name || '-'}</td>
                    <td className={dtTd}>
                      {expense.deleted_at ? formatDateDisplay(expense.deleted_at) : '-'}
                    </td>
                    <td className={dtTd}>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleRestoreExpense(expense.id)}
                          className="app-btn app-btn-secondary app-btn-sm"
                          title="Restaurer cette dépense"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restaurer
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePermanentDelete(expense.id)}
                          className="app-btn app-btn-danger app-btn-sm"
                          title="Supprimer définitivement"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
        </>
      )}
    </div>
  );
};

export default DeletedExpensesList;

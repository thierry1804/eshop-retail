import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/supabase';

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
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState<ExpenseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Récupération des dépenses supprimées
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
        .not('deleted_at', 'is', null) // Seulement les dépenses supprimées
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

  // Restaurer une dépense
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

      // Rafraîchir la liste
      fetchDeletedExpenses();
      if (onRestore) {
        onRestore();
      }
    } catch (err) {
      console.error('Erreur inattendue lors de la restauration:', err);
      setError('Erreur inattendue');
    }
  };

  // Supprimer définitivement une dépense
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

      // Rafraîchir la liste
      fetchDeletedExpenses();
    } catch (err) {
      console.error('Erreur inattendue lors de la suppression définitive:', err);
      setError('Erreur inattendue');
    }
  };

  // Formatage de la date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  // Formatage du montant
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'MGA'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-gray-500 text-lg">
            Chargement des dépenses supprimées...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-red-500 text-lg mb-4">
            {error}
          </div>
          <button
            onClick={fetchDeletedExpenses}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          Dépenses supprimées
        </h2>
        <p className="text-gray-600 mt-1">
          Gérer les dépenses supprimées - restauration ou suppression définitive
        </p>
      </div>

      {expenses.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-gray-400 text-lg">
            Aucune dépense supprimée
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Supprimé par
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date suppression
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(expense.date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-xs truncate">
                        {expense.description || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                      {formatAmount(Number(expense.amount))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {expense.deleted_by_user?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {expense.deleted_at ? formatDate(expense.deleted_at) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleRestoreExpense(expense.id)}
                          className="text-green-600 hover:text-green-900"
                          title="Restaurer cette dépense"
                        >
                          Restaurer
                        </button>
                        <button 
                          onClick={() => handlePermanentDelete(expense.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Supprimer définitivement"
                        >
                          Supprimer définitivement
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeletedExpensesList;

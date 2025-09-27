import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/supabase';
import ExpenseForm from './ExpenseForm';
import DeletedExpensesList from './DeletedExpensesList';

type Expense = Database['public']['Tables']['expenses']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];
type Supplier = Database['public']['Tables']['suppliers']['Row'];

interface ExpenseWithDetails extends Expense {
  category?: Category;
  supplier?: Supplier;
}

const ExpensesList: React.FC = () => {
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState<ExpenseWithDetails[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'deleted'>('active');

  // Récupération des dépenses avec les détails des catégories et fournisseurs
  const fetchExpenses = async () => {
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
        .is('deleted_at', null) // Exclure les dépenses supprimées
        .order('date', { ascending: false });

      if (expensesError) {
        console.error('Erreur lors de la récupération des dépenses:', expensesError);
        // Gestion spécifique des erreurs
        if (expensesError.code === '42501') {
          setError('Erreur de permissions : Vous n\'avez pas les droits pour voir les dépenses.');
        } else if (expensesError.message.includes('relation') && expensesError.message.includes('does not exist')) {
          setError('Erreur de base de données : Table des dépenses non trouvée. Veuillez contacter l\'administrateur.');
        } else {
          setError(`Erreur lors de la récupération des dépenses : ${expensesError.message}`);
        }
        return;
      }

      setExpenses(expensesData || []);
    } catch (err) {
      console.error('Erreur inattendue:', err);
      setError(t('expenses.generalError'));
    } finally {
      setLoading(false);
    }
  };

  // Récupération des catégories
  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) {
        console.error('Erreur lors de la récupération des catégories:', error);
        return;
      }

      setCategories(data || []);
    } catch (err) {
      console.error('Erreur inattendue lors de la récupération des catégories:', err);
    }
  };

  // Récupération des fournisseurs
  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (error) {
        console.error('Erreur lors de la récupération des fournisseurs:', error);
        return;
      }

      setSuppliers(data || []);
    } catch (err) {
      console.error('Erreur inattendue lors de la récupération des fournisseurs:', err);
    }
  };

  useEffect(() => {
    fetchExpenses();
    fetchCategories();
    fetchSuppliers();
  }, []);

  // Fonction pour vérifier si une date correspond au filtre
  const matchesDateFilter = (expenseDate: string) => {
    const expenseDateObj = new Date(expenseDate);
    
    // Filtre par plage de dates personnalisée (priorité sur le filtre temporel)
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      
      if (start && end) {
        return expenseDateObj >= start && expenseDateObj <= end;
      } else if (start) {
        return expenseDateObj >= start;
      } else if (end) {
        return expenseDateObj <= end;
      }
    }
    
    // Filtre temporel prédéfini
    if (!dateFilter) return true;
    
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    switch (dateFilter) {
      case 'today':
        return expenseDateObj >= startOfToday;
      case 'thisWeek':
        return expenseDateObj >= startOfWeek;
      case 'thisMonth':
        return expenseDateObj >= startOfMonth;
      case 'lastMonth':
        return expenseDateObj >= startOfLastMonth && expenseDateObj <= endOfLastMonth;
      default:
        return true;
    }
  };

  // Filtrage des dépenses
  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = !searchTerm || 
      expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.category?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.supplier?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = !selectedCategory || expense.category_id === selectedCategory;
    const matchesSupplier = !selectedSupplier || expense.supplier_id === selectedSupplier;
    const matchesDate = matchesDateFilter(expense.date);

    return matchesSearch && matchesCategory && matchesSupplier && matchesDate;
  });

  // Calcul du total des dépenses filtrées
  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

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

  // Gestion des actions du formulaire
  const handleAddExpense = () => {
    setEditingExpense(null);
    setShowForm(true);
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setShowForm(true);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette dépense ? Cette action peut être annulée.')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Essayer d'abord la fonction RPC, sinon utiliser UPDATE direct
      let data, error;
      
      try {
        const result = await supabase
          .rpc('soft_delete_expense_rpc', { expense_id: expenseId } as any);
        data = result.data;
        error = result.error;
      } catch (rpcError) {
        console.log('Fonction RPC non disponible, utilisation de UPDATE direct');
        
        // Fallback: utiliser UPDATE direct pour le soft delete
        const updateResult = await (supabase as any)
          .from('expenses')
          .update({ 
            deleted_at: new Date().toISOString(),
            deleted_by: (await supabase.auth.getUser()).data.user?.id
          })
          .eq('id', expenseId)
          .eq('deleted_at', null); // Seulement si pas déjà supprimée
        
        data = updateResult.data;
        error = updateResult.error;
      }

      if (error) {
        console.error('Erreur lors de la suppression de la dépense:', error);
        
        // Gestion spécifique des erreurs
        if (error.code === '42501') {
          setError('Erreur de permissions : Vous n\'avez pas les droits pour supprimer cette dépense.');
        } else if (error.message.includes('locked')) {
          setError('Impossible de supprimer une dépense verrouillée.');
        } else if (error.message.includes('deleted_at')) {
          setError('Cette dépense a déjà été supprimée.');
        } else {
          setError(`Erreur lors de la suppression : ${error.message}`);
        }
        return;
      }

      // Vérifier si la suppression a réussi
      if (data === true) {
        console.log('Dépense supprimée avec succès');
      } else {
        setError('La dépense n\'a pas pu être supprimée (peut-être déjà supprimée ou verrouillée)');
        return;
      }

      // Rafraîchir la liste
      await fetchExpenses();
    } catch (err) {
      console.error('Erreur inattendue lors de la suppression:', err);
      setError('Erreur inattendue lors de la suppression de la dépense.');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSave = () => {
    setShowForm(false);
    setEditingExpense(null);
    fetchExpenses();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingExpense(null);
  };


  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {t('navigation.expenses')}
          </h1>
          <p className="text-gray-600 mt-2">
            {t('expenses.title')}
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-gray-500 text-lg">
            {t('expenses.loading')}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {t('navigation.expenses')}
          </h1>
          <p className="text-gray-600 mt-2">
            {t('expenses.title')}
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-red-500 text-lg mb-4">
            {error}
          </div>
          <button
            onClick={fetchExpenses}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {t('expenses.error.retry')}
          </button>
        </div>
      </div>
    );
  }

  // Si on est sur l'onglet des dépenses supprimées, afficher le composant dédié
  if (activeTab === 'deleted') {
    return (
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {t('navigation.expenses')}
              </h1>
              <p className="text-gray-600 mt-2">
                {t('expenses.title')}
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab('active')}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Dépenses actives
              </button>
              <button
                onClick={() => setActiveTab('deleted')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md"
              >
                Dépenses supprimées
              </button>
            </div>
          </div>
        </div>
        <DeletedExpensesList onRestore={fetchExpenses} />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t('navigation.expenses')}
            </h1>
            <p className="text-gray-600 mt-2">
              {t('expenses.title')}
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('active')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md"
            >
              Dépenses actives
            </button>
            <button
              onClick={() => setActiveTab('deleted')}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Dépenses supprimées
            </button>
          </div>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white rounded-lg shadow mb-6 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Recherche */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('app.search')}
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('expenses.searchPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filtre par catégorie */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('expenses.expenseCategory')}
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('expenses.filters.allCategories')}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filtre par fournisseur */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('expenses.expenseSupplier')}
            </label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('expenses.filters.allSuppliers')}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filtre par date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('expenses.filters.dateFilter')}
            </label>
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                // Effacer les dates personnalisées quand on sélectionne un filtre prédéfini
                if (e.target.value) {
                  setStartDate('');
                  setEndDate('');
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('expenses.filters.allDates')}</option>
              <option value="today">{t('expenses.filters.today')}</option>
              <option value="thisWeek">{t('expenses.filters.thisWeek')}</option>
              <option value="thisMonth">{t('expenses.filters.thisMonth')}</option>
              <option value="lastMonth">{t('expenses.filters.lastMonth')}</option>
            </select>
          </div>

          {/* Bouton d'ajout */}
          <div className="flex items-end">
            <button 
              onClick={handleAddExpense}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {t('expenses.addExpense')}
            </button>
          </div>
        </div>

        {/* Filtre par plage de dates personnalisée */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 pt-4 border-t border-gray-200">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('expenses.filters.fromDate')}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                // Effacer le filtre temporel quand on sélectionne une date personnalisée
                if (e.target.value) {
                  setDateFilter('');
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('expenses.filters.toDate')}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                // Effacer le filtre temporel quand on sélectionne une date personnalisée
                if (e.target.value) {
                  setDateFilter('');
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setDateFilter('');
              }}
              className="w-full px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              {t('expenses.filters.clearDateFilters')}
            </button>
          </div>
        </div>

        {/* Résumé et actions */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div className="flex space-x-4 text-sm text-gray-600">
              <span>
                {t('expenses.summary.totalExpenses')}: <span className="font-semibold text-lg text-red-600">{formatAmount(totalExpenses)}</span>
              </span>
              <span>
                {filteredExpenses.length} {t('expenses.summary.displayed')}
              </span>
            </div>
            
            {/* Bouton pour effacer les filtres */}
            {(searchTerm || selectedCategory || selectedSupplier || dateFilter || startDate || endDate) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('');
                  setSelectedSupplier('');
                  setDateFilter('');
                  setStartDate('');
                  setEndDate('');
                }}
                className="px-3 py-1 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                {t('expenses.filters.clearFilters')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Liste des dépenses */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-400 text-lg">
              {searchTerm || selectedCategory || selectedSupplier || dateFilter || startDate || endDate
                ? t('expenses.noExpensesFound')
                : t('expenses.noExpenses')
              }
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('expenses.table.date')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('expenses.table.description')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('expenses.table.category')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('expenses.table.supplier')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('expenses.table.amount')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('expenses.table.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('expenses.audit.createdBy')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('expenses.audit.updatedBy')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(expense.date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-xs truncate">
                        {expense.description || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {expense.category?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {expense.supplier?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                      {formatAmount(Number(expense.amount))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        expense.locked 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {expense.locked ? t('expenses.locked') : t('expenses.unlocked')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{(expense as any).created_by_user?.name || '-'}</div>
                        <div className="text-gray-500 text-xs">
                          {expense.created_at ? formatDate(expense.created_at) : '-'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{(expense as any).updated_by_user?.name || '-'}</div>
                        <div className="text-gray-500 text-xs">
                          {expense.updated_at ? formatDate(expense.updated_at) : '-'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleEditExpense(expense)}
                          disabled={expense.locked || false}
                          className={`${expense.locked
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-blue-600 hover:text-blue-900'
                            }`}
                          title={expense.locked ? t('expenses.audit.lockedExpense') : t('app.edit')}
                        >
                          {t('app.edit')}
                        </button>
                        <button 
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="text-red-600 hover:text-red-900"
                          title={t('expenses.audit.softDelete')}
                        >
                          {t('app.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal pour le formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <ExpenseForm
                expense={editingExpense || undefined}
                onSave={handleFormSave}
                onCancel={handleFormCancel}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpensesList;

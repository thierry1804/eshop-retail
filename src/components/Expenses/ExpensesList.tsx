import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/supabase';
import ExpenseForm from './ExpenseForm';
import DeletedExpensesList from './DeletedExpensesList';
import { formatCompactNumber } from '../../lib/formatUtils';
import { Search, Filter, X, Plus, Calendar, DollarSign, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  // Flag pour éviter les chargements multiples au montage
  const hasInitializedRef = useRef(false);

  // OPTIMISÉ: Récupération en parallèle de toutes les données nécessaires
  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Lancer les 3 requêtes EN PARALLÈLE au lieu de séquentiellement
      const [expensesResult, categoriesResult, suppliersResult] = await Promise.all([
        // 1. Expenses avec jointures
        supabase
          .from('expenses')
          .select(`
            *,
            category:categories(*),
            supplier:suppliers(*),
            created_by_user:user_profiles!expenses_created_by_fkey(*),
            updated_by_user:user_profiles!expenses_updated_by_fkey(*),
            deleted_by_user:user_profiles!expenses_deleted_by_fkey(*)
          `)
          .is('deleted_at', null)
          .order('date', { ascending: false }),

        // 2. Toutes les catégories (pour les dropdowns)
        supabase
          .from('categories')
          .select('*')
          .order('name'),

        // 3. Tous les fournisseurs (pour les dropdowns)
        supabase
          .from('suppliers')
          .select('*')
          .order('name')
      ]);

      // Traiter les expenses
      if (expensesResult.error) {
        console.error('Erreur lors de la récupération des dépenses:', expensesResult.error);
        if (expensesResult.error.code === '42501') {
          setError('Erreur de permissions : Vous n\'avez pas les droits pour voir les dépenses.');
        } else if (expensesResult.error.message.includes('relation') && expensesResult.error.message.includes('does not exist')) {
          setError('Erreur de base de données : Table des dépenses non trouvée. Veuillez contacter l\'administrateur.');
        } else {
          setError(`Erreur lors de la récupération des dépenses : ${expensesResult.error.message}`);
        }
        return;
      }
      setExpenses(expensesResult.data || []);

      // Traiter les catégories (filtrer pour expenses)
      if (!categoriesResult.error && categoriesResult.data) {
        const filtered = categoriesResult.data.filter(cat => {
          const modules = cat.modules || [];
          return Array.isArray(modules) && modules.includes('expenses');
        });
        setCategories(filtered);
      }

      // Traiter les fournisseurs (filtrer pour expenses)
      if (!suppliersResult.error && suppliersResult.data) {
        const filtered = suppliersResult.data.filter(supplier => {
          const modules = supplier.modules || [];
          return Array.isArray(modules) && modules.includes('expenses');
        });
        setSuppliers(filtered);
      }
    } catch (err) {
      console.error('Erreur inattendue:', err);
      setError(t('expenses.generalError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Ne charger qu'une seule fois au montage
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      fetchAllData();
    }
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

  // Formatage du montant avec format compact
  const formatAmount = (amount: number) => {
    return formatCompactNumber(amount, 'MGA');
  };

  // Calcul des statistiques
  const stats = {
    total: filteredExpenses.length,
    totalAmount: totalExpenses,
    thisMonth: filteredExpenses.filter(e => {
      const expenseDate = new Date(e.date);
      const now = new Date();
      return expenseDate.getMonth() === now.getMonth() && 
             expenseDate.getFullYear() === now.getFullYear();
    }).reduce((sum, e) => sum + Number(e.amount), 0),
    average: filteredExpenses.length > 0 ? totalExpenses / filteredExpenses.length : 0
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

  const hasActiveFilters = searchTerm || selectedCategory || selectedSupplier || dateFilter || startDate || endDate;

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      {/* Header avec onglets */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {t('navigation.expenses')}
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            {t('expenses.title')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'active'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span className="hidden sm:inline">Dépenses actives</span>
            <span className="sm:hidden">Actives</span>
          </button>
          <button
            onClick={() => setActiveTab('deleted')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'deleted'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span className="hidden sm:inline">Dépenses supprimées</span>
            <span className="sm:hidden">Supprimées</span>
          </button>
        </div>
      </div>

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total dépenses</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{formatAmount(stats.totalAmount)}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ce mois</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{formatAmount(stats.thisMonth)}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Nombre</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="bg-gray-100 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-gray-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Moyenne</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{formatAmount(stats.average)}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Barre de recherche et bouton d'ajout */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('expenses.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className={`px-4 py-2.5 border border-gray-300 rounded-lg flex items-center gap-2 transition-colors ${
            hasActiveFilters
              ? 'bg-blue-50 text-blue-700 border-blue-300'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Filter className="h-5 w-5" />
          <span className="hidden sm:inline">Filtres</span>
          {filtersExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {hasActiveFilters && (
            <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
              {[searchTerm, selectedCategory, selectedSupplier, dateFilter, startDate, endDate].filter(Boolean).length}
            </span>
          )}
        </button>
        <button
          onClick={handleAddExpense}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center gap-2 font-medium shadow-sm"
        >
          <Plus className="h-5 w-5" />
          <span className="hidden sm:inline">{t('expenses.addExpense')}</span>
          <span className="sm:hidden">Ajouter</span>
        </button>
      </div>

      {/* Panneau de filtres expandable */}
      {filtersExpanded && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Filtre par catégorie */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('expenses.expenseCategory')}
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('expenses.filters.allSuppliers')}</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtre par date rapide */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('expenses.filters.dateFilter')}
              </label>
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  if (e.target.value) {
                    setStartDate('');
                    setEndDate('');
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('expenses.filters.allDates')}</option>
                <option value="today">{t('expenses.filters.today')}</option>
                <option value="thisWeek">{t('expenses.filters.thisWeek')}</option>
                <option value="thisMonth">{t('expenses.filters.thisMonth')}</option>
                <option value="lastMonth">{t('expenses.filters.lastMonth')}</option>
              </select>
            </div>

            {/* Date de début */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('expenses.filters.fromDate')}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (e.target.value) {
                    setDateFilter('');
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Date de fin */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('expenses.filters.toDate')}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  if (e.target.value) {
                    setDateFilter('');
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Bouton effacer filtres */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('');
                  setSelectedSupplier('');
                  setDateFilter('');
                  setStartDate('');
                  setEndDate('');
                }}
                disabled={!hasActiveFilters}
                className={`w-full px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                  hasActiveFilters
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                }`}
              >
                <X className="h-4 w-4" />
                {t('expenses.filters.clearFilters')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Résumé compact */}
      {!filtersExpanded && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-gray-600">
                {t('expenses.summary.totalExpenses')}: <span className="font-semibold text-red-600">{formatAmount(totalExpenses)}</span>
              </span>
              <span className="text-gray-600">
                {filteredExpenses.length} {t('expenses.summary.displayed')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Liste des dépenses - Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {filteredExpenses.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="text-gray-400 text-base">
              {searchTerm || selectedCategory || selectedSupplier || dateFilter || startDate || endDate
                ? t('expenses.noExpensesFound')
                : t('expenses.noExpenses')
              }
            </div>
          </div>
        ) : (
          filteredExpenses.map((expense) => (
            <div key={expense.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 pr-3">
                  <div className="text-base font-semibold text-gray-900 truncate mb-1">
                    {expense.description || '-'}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{formatDate(expense.date)}</span>
                    {expense.category?.name && (
                      <>
                        <span>•</span>
                        <span className="bg-gray-100 px-2 py-0.5 rounded">{expense.category.name}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div className="text-lg font-bold text-red-600">
                    {formatAmount(Number(expense.amount))}
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    expense.locked 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {expense.locked ? t('expenses.locked') : t('expenses.unlocked')}
                  </span>
                </div>
              </div>
              {(expense.supplier?.name || !expense.locked) && (
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    {expense.supplier?.name && (
                      <div className="text-xs text-gray-600">
                        <span className="font-medium">Fournisseur:</span> {expense.supplier.name}
                      </div>
                    )}
                    <div className="flex gap-3 ml-auto">
                      <button 
                        onClick={() => handleEditExpense(expense)}
                        disabled={expense.locked || false}
                        className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
                          expense.locked
                            ? 'text-gray-400 cursor-not-allowed bg-gray-50'
                            : 'text-blue-600 hover:bg-blue-50'
                        }`}
                        title={expense.locked ? t('expenses.audit.lockedExpense') : t('app.edit')}
                      >
                        {t('app.edit')}
                      </button>
                      <button 
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="text-sm font-medium text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-md transition-colors"
                        title={t('expenses.audit.softDelete')}
                      >
                        {t('app.delete')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Liste des dépenses - Desktop Table View */}
      <div className="hidden lg:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <div className="p-12 text-center">
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
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {t('expenses.table.date')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {t('expenses.table.description')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {t('expenses.table.category')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {t('expenses.table.supplier')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {t('expenses.table.amount')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {t('expenses.table.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(expense.date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-xs truncate font-medium">
                        {expense.description || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {expense.category?.name ? (
                        <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                          {expense.category.name}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {expense.supplier?.name || <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600 text-right">
                      {formatAmount(Number(expense.amount))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                        expense.locked 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {expense.locked ? t('expenses.locked') : t('expenses.unlocked')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleEditExpense(expense)}
                          disabled={expense.locked || false}
                          className={`px-3 py-1.5 rounded-md transition-colors ${
                            expense.locked
                              ? 'text-gray-400 cursor-not-allowed bg-gray-50'
                              : 'text-blue-600 hover:bg-blue-50'
                          }`}
                          title={expense.locked ? t('expenses.audit.lockedExpense') : t('app.edit')}
                        >
                          {t('app.edit')}
                        </button>
                        <button 
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
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

      {/* Offcanvas pour le formulaire */}
      {showForm && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
            onClick={handleFormCancel}
          />
          
          {/* Offcanvas */}
          <div className="fixed inset-y-0 right-0 w-full max-w-3xl bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col">
            {/* Header fixe */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                  {editingExpense ? t('expenses.editExpense') : t('expenses.addExpense')}
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                  {editingExpense ? 'Modifier les informations de la dépense' : 'Ajouter une nouvelle dépense'}
                </p>
              </div>
              <button
                onClick={handleFormCancel}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Fermer"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            {/* Contenu scrollable */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 sm:p-6">
                <ExpenseForm
                  ref={formRef}
                  expense={editingExpense || undefined}
                  onSave={handleFormSave}
                  onCancel={handleFormCancel}
                  onLoadingChange={setFormLoading}
                />
              </div>
            </div>
            
            {/* Footer fixe avec boutons */}
            <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-3 flex justify-end gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handleFormCancel}
                disabled={formLoading}
                className="px-4 sm:px-6 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('app.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (formRef.current) {
                    formRef.current.requestSubmit();
                  }
                }}
                disabled={formLoading || editingExpense?.locked || false}
                className="px-4 sm:px-6 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {formLoading ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  t('app.save')
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ExpensesList;

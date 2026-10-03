import React, { useState, useEffect, useRef } from 'react';
import { devLog } from '../../lib/devLog';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/supabase';
import ExpenseForm from './ExpenseForm';
import DeletedExpensesList from './DeletedExpensesList';
import { formatCompactNumber } from '../../lib/formatUtils';
import { Filter, X, Plus, Calendar, DollarSign, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { Offcanvas, OffcanvasHeader, OffcanvasBody, OffcanvasFooter } from '../ui/Offcanvas';
import { SearchField } from '../ui/SearchField';
import { DataTable, dtTh, dtThRight, dtTd, dtTdWrap } from '../ui/DataTable';
import { formatDateDisplay } from '../../lib/dateUtils';

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
        devLog('Fonction RPC non disponible, utilisation de UPDATE direct');
        
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
        devLog('Dépense supprimée avec succès');
      } else {
        setError('La dépense n\'a pas pu être supprimée (peut-être déjà supprimée ou verrouillée)');
        return;
      }

      // Rafraîchir la liste
      await fetchAllData();
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
    fetchAllData();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingExpense(null);
  };


  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="app-page-title">
            {t('navigation.expenses')}
          </h1>
          <p className="app-page-subtitle">
            {t('expenses.title')}
          </p>
        </div>
        
        <div className="app-surface p-8 text-center text-sm" style={{ color: 'var(--app-ink-muted)' }}>
          {t('expenses.loading')}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="app-page-title">
            {t('navigation.expenses')}
          </h1>
          <p className="app-page-subtitle">
            {t('expenses.title')}
          </p>
        </div>
        
        <div className="app-surface p-8 text-center">
          <div className="text-sm mb-4" style={{ color: 'var(--app-danger)' }}>
            {error}
          </div>
          <button
            onClick={fetchAllData}
            className="app-btn app-btn-primary"
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
              <h1 className="app-page-title">
                {t('navigation.expenses')}
              </h1>
              <p className="app-page-subtitle">
                {t('expenses.title')}
              </p>
            </div>
            <div className="app-tabs">
              <button
                type="button"
                onClick={() => setActiveTab('active')}
                className="app-tab"
              >
                Dépenses actives
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('deleted')}
                className="app-tab app-tab-active"
              >
                Dépenses supprimées
              </button>
            </div>
          </div>
        </div>
        <DeletedExpensesList onRestore={fetchAllData} />
      </div>
    );
  }

  const hasActiveFilters = searchTerm || selectedCategory || selectedSupplier || dateFilter || startDate || endDate;

  return (
    <div className="space-y-2">
      <div className="app-sticky-chrome space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="app-page-title">
            {t('navigation.expenses')}
          </h1>
          <p className="app-page-subtitle">
            {t('expenses.title')}
          </p>
        </div>
        <div className="app-tabs shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`app-tab ${activeTab === 'active' ? 'app-tab-active' : ''}`}
          >
            <span className="hidden sm:inline">Dépenses actives</span>
            <span className="sm:hidden">Actives</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('deleted')}
            className={`app-tab ${activeTab === 'deleted' ? 'app-tab-active' : ''}`}
          >
            <span className="hidden sm:inline">Dépenses supprimées</span>
            <span className="sm:hidden">Supprimées</span>
          </button>
        </div>
      </div>

      {/* Barre de recherche et bouton d'ajout */}
      <div className="app-toolbar">
        <SearchField
          className="min-w-[12rem]"
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder={t('expenses.searchPlaceholder')}
          inputClassName="text-xs py-1.5"
        />
        <button
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className="app-btn app-btn-secondary app-btn-sm"
        >
          <Filter className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Filtres</span>
          {filtersExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {hasActiveFilters && (
            <span className="text-xs rounded-full px-2 py-0.5 ml-0.5" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              {[searchTerm, selectedCategory, selectedSupplier, dateFilter, startDate, endDate].filter(Boolean).length}
            </span>
          )}
        </button>
        <button
          onClick={handleAddExpense}
          className="app-btn app-btn-primary app-btn-sm whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('expenses.addExpense')}</span>
          <span className="sm:hidden">Ajouter</span>
        </button>
      </div>
      </div>

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="app-kpi">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--app-ink-muted)' }}>Total dépenses</p>
              <p className="text-lg font-semibold mt-0.5" style={{ color: 'var(--app-ink)' }}>{formatAmount(stats.totalAmount)}</p>
            </div>
            <DollarSign className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--app-ink-muted)' }} />
          </div>
        </div>

        <div className="app-kpi">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--app-ink-muted)' }}>Ce mois</p>
              <p className="text-lg font-semibold mt-0.5" style={{ color: 'var(--app-ink)' }}>{formatAmount(stats.thisMonth)}</p>
            </div>
            <Calendar className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--app-ink-muted)' }} />
          </div>
        </div>

        <div className="app-kpi">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--app-ink-muted)' }}>Nombre</p>
              <p className="text-lg font-semibold mt-0.5" style={{ color: 'var(--app-ink)' }}>{stats.total}</p>
            </div>
            <TrendingUp className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--app-ink-muted)' }} />
          </div>
        </div>

        <div className="app-kpi">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--app-ink-muted)' }}>Moyenne</p>
              <p className="text-lg font-semibold mt-0.5" style={{ color: 'var(--app-ink)' }}>{formatAmount(stats.average)}</p>
            </div>
            <TrendingUp className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--app-ink-muted)' }} />
          </div>
        </div>
      </div>

      {/* Panneau de filtres expandable */}
      {filtersExpanded && (
        <div className="app-surface p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Filtre par catégorie */}
            <div>
              <label className="app-label mb-2">
                {t('expenses.expenseCategory')}
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="app-input"
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
              <label className="app-label mb-2">
                {t('expenses.expenseSupplier')}
              </label>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="app-input"
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
              <label className="app-label mb-2">
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
                className="app-input"
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
              <label className="app-label mb-2">
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
                className="app-input"
              />
            </div>

            {/* Date de fin */}
            <div>
              <label className="app-label mb-2">
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
                className="app-input"
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
                className={`app-btn w-full ${
                  hasActiveFilters
                    ? 'app-btn-secondary'
                    : 'app-btn-secondary opacity-50 cursor-not-allowed'
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
        <div className="hidden lg:block app-surface p-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-4">
              <span className="app-text-muted">
                {t('expenses.summary.totalExpenses')}: <span className="font-semibold text-red-600">{formatAmount(totalExpenses)}</span>
              </span>
              <span className="app-text-muted">
                {filteredExpenses.length} {t('expenses.summary.displayed')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Liste des dépenses - Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {filteredExpenses.length === 0 ? (
          <div className="app-empty">
            <p className="app-empty-text">
              {searchTerm || selectedCategory || selectedSupplier || dateFilter || startDate || endDate
                ? t('expenses.noExpensesFound')
                : t('expenses.noExpenses')
              }
            </p>
          </div>
        ) : (
          filteredExpenses.map((expense) => (
            <div key={expense.id} className="app-list-card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 pr-3">
                  <div className="text-base font-semibold app-text truncate mb-1">
                    {expense.description || '-'}
                  </div>
                  <div className="flex items-center gap-3 text-xs app-text-muted">
                    <span>{formatDateDisplay(expense.date)}</span>
                    {expense.category?.name && (
                      <>
                        <span>•</span>
                        <span className="app-badge px-2 py-0.5">{expense.category.name}</span>
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
                <div className="pt-3 border-t border-[var(--app-border)]">
                  <div className="flex items-center justify-between">
                    {expense.supplier?.name && (
                      <div className="text-xs app-text-muted">
                        <span className="font-medium">Fournisseur:</span> {expense.supplier.name}
                      </div>
                    )}
                    <div className="flex gap-3 ml-auto">
                      <button 
                        onClick={() => handleEditExpense(expense)}
                        disabled={expense.locked || false}
                        className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
                          expense.locked
                            ? 'app-text-muted cursor-not-allowed app-bg-muted'
                            : 'app-text-link hover:bg-[color-mix(in_srgb,var(--app-primary)_10%,var(--app-surface))]'
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
      <div className="hidden lg:block app-table-wrap">
        {filteredExpenses.length === 0 ? (
          <div className="app-empty">
            <p className="app-empty-text">
              {searchTerm || selectedCategory || selectedSupplier || dateFilter || startDate || endDate
                ? t('expenses.noExpensesFound')
                : t('expenses.noExpenses')
              }
            </p>
          </div>
        ) : (
          <DataTable>
              <thead className="app-bg-muted">
                <tr>
                  <th className={dtTh}>{t('expenses.table.date')}</th>
                  <th className={dtTh}>{t('expenses.table.description')}</th>
                  <th className={dtTh}>{t('expenses.table.category')}</th>
                  <th className={dtTh}>{t('expenses.table.supplier')}</th>
                  <th className={dtThRight}>{t('expenses.table.amount')}</th>
                  <th className={dtTh}>{t('expenses.table.status')}</th>
                  <th className={dtTh}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="bg-[var(--app-surface)] divide-y divide-[var(--app-border)]">
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-[var(--app-surface-muted)] transition-colors">
                    <td className={dtTd}>
                      {formatDateDisplay(expense.date)}
                    </td>
                    <td className={dtTdWrap}>
                      <div className="max-w-xs truncate font-medium">
                        {expense.description || '-'}
                      </div>
                    </td>
                    <td className={dtTd}>
                      {expense.category?.name ? (
                        <span className="inline-flex px-1.5 py-0.5 text-[11px] font-medium app-badge rounded">
                          {expense.category.name}
                        </span>
                      ) : (
                        <span className="app-text-muted">-</span>
                      )}
                    </td>
                    <td className={dtTd}>
                      {expense.supplier?.name || <span className="app-text-muted">-</span>}
                    </td>
                    <td className={`${dtTd} font-bold text-red-600 text-right`}>
                      {formatAmount(Number(expense.amount))}
                    </td>
                    <td className={dtTd}>
                      <span className={`inline-flex px-1.5 py-0.5 text-[11px] font-semibold rounded-full ${
                        expense.locked 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {expense.locked ? t('expenses.locked') : t('expenses.unlocked')}
                      </span>
                    </td>
                    <td className={`${dtTd} font-medium`}>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleEditExpense(expense)}
                          disabled={expense.locked || false}
                          className={`px-3 py-1.5 rounded-md transition-colors ${
                            expense.locked
                              ? 'app-text-muted cursor-not-allowed app-bg-muted'
                              : 'app-text-link hover:bg-[color-mix(in_srgb,var(--app-primary)_10%,var(--app-surface))]'
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
          </DataTable>
        )}
      </div>

      {showForm && (
        <Offcanvas
          onClose={handleFormCancel}
          width="lg"
          ariaLabel={
            editingExpense ? t('expenses.editExpense') : t('expenses.addExpense')
          }
        >
          <OffcanvasHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="app-page-title truncate">
                  {editingExpense ? t('expenses.editExpense') : t('expenses.addExpense')}
                </h2>
                <p className="text-xs sm:text-sm app-text-muted mt-0.5">
                  {editingExpense
                    ? 'Modifier les informations de la dépense'
                    : 'Ajouter une nouvelle dépense'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleFormCancel}
                className="app-icon-btn flex-shrink-0"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </OffcanvasHeader>

          <OffcanvasBody>
            <ExpenseForm
              ref={formRef}
              expense={editingExpense || undefined}
              onSave={handleFormSave}
              onCancel={handleFormCancel}
              onLoadingChange={setFormLoading}
            />
          </OffcanvasBody>

          <OffcanvasFooter>
            <div className="app-actions">
              <button
                type="button"
                onClick={handleFormCancel}
                disabled={formLoading}
                className="app-btn app-btn-secondary app-btn-sm"
              >
                {t('app.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  formRef.current?.requestSubmit();
                }}
                disabled={formLoading || editingExpense?.locked || false}
                className="app-btn app-btn-primary app-btn-sm"
              >
                {formLoading ? (
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  t('app.save')
                )}
              </button>
            </div>
          </OffcanvasFooter>
        </Offcanvas>
      )}
    </div>
  );
};

export default ExpensesList;

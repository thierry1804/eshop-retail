import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/supabase';

type Expense = Database['public']['Tables']['expenses']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];
type Supplier = Database['public']['Tables']['suppliers']['Row'];

interface ExpenseFormProps {
  expense?: Expense;
  onSave: () => void;
  onCancel: () => void;
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({ expense, onSave, onCancel }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    amount: expense?.amount?.toString() || '',
    category_id: expense?.category_id || '',
    supplier_id: expense?.supplier_id || '',
    date: expense?.date || new Date().toISOString().split('T')[0],
    description: expense?.description || '',
    locked: expense?.locked || false,
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Récupération des catégories pour les dépenses
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

      // Filtrer côté client pour les catégories qui contiennent 'expenses' dans leur tableau modules
      const filtered = (data || []).filter(cat => {
        const modules = cat.modules || [];
        return Array.isArray(modules) && modules.includes('expenses');
      });

      setCategories(filtered);
    } catch (err) {
      console.error('Erreur inattendue lors de la récupération des catégories:', err);
    }
  };

  // Récupération des fournisseurs pour les dépenses
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

      // Filtrer côté client pour les fournisseurs qui contiennent 'expenses' dans leur tableau modules
      const filtered = (data || []).filter(supplier => {
        const modules = supplier.modules || [];
        return Array.isArray(modules) && modules.includes('expenses');
      });

      setSuppliers(filtered);
    } catch (err) {
      console.error('Erreur inattendue lors de la récupération des fournisseurs:', err);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchSuppliers();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const validateForm = () => {
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError(t('errors.invalidAmount'));
      return false;
    }
    if (!formData.date) {
      setError(t('errors.required'));
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Vérifier si la dépense est verrouillée
    if (expense && expense.locked) {
      setError(t('expenses.audit.cannotModify'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const expenseData = {
        amount: parseFloat(formData.amount),
        category_id: formData.category_id || null,
        supplier_id: formData.supplier_id || null,
        date: formData.date,
        description: formData.description || null,
        locked: formData.locked,
      };

      if (expense) {
        // Mise à jour d'une dépense existante
        const { error } = await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', expense.id);

        if (error) {
          console.error('Erreur lors de la mise à jour de la dépense:', error);
          
          // Gestion spécifique des erreurs RLS
          if (error.code === '42501') {
            setError('Erreur de permissions : Veuillez contacter l\'administrateur pour configurer les droits d\'accès.');
          } else if (error.message.includes('locked')) {
            setError(t('expenses.audit.cannotModify'));
          } else {
            setError(t('expenses.saveError'));
          }
          return;
        }
      } else {
        // Création d'une nouvelle dépense
        const { error } = await supabase
          .from('expenses')
          .insert(expenseData);

        if (error) {
          console.error('Erreur lors de la création de la dépense:', error);
          
          // Gestion spécifique des erreurs RLS
          if (error.code === '42501') {
            setError('Erreur de permissions : Veuillez contacter l\'administrateur pour configurer les droits d\'accès.');
          } else {
            setError(t('expenses.saveError'));
          }
          return;
        }
      }

      onSave();
    } catch (err) {
      console.error('Erreur inattendue:', err);
      setError(t('expenses.generalError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          {expense ? t('expenses.editExpense') : t('expenses.addExpense')}
        </h2>
        <p className="text-gray-600 mt-1">
          {expense ? 'Modifier les informations de la dépense' : 'Ajouter une nouvelle dépense'}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-600 text-sm">{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Montant */}
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
              {t('expenses.expenseAmount')} *
            </label>
            <input
              type="number"
              id="amount"
              name="amount"
              value={formData.amount}
              onChange={handleInputChange}
              placeholder={t('expenses.amountPlaceholder')}
              step="0.01"
              min="0"
              required
              disabled={expense?.locked}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Date */}
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
              {t('expenses.expenseDate')} *
            </label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              required
              disabled={expense?.locked}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Catégorie */}
          <div>
            <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 mb-2">
              {t('expenses.expenseCategory')}
            </label>
            <select
              id="category_id"
              name="category_id"
              value={formData.category_id}
              onChange={handleInputChange}
              disabled={expense?.locked}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">{t('expenses.filters.allCategories')}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Fournisseur */}
          <div>
            <label htmlFor="supplier_id" className="block text-sm font-medium text-gray-700 mb-2">
              {t('expenses.expenseSupplier')}
            </label>
            <select
              id="supplier_id"
              name="supplier_id"
              value={formData.supplier_id}
              onChange={handleInputChange}
              disabled={expense?.locked}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">{t('expenses.filters.allSuppliers')}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            {t('expenses.expenseDescription')}
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder={t('expenses.descriptionPlaceholder')}
            rows={3}
            disabled={expense?.locked}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Statut verrouillé */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="locked"
            name="locked"
            checked={formData.locked}
            onChange={handleInputChange}
            disabled={expense?.locked}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <label htmlFor="locked" className="ml-2 block text-sm text-gray-700">
            {t('expenses.locked')}
            {expense?.locked && (
              <span className="ml-2 text-red-600 text-xs">({t('expenses.audit.lockedExpense')} - non modifiable)</span>
            )}
          </label>
        </div>

        {/* Boutons d'action */}
        <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            {t('app.cancel')}
          </button>
          <button
            type="submit"
            disabled={loading || expense?.locked}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('app.saving') : t('app.save')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ExpenseForm;

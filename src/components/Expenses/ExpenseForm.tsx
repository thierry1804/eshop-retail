import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/supabase';
import { AlertCircle } from 'lucide-react';

type Expense = Database['public']['Tables']['expenses']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];
type Supplier = Database['public']['Tables']['suppliers']['Row'];

interface ExpenseFormProps {
  expense?: Expense;
  onSave: () => void;
  onCancel: () => void;
  onLoadingChange?: (loading: boolean) => void;
}

const ExpenseForm = forwardRef<HTMLFormElement, ExpenseFormProps>(({ expense, onSave, onCancel, onLoadingChange }, ref) => {
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
  
  // États pour la validation en temps réel
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  
  // États pour l'autocomplétion
  const [categorySearch, setCategorySearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [mostUsedCategories, setMostUsedCategories] = useState<Category[]>([]);
  const [mostUsedSuppliers, setMostUsedSuppliers] = useState<Supplier[]>([]);
  
  const categoryInputRef = useRef<HTMLInputElement>(null);
  const supplierInputRef = useRef<HTMLInputElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const supplierDropdownRef = useRef<HTMLDivElement>(null);

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
      
      // Récupérer les catégories les plus utilisées
      const { data: expensesData } = await supabase
        .from('expenses')
        .select('category_id')
        .not('category_id', 'is', null);
      
      if (expensesData) {
        const categoryCounts = expensesData.reduce((acc: Record<string, number>, exp) => {
          if (exp.category_id) {
            acc[exp.category_id] = (acc[exp.category_id] || 0) + 1;
          }
          return acc;
        }, {});
        
        const sorted = filtered
          .map(cat => ({ ...cat, count: categoryCounts[cat.id] || 0 }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
          .map(({ count, ...cat }) => cat);
        
        setMostUsedCategories(sorted);
      }
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
      
      // Récupérer les fournisseurs les plus utilisés
      const { data: expensesData } = await supabase
        .from('expenses')
        .select('supplier_id')
        .not('supplier_id', 'is', null);
      
      if (expensesData) {
        const supplierCounts = expensesData.reduce((acc: Record<string, number>, exp) => {
          if (exp.supplier_id) {
            acc[exp.supplier_id] = (acc[exp.supplier_id] || 0) + 1;
          }
          return acc;
        }, {});
        
        const sorted = filtered
          .map(supplier => ({ ...supplier, count: supplierCounts[supplier.id] || 0 }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
          .map(({ count, ...supplier }) => supplier);
        
        setMostUsedSuppliers(sorted);
      }
    } catch (err) {
      console.error('Erreur inattendue lors de la récupération des fournisseurs:', err);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchSuppliers();
  }, []);

  // Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (formRef.current && !loading) {
          formRef.current.requestSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, loading]);

  // Validation en temps réel
  const validateField = (name: string, value: string | number) => {
    const errors: Record<string, string> = {};
    
    if (name === 'amount') {
      const amount = typeof value === 'string' ? parseFloat(value) : value;
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        errors.amount = t('expenses.form.amountRequired');
      } else if (isNaN(amount) || amount <= 0) {
        errors.amount = t('expenses.form.amountPositive');
      }
    }
    
    if (name === 'date') {
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        errors.date = t('expenses.form.dateRequired');
      }
    }
    
    setFieldErrors(prev => ({ ...prev, ...errors }));
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
      
      // Validation en temps réel
      if (touchedFields[name]) {
        validateField(name, value);
      }
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTouchedFields(prev => ({ ...prev, [name]: true }));
    validateField(name, value);
  };

  // Formatage du montant avec séparateurs
  const formatAmountInput = (value: string) => {
    // Retirer tous les caractères non numériques sauf le point et la virgule
    let cleaned = value.replace(/[^\d.,]/g, '');
    // Remplacer les virgules par des points
    cleaned = cleaned.replace(/,/g, '.');
    // Garder seulement un point décimal
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    // Limiter à 2 décimales
    if (parts.length === 2 && parts[1].length > 2) {
      return parts[0] + '.' + parts[1].substring(0, 2);
    }
    return cleaned;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatAmountInput(e.target.value);
    setFormData(prev => ({ ...prev, amount: formatted }));
    
    if (touchedFields.amount) {
      validateField('amount', formatted);
    }
  };

  // Filtrage des catégories pour l'autocomplétion
  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  // Filtrage des fournisseurs pour l'autocomplétion
  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  const getCategoryName = (id: string) => {
    return categories.find(c => c.id === id)?.name || '';
  };

  const getSupplierName = (id: string) => {
    return suppliers.find(s => s.id === id)?.name || '';
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    // Validation du montant
    if (!formData.amount || formData.amount.trim() === '') {
      errors.amount = t('expenses.form.amountRequired');
    } else {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        errors.amount = t('expenses.form.amountPositive');
      }
    }
    
    // Validation de la date
    if (!formData.date) {
      errors.date = t('expenses.form.dateRequired');
    }
    
    setFieldErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      setError(t('errors.validation'));
      // Marquer tous les champs comme touchés
      setTouchedFields({
        amount: true,
        date: true,
      });
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
    onLoadingChange?.(true);

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
          
          // Gestion spécifique des erreurs
          if (error.code === '42501') {
            setError('Erreur de permissions : Veuillez contacter l\'administrateur pour configurer les droits d\'accès.');
          } else if (error.code === '23503') {
            setError('Erreur : Catégorie ou fournisseur invalide.');
          } else if (error.message.includes('locked')) {
            setError(t('expenses.audit.cannotModify'));
          } else {
            setError(t('expenses.saveError') + (error.message ? ` : ${error.message}` : ''));
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
          
          // Gestion spécifique des erreurs
          if (error.code === '42501') {
            setError('Erreur de permissions : Veuillez contacter l\'administrateur pour configurer les droits d\'accès.');
          } else if (error.code === '23503') {
            setError('Erreur : Catégorie ou fournisseur invalide.');
          } else if (error.code === '23505') {
            setError('Erreur : Une dépense avec cet identifiant existe déjà.');
          } else {
            setError(t('expenses.saveError') + (error.message ? ` : ${error.message}` : ''));
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
      onLoadingChange?.(false);
    }
  };

  const formRef = useRef<HTMLFormElement>(null);
  
  // Exposer la ref du formulaire
  useImperativeHandle(ref, () => formRef.current as HTMLFormElement, []);

  // Fermer les dropdowns quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node) && 
          categoryInputRef.current && !categoryInputRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target as Node) &&
          supplierInputRef.current && !supplierInputRef.current.contains(event.target as Node)) {
        setShowSupplierDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="max-w-full">

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="text-red-600 text-sm">{error}</div>
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        {/* Section 1: Champs requis */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Informations principales</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Montant */}
            <div>
              <label htmlFor="amount" className="block text-xs font-medium text-gray-700 mb-1.5">
                {t('expenses.expenseAmount')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="amount"
                  name="amount"
                  value={formData.amount}
                  onChange={handleAmountChange}
                  onBlur={handleBlur}
                  onFocus={(e) => e.target.select()}
                  placeholder="0.00"
                  required
                  disabled={expense?.locked}
                  className={`w-full pl-3 pr-12 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm ${
                    fieldErrors.amount && touchedFields.amount
                      ? 'border-red-300 focus:ring-red-500 bg-red-50'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none">
                  <span className="text-gray-500 text-xs font-medium">MGA</span>
                </div>
              </div>
              {fieldErrors.amount && touchedFields.amount && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {fieldErrors.amount}
                </p>
              )}
            </div>

            {/* Date */}
            <div>
              <label htmlFor="date" className="block text-xs font-medium text-gray-700 mb-1.5">
                {t('expenses.expenseDate')} <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                onBlur={handleBlur}
                required
                disabled={expense?.locked}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm ${
                  fieldErrors.date && touchedFields.date
                    ? 'border-red-300 focus:ring-red-500 bg-red-50'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
              />
              {fieldErrors.date && touchedFields.date && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {fieldErrors.date}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Classification */}
        <div className="space-y-3 pt-3 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Classification</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Catégorie avec autocomplétion */}
            <div className="relative">
              <label htmlFor="category_search" className="block text-xs font-medium text-gray-700 mb-1.5">
                {t('expenses.expenseCategory')}
              </label>
              <div className="relative">
                <input
                  ref={categoryInputRef}
                  type="text"
                  id="category_search"
                  value={categorySearch !== '' ? categorySearch : (formData.category_id ? getCategoryName(formData.category_id) : '')}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCategorySearch(value);
                    setShowCategoryDropdown(true);
                    // Si on efface complètement, réinitialiser la sélection
                    if (!value) {
                      setFormData(prev => ({ ...prev, category_id: '' }));
                    }
                  }}
                  onFocus={() => {
                    setShowCategoryDropdown(true);
                    // Si une catégorie est déjà sélectionnée, permettre de la modifier
                    if (formData.category_id) {
                      setCategorySearch('');
                    }
                  }}
                  placeholder="Rechercher une catégorie"
                  disabled={expense?.locked}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                />
                {showCategoryDropdown && (categorySearch || mostUsedCategories.length > 0) && (
                  <div
                    ref={categoryDropdownRef}
                    className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-auto"
                  >
                    {categorySearch && filteredCategories.length > 0 && (
                      <div className="p-1.5">
                        <div className="text-xs font-semibold text-gray-500 uppercase px-2 py-1">Résultats</div>
                        {filteredCategories.map((category) => (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, category_id: category.id }));
                              setCategorySearch('');
                              setShowCategoryDropdown(false);
                              categoryInputRef.current?.blur();
                            }}
                            className="w-full text-left px-2.5 py-1.5 hover:bg-blue-50 rounded transition-colors text-sm"
                          >
                            {category.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {!categorySearch && mostUsedCategories.length > 0 && (
                      <div className="p-1.5">
                        <div className="text-xs font-semibold text-gray-500 uppercase px-2 py-1">Fréquemment utilisées</div>
                        {mostUsedCategories.map((category) => (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, category_id: category.id }));
                              setCategorySearch('');
                              setShowCategoryDropdown(false);
                              categoryInputRef.current?.blur();
                            }}
                            className="w-full text-left px-2.5 py-1.5 hover:bg-blue-50 rounded transition-colors text-sm"
                          >
                            {category.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {categorySearch && filteredCategories.length === 0 && (
                      <div className="p-2 text-xs text-gray-500 text-center">Aucune catégorie trouvée</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Fournisseur avec autocomplétion */}
            <div className="relative">
              <label htmlFor="supplier_search" className="block text-xs font-medium text-gray-700 mb-1.5">
                {t('expenses.expenseSupplier')}
              </label>
              <div className="relative">
                <input
                  ref={supplierInputRef}
                  type="text"
                  id="supplier_search"
                  value={supplierSearch !== '' ? supplierSearch : (formData.supplier_id ? getSupplierName(formData.supplier_id) : '')}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSupplierSearch(value);
                    setShowSupplierDropdown(true);
                    // Si on efface complètement, réinitialiser la sélection
                    if (!value) {
                      setFormData(prev => ({ ...prev, supplier_id: '' }));
                    }
                  }}
                  onFocus={() => {
                    setShowSupplierDropdown(true);
                    // Si un fournisseur est déjà sélectionné, permettre de le modifier
                    if (formData.supplier_id) {
                      setSupplierSearch('');
                    }
                  }}
                  placeholder="Rechercher un fournisseur"
                  disabled={expense?.locked}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                />
                {showSupplierDropdown && (supplierSearch || mostUsedSuppliers.length > 0) && (
                  <div
                    ref={supplierDropdownRef}
                    className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-auto"
                  >
                    {supplierSearch && filteredSuppliers.length > 0 && (
                      <div className="p-1.5">
                        <div className="text-xs font-semibold text-gray-500 uppercase px-2 py-1">Résultats</div>
                        {filteredSuppliers.map((supplier) => (
                          <button
                            key={supplier.id}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, supplier_id: supplier.id }));
                              setSupplierSearch('');
                              setShowSupplierDropdown(false);
                              supplierInputRef.current?.blur();
                            }}
                            className="w-full text-left px-2.5 py-1.5 hover:bg-blue-50 rounded transition-colors text-sm"
                          >
                            {supplier.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {!supplierSearch && mostUsedSuppliers.length > 0 && (
                      <div className="p-1.5">
                        <div className="text-xs font-semibold text-gray-500 uppercase px-2 py-1">Fréquemment utilisés</div>
                        {mostUsedSuppliers.map((supplier) => (
                          <button
                            key={supplier.id}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, supplier_id: supplier.id }));
                              setSupplierSearch('');
                              setShowSupplierDropdown(false);
                              supplierInputRef.current?.blur();
                            }}
                            className="w-full text-left px-2.5 py-1.5 hover:bg-blue-50 rounded transition-colors text-sm"
                          >
                            {supplier.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {supplierSearch && filteredSuppliers.length === 0 && (
                      <div className="p-2 text-xs text-gray-500 text-center">Aucun fournisseur trouvé</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Description */}
        <div className="space-y-3 pt-3 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Détails</h3>
          <div>
            <label htmlFor="description" className="block text-xs font-medium text-gray-700 mb-1.5">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors resize-none text-sm"
            />
            <p className="mt-1 text-xs text-gray-400">
              {formData.description.length} caractères
            </p>
          </div>
        </div>

        {/* Section 4: Options */}
        <div className="space-y-3 pt-3 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Options</h3>
          <div className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-md">
            <input
              type="checkbox"
              id="locked"
              name="locked"
              checked={formData.locked}
              onChange={handleInputChange}
              disabled={expense?.locked}
              className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed mt-0.5"
            />
            <div className="flex-1">
              <label htmlFor="locked" className="block text-xs font-medium text-gray-700">
                {t('expenses.locked')}
              </label>
              <p className="text-xs text-gray-500 mt-0.5">
                Ne peut plus être modifiée ou supprimée après enregistrement
              </p>
              {expense?.locked && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {t('expenses.audit.lockedExpense')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Aide clavier */}
        <div className="pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-400 flex items-center gap-1.5 flex-wrap">
            <span>Raccourcis:</span>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Esc</kbd>
            <span>annuler,</span>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Ctrl+Enter</kbd>
            <span>enregistrer</span>
          </p>
        </div>

        {/* Note: Les boutons sont maintenant dans le footer de l'offcanvas */}
      </form>
    </div>
  );
});

ExpenseForm.displayName = 'ExpenseForm';

export default ExpenseForm;

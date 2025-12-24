import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, Tag, Truck, CheckSquare, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/supabase';

type Category = Database['public']['Tables']['categories']['Row'];
type Supplier = Database['public']['Tables']['suppliers']['Row'];

type Module = 'expenses' | 'stock';

export const ReferentialsManager: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'categories' | 'suppliers'>('categories');
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingCategories, setEditingCategories] = useState<Record<string, Category>>({});
  const [editingSuppliers, setEditingSuppliers] = useState<Record<string, Supplier>>({});
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [newCategoryModules, setNewCategoryModules] = useState<Module[]>(['expenses']);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierContact, setNewSupplierContact] = useState('');
  const [newSupplierModules, setNewSupplierModules] = useState<Module[]>(['expenses']);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'categories') {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .order('name');

        if (error) throw error;
        setCategories(data || []);
      } else {
        const { data, error } = await supabase
          .from('suppliers')
          .select('*')
          .order('name');

        if (error) throw error;
        setSuppliers(data || []);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      alert('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const toggleModule = (modules: string[], module: Module): string[] => {
    if (modules.includes(module)) {
      // Si c'est le dernier module, on ne peut pas le retirer
      if (modules.length === 1) {
        alert('Un référentiel doit être associé à au moins un module');
        return modules;
      }
      return modules.filter(m => m !== module);
    } else {
      return [...modules, module];
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      alert('Le nom de la catégorie est requis');
      return;
    }

    if (newCategoryModules.length === 0) {
      alert('Veuillez sélectionner au moins un module');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({
          name: newCategoryName.trim(),
          description: newCategoryDescription.trim() || null,
          modules: newCategoryModules,
        })
        .select()
        .single();

      if (error) throw error;
      setNewCategoryName('');
      setNewCategoryDescription('');
      setNewCategoryModules(['expenses']);
      fetchData();
    } catch (error) {
      console.error('Erreur lors de la création de la catégorie:', error);
      alert('Erreur lors de la création de la catégorie');
    }
  };

  const handleUpdateCategory = async (categoryId: string) => {
    const category = editingCategories[categoryId];
    if (!category) return;
    
    if (!category.modules || category.modules.length === 0) {
      alert('Veuillez sélectionner au moins un module');
      return;
    }

    try {
      const { error } = await supabase
        .from('categories')
        .update({
          name: category.name,
          description: category.description,
          modules: category.modules as string[],
        })
        .eq('id', categoryId);

      if (error) throw error;

      // Mettre à jour l'élément dans la liste locale
      setCategories(prevCategories => 
        prevCategories.map(cat => 
          cat.id === categoryId 
            ? { ...cat, ...category }
            : cat
        )
      );

      // Retirer de l'état d'édition
      const newEditing = { ...editingCategories };
      delete newEditing[categoryId];
      setEditingCategories(newEditing);
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour de la catégorie:', error);
      alert(`Erreur lors de la mise à jour de la catégorie: ${error.message || error}`);
    }
  };

  const handleToggleCategoryModule = (categoryId: string, module: Module) => {
    const category = editingCategories[categoryId] || categories.find(c => c.id === categoryId);
    if (!category) return;
    
    const currentModules = (category.modules || []) as string[];
    const newModules = toggleModule(currentModules, module);
    setEditingCategories({
      ...editingCategories,
      [categoryId]: {
        ...category,
        modules: newModules as any,
      },
    });
  };

  const getEditingCategory = (categoryId: string): Category => {
    return editingCategories[categoryId] || categories.find(c => c.id === categoryId) || {} as Category;
  };

  const handleCategoryFieldChange = (categoryId: string, field: string, value: any) => {
    const category = getEditingCategory(categoryId);
    setEditingCategories({
      ...editingCategories,
      [categoryId]: {
        ...category,
        [field]: value,
      },
    });
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Erreur lors de la suppression de la catégorie:', error);
      alert('Erreur lors de la suppression de la catégorie. Elle est peut-être utilisée dans des dépenses ou produits.');
    }
  };

  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim()) {
      alert('Le nom du fournisseur est requis');
      return;
    }

    if (newSupplierModules.length === 0) {
      alert('Veuillez sélectionner au moins un module');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          name: newSupplierName.trim(),
          contact_info: newSupplierContact.trim() || null,
          modules: newSupplierModules,
        })
        .select()
        .single();

      if (error) throw error;
      setNewSupplierName('');
      setNewSupplierContact('');
      setNewSupplierModules(['expenses']);
      fetchData();
    } catch (error) {
      console.error('Erreur lors de la création du fournisseur:', error);
      alert('Erreur lors de la création du fournisseur');
    }
  };

  const handleUpdateSupplier = async (supplierId: string) => {
    const supplier = editingSuppliers[supplierId];
    if (!supplier) return;
    
    if (!supplier.modules || supplier.modules.length === 0) {
      alert('Veuillez sélectionner au moins un module');
      return;
    }

    try {
      const { error } = await supabase
        .from('suppliers')
        .update({
          name: supplier.name,
          contact_info: supplier.contact_info,
          modules: supplier.modules as string[],
        })
        .eq('id', supplierId);

      if (error) throw error;

      // Mettre à jour l'élément dans la liste locale
      setSuppliers(prevSuppliers => 
        prevSuppliers.map(sup => 
          sup.id === supplierId 
            ? { ...sup, ...supplier }
            : sup
        )
      );

      // Retirer de l'état d'édition
      const newEditing = { ...editingSuppliers };
      delete newEditing[supplierId];
      setEditingSuppliers(newEditing);
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour du fournisseur:', error);
      alert(`Erreur lors de la mise à jour du fournisseur: ${error.message || error}`);
    }
  };

  const handleToggleSupplierModule = (supplierId: string, module: Module) => {
    const supplier = editingSuppliers[supplierId] || suppliers.find(s => s.id === supplierId);
    if (!supplier) return;
    
    const currentModules = (supplier.modules || []) as string[];
    const newModules = toggleModule(currentModules, module);
    setEditingSuppliers({
      ...editingSuppliers,
      [supplierId]: {
        ...supplier,
        modules: newModules as any,
      },
    });
  };

  const getEditingSupplier = (supplierId: string): Supplier => {
    return editingSuppliers[supplierId] || suppliers.find(s => s.id === supplierId) || {} as Supplier;
  };

  const handleSupplierFieldChange = (supplierId: string, field: string, value: any) => {
    const supplier = getEditingSupplier(supplierId);
    setEditingSuppliers({
      ...editingSuppliers,
      [supplierId]: {
        ...supplier,
        [field]: value,
      },
    });
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce fournisseur ?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Erreur lors de la suppression du fournisseur:', error);
      alert('Erreur lors de la suppression du fournisseur. Il est peut-être utilisé dans des dépenses ou produits.');
    }
  };

  const ModuleCheckbox: React.FC<{ 
    module: Module; 
    checked: boolean; 
    onChange: () => void;
    label: string;
  }> = ({ module, checked, onChange, label }) => (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
      />
      <span className="text-sm">{label}</span>
    </label>
  );

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
          Gestion des référentiels
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Gérez les catégories et fournisseurs et définissez sur quels modules ils apparaissent
        </p>
      </div>

      {/* Onglets */}
      <div className="mb-4 sm:mb-6 border-b border-gray-200">
        <div className="flex gap-2 sm:gap-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 font-medium border-b-2 ${
              activeTab === 'categories'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Tag className="inline mr-2" size={18} />
            Catégories
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`px-4 py-2 font-medium border-b-2 ${
              activeTab === 'suppliers'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Truck className="inline mr-2" size={18} />
            Fournisseurs
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : activeTab === 'categories' ? (
          <div className="p-6">
            {/* Formulaire de création */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Nouvelle catégorie</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Communication, Frais bancaires..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={newCategoryDescription}
                    onChange={(e) => setNewCategoryDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Description optionnelle"
                  />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Modules où cette catégorie apparaît *
                </label>
                <div className="flex gap-6">
                  <ModuleCheckbox
                    module="expenses"
                    checked={newCategoryModules.includes('expenses')}
                    onChange={() => {
                      const newModules = toggleModule(newCategoryModules, 'expenses');
                      setNewCategoryModules(newModules as Module[]);
                    }}
                    label="Dépenses"
                  />
                  <ModuleCheckbox
                    module="stock"
                    checked={newCategoryModules.includes('stock')}
                    onChange={() => {
                      const newModules = toggleModule(newCategoryModules, 'stock');
                      setNewCategoryModules(newModules as Module[]);
                    }}
                    label="Stock"
                  />
                </div>
              </div>
              <button
                onClick={handleCreateCategory}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus size={18} />
                Ajouter la catégorie
              </button>
            </div>

            {/* Liste des catégories */}
            <div>
              <h3 className="text-lg font-semibold mb-4">
                Catégories ({categories.length})
              </h3>
              {categories.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Aucune catégorie
                </p>
              ) : (
                <div className="space-y-2">
                  {categories.map((category) => {
                    const editingCategory = getEditingCategory(category.id);
                    const currentModules = (editingCategory.modules || category.modules || []) as string[];
                    const hasChanges = editingCategories[category.id] !== undefined;
                    
                    return (
                      <div
                        key={category.id}
                        className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <input
                              type="text"
                              value={editingCategory.name || ''}
                              onChange={(e) => handleCategoryFieldChange(category.id, 'name', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Nom"
                            />
                            <input
                              type="text"
                              value={editingCategory.description || ''}
                              onChange={(e) => handleCategoryFieldChange(category.id, 'description', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Description"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Modules où cette catégorie apparaît
                            </label>
                            <div className="flex gap-6">
                              <ModuleCheckbox
                                module="expenses"
                                checked={currentModules.includes('expenses')}
                                onChange={() => handleToggleCategoryModule(category.id, 'expenses')}
                                label="Dépenses"
                              />
                              <ModuleCheckbox
                                module="stock"
                                checked={currentModules.includes('stock')}
                                onChange={() => handleToggleCategoryModule(category.id, 'stock')}
                                label="Stock"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex gap-2">
                              {hasChanges && (
                                <button
                                  onClick={() => handleUpdateCategory(category.id)}
                                  className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 text-sm"
                                >
                                  <Save size={16} />
                                  Enregistrer
                                </button>
                              )}
                              {hasChanges && (
                                <button
                                  onClick={() => {
                                    const newEditing = { ...editingCategories };
                                    delete newEditing[category.id];
                                    setEditingCategories(newEditing);
                                  }}
                                  className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 flex items-center gap-2 text-sm"
                                >
                                  <X size={16} />
                                  Annuler
                                </button>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteCategory(category.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6">
            {/* Formulaire de création */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Nouveau fournisseur</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Fournisseur ABC..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact
                  </label>
                  <input
                    type="text"
                    value={newSupplierContact}
                    onChange={(e) => setNewSupplierContact(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Téléphone, email..."
                  />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Modules où ce fournisseur apparaît *
                </label>
                <div className="flex gap-6">
                  <ModuleCheckbox
                    module="expenses"
                    checked={newSupplierModules.includes('expenses')}
                    onChange={() => {
                      const newModules = toggleModule(newSupplierModules, 'expenses');
                      setNewSupplierModules(newModules as Module[]);
                    }}
                    label="Dépenses"
                  />
                  <ModuleCheckbox
                    module="stock"
                    checked={newSupplierModules.includes('stock')}
                    onChange={() => {
                      const newModules = toggleModule(newSupplierModules, 'stock');
                      setNewSupplierModules(newModules as Module[]);
                    }}
                    label="Stock"
                  />
                </div>
              </div>
              <button
                onClick={handleCreateSupplier}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus size={18} />
                Ajouter le fournisseur
              </button>
            </div>

            {/* Liste des fournisseurs */}
            <div>
              <h3 className="text-lg font-semibold mb-4">
                Fournisseurs ({suppliers.length})
              </h3>
              {suppliers.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Aucun fournisseur
                </p>
              ) : (
                <div className="space-y-2">
                  {suppliers.map((supplier) => {
                    const editingSupplier = getEditingSupplier(supplier.id);
                    const currentModules = (editingSupplier.modules || supplier.modules || []) as string[];
                    const hasChanges = editingSuppliers[supplier.id] !== undefined;
                    
                    return (
                      <div
                        key={supplier.id}
                        className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <input
                              type="text"
                              value={editingSupplier.name || ''}
                              onChange={(e) => handleSupplierFieldChange(supplier.id, 'name', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Nom"
                            />
                            <input
                              type="text"
                              value={editingSupplier.contact_info || ''}
                              onChange={(e) => handleSupplierFieldChange(supplier.id, 'contact_info', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Contact"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Modules où ce fournisseur apparaît
                            </label>
                            <div className="flex gap-6">
                              <ModuleCheckbox
                                module="expenses"
                                checked={currentModules.includes('expenses')}
                                onChange={() => handleToggleSupplierModule(supplier.id, 'expenses')}
                                label="Dépenses"
                              />
                              <ModuleCheckbox
                                module="stock"
                                checked={currentModules.includes('stock')}
                                onChange={() => handleToggleSupplierModule(supplier.id, 'stock')}
                                label="Stock"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex gap-2">
                              {hasChanges && (
                                <button
                                  onClick={() => handleUpdateSupplier(supplier.id)}
                                  className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 text-sm"
                                >
                                  <Save size={16} />
                                  Enregistrer
                                </button>
                              )}
                              {hasChanges && (
                                <button
                                  onClick={() => {
                                    const newEditing = { ...editingSuppliers };
                                    delete newEditing[supplier.id];
                                    setEditingSuppliers(newEditing);
                                  }}
                                  className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 flex items-center gap-2 text-sm"
                                >
                                  <X size={16} />
                                  Annuler
                                </button>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteSupplier(supplier.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Category, User } from '../../types';
import { X, Plus, Folder } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CategoryQuickCreateProps {
  onClose: () => void;
  onCategoryCreated: (category: Category) => void;
  user: User;
}

export const CategoryQuickCreate: React.FC<CategoryQuickCreateProps> = ({ onClose, onCategoryCreated, user }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Le nom de la catégorie est requis');
      return;
    }

    setLoading(true);
    try {
      // Préparer les données, n'inclure description que si une valeur existe
      const categoryData: any = {
        name: formData.name.trim(),
        modules: ['stock'] // Ce composant est utilisé pour le stock
      };
      
      // Ajouter description seulement si on a une valeur
      if (formData.description.trim()) {
        categoryData.description = formData.description.trim();
      }

      const { data, error } = await supabase
        .from('categories')
        .insert(categoryData)
        .select()
        .single();

      if (error) throw error;

      onCategoryCreated(data);
    } catch (error: any) {
      console.error('Erreur lors de la création de la catégorie:', error);
      let errorMessage = 'Erreur lors de la création de la catégorie';
      
      if (error?.code === '23505') {
        errorMessage = 'Une catégorie avec ce nom existe déjà';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]">
      <div className="bg-white rounded-lg w-full max-w-md z-[81]">
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-lg font-bold flex items-center">
            <Folder className="h-5 w-5 mr-2" />
            {t('supply.createCategory') || 'Créer une nouvelle catégorie'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('supply.categoryName') || 'Nom de la catégorie'} *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Nom de la catégorie"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('supply.description') || 'Description'}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={3}
              placeholder="Description de la catégorie (optionnel)"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              {t('app.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {loading ? (t('app.creating') || 'Création...') : (t('supply.createCategory') || 'Créer la catégorie')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


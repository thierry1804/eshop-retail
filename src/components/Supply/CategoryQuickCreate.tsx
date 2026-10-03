import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Category, User } from '../../types';
import { X, Plus, Folder } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Offcanvas, OffcanvasHeader, OffcanvasBody, OffcanvasFooter } from '../ui/Offcanvas';

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
      const categoryData: any = {
        name: formData.name.trim(),
        modules: ['stock']
      };
      
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
    <Offcanvas onClose={onClose} width="md" panelZ={90} backdropZ={85}>
      <OffcanvasHeader>
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold flex items-center">
            <Folder className="h-5 w-5 mr-2" />
            {t('supply.createCategory') || 'Créer une nouvelle catégorie'}
          </h3>
          <button onClick={onClose} className="app-text-muted hover:text-[var(--app-ink-muted)]">
            <X className="h-5 w-5" />
          </button>
        </div>
      </OffcanvasHeader>

      <form id="category-quick-form" onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <OffcanvasBody className="space-y-4">
          <div>
            <label className="app-label mb-1">
              {t('supply.categoryName') || 'Nom de la catégorie'} *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full border app-border rounded-md px-3 py-2"
              placeholder="Nom de la catégorie"
            />
          </div>

          <div>
            <label className="app-label mb-1">
              {t('supply.description') || 'Description'}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full border app-border rounded-md px-3 py-2"
              rows={3}
              placeholder="Description de la catégorie (optionnel)"
            />
          </div>
        </OffcanvasBody>

        <OffcanvasFooter>
          <div className="app-actions">
            <button
              type="button"
              onClick={onClose}
              className="app-btn app-btn-secondary app-btn-sm"
            >
              {t('app.cancel')}
            </button>
            <button
              type="submit"
              form="category-quick-form"
              disabled={loading}
              className="app-btn app-btn-primary app-btn-sm"
            >
              <Plus className="h-4 w-4" />
              {loading ? (t('app.creating') || 'Création...') : (t('supply.createCategory') || 'Créer la catégorie')}
            </button>
          </div>
        </OffcanvasFooter>
      </form>
    </Offcanvas>
  );
};

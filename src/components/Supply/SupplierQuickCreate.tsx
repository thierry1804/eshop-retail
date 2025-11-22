import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Supplier, User } from '../../types';
import { X, Plus, Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SupplierQuickCreateProps {
  onClose: () => void;
  onSupplierCreated: (supplier: Supplier) => void;
  user: User;
}

export const SupplierQuickCreate: React.FC<SupplierQuickCreateProps> = ({ onClose, onSupplierCreated, user }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    contact_info: '',
    email: '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Le nom du fournisseur est requis');
      return;
    }

    setLoading(true);
    try {
      // Construire contact_info avec email et téléphone si fournis
      let contactInfo = formData.contact_info.trim();
      if (formData.email || formData.phone) {
        const parts = [];
        if (formData.email) parts.push(`Email: ${formData.email}`);
        if (formData.phone) parts.push(`Tél: ${formData.phone}`);
        if (contactInfo) parts.push(contactInfo);
        contactInfo = parts.join(' | ');
      }

      // Préparer les données, n'inclure contact_info que si une valeur existe
      const supplierData: any = {
        name: formData.name.trim(),
        modules: ['stock'] // Ce composant est utilisé pour le stock
      };
      
      // Ajouter contact_info seulement si on a une valeur
      if (contactInfo) {
        supplierData.contact_info = contactInfo;
      }

      const { data, error } = await supabase
        .from('suppliers')
        .insert(supplierData)
        .select()
        .single();

      if (error) throw error;

      onSupplierCreated(data);
    } catch (error: any) {
      console.error('Erreur lors de la création du fournisseur:', error);
      let errorMessage = 'Erreur lors de la création du fournisseur';
      
      if (error?.code === '23505') {
        errorMessage = 'Un fournisseur avec ce nom existe déjà';
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
            <Building2 className="h-5 w-5 mr-2" />
            {t('supply.createSupplier') || 'Créer un nouveau fournisseur'}
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
              {t('supply.supplierName') || 'Nom du fournisseur'} *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Nom du fournisseur"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="email@exemple.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Téléphone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="+261 XX XX XXX XX"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('supply.contactInfo') || 'Autres informations de contact'}
            </label>
            <textarea
              value={formData.contact_info}
              onChange={(e) => setFormData({...formData, contact_info: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={2}
              placeholder="Adresse, autres coordonnées..."
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
              {loading ? (t('app.creating') || 'Création...') : (t('supply.createSupplier') || 'Créer le fournisseur')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


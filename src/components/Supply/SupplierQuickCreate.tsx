import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Supplier, User } from '../../types';
import { X, Plus, Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Offcanvas, OffcanvasHeader, OffcanvasBody, OffcanvasFooter } from '../ui/Offcanvas';

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
      let contactInfo = formData.contact_info.trim();
      if (formData.email || formData.phone) {
        const parts = [];
        if (formData.email) parts.push(`Email: ${formData.email}`);
        if (formData.phone) parts.push(`Tél: ${formData.phone}`);
        if (contactInfo) parts.push(contactInfo);
        contactInfo = parts.join(' | ');
      }

      const supplierData: any = {
        name: formData.name.trim(),
        modules: ['stock']
      };
      
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
    <Offcanvas onClose={onClose} width="md" panelZ={90} backdropZ={85}>
      <OffcanvasHeader>
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold flex items-center">
            <Building2 className="h-5 w-5 mr-2" />
            {t('supply.createSupplier') || 'Créer un nouveau fournisseur'}
          </h3>
          <button onClick={onClose} className="app-text-muted hover:text-[var(--app-ink-muted)]">
            <X className="h-5 w-5" />
          </button>
        </div>
      </OffcanvasHeader>

      <form id="supplier-quick-form" onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <OffcanvasBody className="space-y-4">
          <div>
            <label className="app-label mb-1">
              {t('supply.supplierName') || 'Nom du fournisseur'} *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full border app-border rounded-md px-3 py-2"
              placeholder="Nom du fournisseur"
            />
          </div>

          <div>
            <label className="app-label mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full border app-border rounded-md px-3 py-2"
              placeholder="email@exemple.com"
            />
          </div>

          <div>
            <label className="app-label mb-1">Téléphone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="w-full border app-border rounded-md px-3 py-2"
              placeholder="+261 XX XX XXX XX"
            />
          </div>

          <div>
            <label className="app-label mb-1">
              {t('supply.contactInfo') || 'Autres informations de contact'}
            </label>
            <textarea
              value={formData.contact_info}
              onChange={(e) => setFormData({...formData, contact_info: e.target.value})}
              className="w-full border app-border rounded-md px-3 py-2"
              rows={2}
              placeholder="Adresse, autres coordonnées..."
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
              form="supplier-quick-form"
              disabled={loading}
              className="app-btn app-btn-primary app-btn-sm"
            >
              <Plus className="h-4 w-4" />
              {loading ? (t('app.creating') || 'Création...') : (t('supply.createSupplier') || 'Créer le fournisseur')}
            </button>
          </div>
        </OffcanvasFooter>
      </form>
    </Offcanvas>
  );
};

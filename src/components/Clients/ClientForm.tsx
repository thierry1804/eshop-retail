import React, { useState } from 'react';
import { X, Save, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { Client } from '../../types';
import { logger } from '../../lib/logger';
import { findClientByPhone } from '../../lib/clientUtils';
import { Offcanvas, OffcanvasHeader, OffcanvasBody, OffcanvasFooter } from '../ui/Offcanvas';

interface ClientFormProps {
  client?: Client;
  onClose: () => void;
  onSubmit: () => void;
}

export const ClientForm: React.FC<ClientFormProps> = ({ client, onClose, onSubmit }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    first_name: client?.first_name || '',
    last_name: client?.last_name || '',
    phone: client?.phone || '',
    address: client?.address || '',
    trust_rating: client?.trust_rating || 'good' as const,
    notes: client?.notes || '',
    tiktok_id: client?.tiktok_id || '',
    tiktok_nick_name: client?.tiktok_nick_name || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (client) {
        await logger.logCRUDAction('UPDATE', 'clients', client.id, formData);

        const { error } = await supabase
          .from('clients')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', client.id);
        
        if (error) throw error;

        await logger.logFormSubmit('ClientForm', formData, true);
      } else {
        const existingClient = await findClientByPhone(formData.phone);
        
        if (existingClient) {
          setError('Un client avec ce numéro de téléphone existe déjà. Veuillez le sélectionner dans la liste.');
          setLoading(false);
          return;
        }

        await logger.logCRUDAction('CREATE', 'clients', 'new', formData);

        const { error } = await supabase
          .from('clients')
          .insert({
            ...formData,
            created_by: user?.id,
          });
        
        if (error) throw error;

        await logger.logFormSubmit('ClientForm', formData, true);
      }
      
      onSubmit();
    } catch (error: any) {
      await logger.logError(error, 'ClientForm.handleSubmit');
      await logger.logFormSubmit('ClientForm', formData, false);
      setError(t('clients.saveError') + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Offcanvas onClose={onClose} width="md">
      <OffcanvasHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <User className="app-text-link flex-shrink-0 h-5 w-5" />
            <h2 className="text-lg font-semibold app-text truncate">
              {client ? t('clients.editClient') : t('clients.newClient')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="app-icon-btn flex-shrink-0"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </OffcanvasHeader>

      <form id="client-form" onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <OffcanvasBody className="space-y-3">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="client-first_name" className="app-label">
                {t('clients.form.firstName')} *
              </label>
              <input
                id="client-first_name"
                type="text"
                required
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="app-input"
                placeholder={t('clients.form.firstNamePlaceholder')}
              />
            </div>
            <div>
              <label htmlFor="client-last_name" className="app-label">
                {t('clients.form.lastName')} *
              </label>
              <input
                id="client-last_name"
                type="text"
                required
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="app-input"
                placeholder={t('clients.form.lastNamePlaceholder')}
              />
            </div>
          </div>

          <div>
            <label htmlFor="client-phone" className="app-label">
              {t('clients.form.phone')} *
            </label>
            <input
              id="client-phone"
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="app-input"
              placeholder={t('clients.form.phonePlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="client-address" className="app-label">
              {t('clients.form.address')} *
            </label>
            <textarea
              id="client-address"
              required
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={3}
              className="app-input"
              placeholder={t('clients.form.addressPlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="client-trust_rating" className="app-label">
              {t('clients.form.trustRating')}
            </label>
            <select
              id="client-trust_rating"
              value={formData.trust_rating}
              onChange={(e) => setFormData({ ...formData, trust_rating: e.target.value as any })}
              className="app-input"
            >
              <option value="good">✅ {t('common.goodPayer')}</option>
              <option value="average">⚠️ {t('common.averagePayer')}</option>
              <option value="poor">❌ {t('common.poorPayer')}</option>
            </select>
          </div>

          <div>
            <label htmlFor="client-notes" className="app-label">
              {t('clients.form.notes')}
            </label>
            <textarea
              id="client-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="app-input"
              placeholder={t('clients.form.notesPlaceholder')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="client-tiktok_id" className="app-label">
                {t('clients.form.tiktokId')}
              </label>
              <input
                id="client-tiktok_id"
                type="text"
                value={formData.tiktok_id}
                onChange={(e) => setFormData({ ...formData, tiktok_id: e.target.value })}
                className="app-input"
                placeholder={t('clients.form.tiktokIdPlaceholder')}
              />
            </div>
            <div>
              <label htmlFor="client-tiktok_nick_name" className="app-label">
                {t('clients.form.tiktokNickName')}
              </label>
              <input
                id="client-tiktok_nick_name"
                type="text"
                value={formData.tiktok_nick_name}
                onChange={(e) => setFormData({ ...formData, tiktok_nick_name: e.target.value })}
                className="app-input"
                placeholder={t('clients.form.tiktokNickNamePlaceholder')}
              />
            </div>
          </div>
        </OffcanvasBody>

        <OffcanvasFooter>
          <div className="app-actions flex-col-reverse sm:flex-row w-full">
            <button
              type="button"
              onClick={onClose}
              className="app-btn app-btn-secondary w-full sm:flex-1 app-btn-sm"
            >
              {t('app.cancel')}
            </button>
            <button
              type="submit"
              form="client-form"
              disabled={loading}
              className="app-btn app-btn-primary w-full sm:flex-1 app-btn-sm"
            >
              <Save className="h-4 w-4" />
              <span>{loading ? t('clients.saving') : t('app.save')}</span>
            </button>
          </div>
        </OffcanvasFooter>
      </form>
    </Offcanvas>
  );
};

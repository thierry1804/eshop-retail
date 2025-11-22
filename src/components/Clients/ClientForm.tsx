import React, { useState } from 'react';
import { X, Save, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { Client } from '../../types';
import { logger } from '../../lib/logger';

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
        // Logger l'action de mise à jour
        await logger.logCRUDAction('UPDATE', 'clients', client.id, formData);

        // Update existing client
        const { error } = await supabase
          .from('clients')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', client.id);
        
        if (error) throw error;

        // Logger le succès de la mise à jour
        await logger.logFormSubmit('ClientForm', formData, true);
      } else {
        // Logger l'action de création
        await logger.logCRUDAction('CREATE', 'clients', 'new', formData);

        // Create new client
        const { error } = await supabase
          .from('clients')
          .insert({
            ...formData,
            created_by: user?.id,
          });
        
        if (error) throw error;

        // Logger le succès de la création
        await logger.logFormSubmit('ClientForm', formData, true);
      }
      
      onSubmit();
    } catch (error: any) {
      // Logger l'erreur
      await logger.logError(error, 'ClientForm.handleSubmit');
      await logger.logFormSubmit('ClientForm', formData, false);
      setError(t('clients.saveError') + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        {/* En-tête fixe */}
        <div className="flex items-center justify-between p-3 sm:p-4 md:p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center space-x-2 min-w-0">
            <User className="text-blue-600 flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6" />
            <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 truncate">
              {client ? t('clients.editClient') : t('clients.newClient')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 ml-2"
          >
            <X size={20} className="sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Zone de contenu scrollable */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-md text-xs sm:text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  {t('clients.form.firstName')} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                  placeholder={t('clients.form.firstNamePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  {t('clients.form.lastName')} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                  placeholder={t('clients.form.lastNamePlaceholder')}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                {t('clients.form.phone')} *
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                placeholder={t('clients.form.phonePlaceholder')}
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                {t('clients.form.address')} *
              </label>
              <textarea
                required
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                placeholder={t('clients.form.addressPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                {t('clients.form.trustRating')}
              </label>
              <select
                value={formData.trust_rating}
                onChange={(e) => setFormData({ ...formData, trust_rating: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
              >
                <option value="good">✅ {t('common.goodPayer')}</option>
                <option value="average">⚠️ {t('common.averagePayer')}</option>
                <option value="poor">❌ {t('common.poorPayer')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                {t('clients.form.notes')}
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                placeholder={t('clients.form.notesPlaceholder')}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  {t('clients.form.tiktokId')}
                </label>
                <input
                  type="text"
                  value={formData.tiktok_id}
                  onChange={(e) => setFormData({ ...formData, tiktok_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                  placeholder={t('clients.form.tiktokIdPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  {t('clients.form.tiktokNickName')}
                </label>
                <input
                  type="text"
                  value={formData.tiktok_nick_name}
                  onChange={(e) => setFormData({ ...formData, tiktok_nick_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                  placeholder={t('clients.form.tiktokNickNamePlaceholder')}
                />
              </div>
            </div>
          </form>
        </div>

        {/* Pied de page fixe avec boutons */}
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 p-3 sm:p-4 md:p-6 border-t border-gray-200 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:flex-1 px-3 sm:px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors text-sm sm:text-base"
          >
            {t('app.cancel')}
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full sm:flex-1 flex items-center justify-center space-x-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm sm:text-base"
          >
            <Save size={16} className="sm:w-[18px] sm:h-[18px]" />
            <span>{loading ? t('clients.saving') : t('app.save')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
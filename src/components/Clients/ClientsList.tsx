import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Eye, Phone, MapPin, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ClientForm } from './ClientForm';
import { ClientDetails } from './ClientDetails';
import { supabase } from '../../lib/supabase';
import { Client, User } from '../../types';
import { logger } from '../../lib/logger';

interface ClientsListProps {
  user: User;
}

export const ClientsList: React.FC<ClientsListProps> = ({ user }) => {
  const { t } = useTranslation();
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('👥 ClientsList: Initialisation de la liste des clients');
    fetchClients();
  }, []);

  useEffect(() => {
    const filtered = clients.filter(client =>
      `${client.first_name} ${client.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone.includes(searchTerm) ||
      (client.tiktok_id && client.tiktok_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (client.tiktok_nick_name && client.tiktok_nick_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredClients(filtered);
  }, [clients, searchTerm]);

  const fetchClients = async () => {
    console.log('👥 ClientsList: Récupération des clients...');
    const startTime = performance.now();
    
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ ClientsList: Erreur récupération clients:', error);
        throw error;
      }
      
      console.log(`✅ ClientsList: ${data?.length || 0} clients récupérés`);
      setClients(data || []);
    } catch (error) {
      console.error('❌ ClientsList: Erreur lors de la récupération des clients:', error);
    } finally {
      const endTime = performance.now();
      console.log(`⏱️ ClientsList: Récupération terminée en ${(endTime - startTime).toFixed(2)}ms`);
      setLoading(false);
    }
  };

  const handleDelete = async (client: Client) => {
    if (!confirm(t('clients.confirmDelete', { name: `${client.first_name} ${client.last_name}` }))) {
      return;
    }

    try {
      // Logger l'action de suppression
      await logger.logCRUDAction('DELETE', 'clients', client.id, client);

      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id);

      if (error) throw error;

      // Logger le succès
      await logger.logUserAction('CLIENT_DELETED', 'ClientsList', {
        clientId: client.id,
        clientName: `${client.first_name} ${client.last_name}`,
        success: true
      });

      fetchClients();
    } catch (error: any) {
      // Logger l'erreur
      await logger.logError(error, 'ClientsList.handleDelete');
      alert(t('clients.deleteError') + ': ' + error.message);
    }
  };

  const getTrustRatingDisplay = (rating: string) => {
    switch (rating) {
      case 'good':
        return { label: `✅ ${t('common.goodPayer')}`, className: 'text-green-600 bg-green-100' };
      case 'average':
        return { label: `⚠️ ${t('common.averagePayer')}`, className: 'text-yellow-600 bg-yellow-100' };
      case 'poor':
        return { label: `❌ ${t('common.poorPayer')}`, className: 'text-red-600 bg-red-100' };
      default:
        return { label: t('common.notEvaluated'), className: 'text-gray-600 bg-gray-100' };
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('clients.title')}</h1>
        <button
          onClick={async () => {
            // Logger l'action de création
            await logger.logUserAction('CREATE_NEW_CLIENT', 'ClientsList', {});
            setSelectedClient(null);
            setShowForm(true);
          }}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          <span>{t('clients.newClient')}</span>
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder={t('clients.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Clients List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('clients.table.client')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('clients.table.contact')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('clients.table.trust')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('clients.table.createdAt')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredClients.map((client) => {
                const trustDisplay = getTrustRatingDisplay(client.trust_rating);
                return (
                  <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-medium">
                            {client.first_name[0]}{client.last_name[0]}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {client.first_name} {client.last_name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="flex items-center text-sm text-gray-900">
                          <Phone size={14} className="mr-2 text-gray-400" />
                          {client.phone}
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <MapPin size={14} className="mr-2 text-gray-400" />
                          <span className="truncate max-w-32">{client.address}</span>
                        </div>
                        {(client.tiktok_id || client.tiktok_nick_name) && (
                          <div className="flex items-center text-sm text-gray-500">
                            <Video size={14} className="mr-2 text-gray-400" />
                            <span className="truncate max-w-32">
                              {client.tiktok_nick_name ? `@${client.tiktok_nick_name}` : client.tiktok_id}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${trustDisplay.className}`}>
                        {trustDisplay.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(client.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={async () => {
                            // Logger l'action de visualisation
                            await logger.logUserAction('VIEW_CLIENT_DETAILS', 'ClientsList', {
                              clientId: client.id,
                              clientName: `${client.first_name} ${client.last_name}`
                            });
                            setSelectedClient(client);
                            setShowDetails(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                          title={t('clients.viewDetails')}
                        >
                          <Eye size={18} />
                        </button>
                        {/* Seuls les admins peuvent modifier et supprimer */}
                        {user.role === 'admin' && (
                          <>
                            <button
                              onClick={async () => {
                                // Logger l'action de modification
                                await logger.logUserAction('EDIT_CLIENT', 'ClientsList', {
                                  clientId: client.id,
                                  clientName: `${client.first_name} ${client.last_name}`
                                });
                                setSelectedClient(client);
                                setShowForm(true);
                              }}
                              className="text-yellow-600 hover:text-yellow-800 transition-colors"
                              title={t('common.edit')}
                            >
                              <Edit size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(client)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                              title={t('common.delete')}
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredClients.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">
              {searchTerm ? t('clients.noClientsFound') : t('clients.noClients')}
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <ClientForm
          client={selectedClient}
          onClose={() => {
            setShowForm(false);
            setSelectedClient(null);
          }}
          onSubmit={() => {
            setShowForm(false);
            setSelectedClient(null);
            fetchClients();
          }}
        />
      )}

      {showDetails && selectedClient && (
        <ClientDetails
          client={selectedClient}
          onClose={() => {
            setShowDetails(false);
            setSelectedClient(null);
          }}
        />
      )}
    </div>
  );
};
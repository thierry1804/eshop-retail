import React, { useState, useEffect, useRef } from 'react';
import { devLog } from '../../lib/devLog';
import { Plus, Edit, Trash2, Eye, Phone, MapPin, Video } from 'lucide-react';
import { SearchField } from '../ui/SearchField';
import { useTranslation } from 'react-i18next';
import { ClientForm } from './ClientForm';
import { ClientDetails } from './ClientDetails';
import { supabase } from '../../lib/supabase';
import { Client, User } from '../../types';
import { logger } from '../../lib/logger';
import { DataTable, dtTh, dtThRight, dtTd, dtTdMuted, dtTdWrap } from '../ui/DataTable';
import { formatDateDisplay } from '../../lib/dateUtils';

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

  // Flag pour éviter les chargements multiples au montage
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    // Ne charger qu'une seule fois au montage
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      devLog('👥 ClientsList: Initialisation de la liste des clients');
      fetchClients();
    }
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
    devLog('👥 ClientsList: Récupération des clients...');
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
      
      devLog(`✅ ClientsList: ${data?.length || 0} clients récupérés`);
      setClients(data || []);
    } catch (error) {
      console.error('❌ ClientsList: Erreur lors de la récupération des clients:', error);
    } finally {
      const endTime = performance.now();
      devLog(`⏱️ ClientsList: Récupération terminée en ${(endTime - startTime).toFixed(2)}ms`);
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
        return { label: `✅ ${t('common.goodPayer')}`, className: 'app-badge app-badge-success' };
      case 'average':
        return { label: `⚠️ ${t('common.averagePayer')}`, className: 'text-yellow-600 bg-yellow-100' };
      case 'poor':
        return { label: `❌ ${t('common.poorPayer')}`, className: 'app-badge app-badge-danger' };
      default:
        return { label: t('common.notEvaluated'), className: 'app-badge' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--app-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="app-sticky-chrome space-y-2">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <div className="min-w-0">
            <h1 className="app-page-title">{t('clients.title')}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={async () => {
                // Logger l'action de création
                await logger.logUserAction('CREATE_NEW_CLIENT', 'ClientsList', {});
                setSelectedClient(null);
                setShowForm(true);
              }}
              className="app-btn app-btn-primary app-btn-sm whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t('clients.newClient')}</span>
            </button>
          </div>
        </div>

        <div className="app-toolbar">
          <SearchField
            className="min-w-[12rem]"
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t('clients.searchPlaceholder')}
            inputClassName="text-xs py-1.5"
          />
        </div>
      </div>

      {/* Clients List - Mobile Card View */}
      <div className="md:hidden space-y-3">
        {filteredClients.map((client) => {
          const trustDisplay = getTrustRatingDisplay(client.trust_rating);
          return (
            <div key={client.id} className="app-list-card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[color-mix(in_srgb,var(--app-primary)_12%,var(--app-surface))] flex items-center justify-center flex-shrink-0">
                    <span className="app-text-link font-medium text-sm">
                      {client.first_name[0]}{client.last_name[0]}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium app-text truncate">
                      {client.first_name} {client.last_name}
                    </div>
                    <div className="flex items-center text-xs app-text-muted mt-1">
                      <Phone size={12} className="mr-1 app-text-muted" />
                      <span className="truncate">{client.phone}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-2">
                  <button
                    onClick={async () => {
                      await logger.logUserAction('VIEW_CLIENT_DETAILS', 'ClientsList', {
                        clientId: client.id,
                        clientName: `${client.first_name} ${client.last_name}`
                      });
                      setSelectedClient(client);
                      setShowDetails(true);
                    }}
                    className="app-icon-btn app-icon-btn-primary"
                    title={t('clients.viewDetails')}
                    aria-label={t('clients.viewDetails')}
                  >
                    <Eye size={18} />
                  </button>
                  {user.role === 'admin' && (
                    <>
                      <button
                        onClick={async () => {
                          await logger.logUserAction('EDIT_CLIENT', 'ClientsList', {
                            clientId: client.id,
                            clientName: `${client.first_name} ${client.last_name}`
                          });
                          setSelectedClient(client);
                          setShowForm(true);
                        }}
                        className="app-icon-btn"
                        title={t('common.edit')}
                        aria-label={t('common.edit')}
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(client)}
                        className="app-icon-btn app-icon-btn-danger"
                        title={t('common.delete')}
                        aria-label={t('common.delete')}
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-2 text-xs pt-2 border-t app-divider">
                {client.address && (
                  <div className="flex items-center app-text-muted">
                    <MapPin size={12} className="mr-2 app-text-muted" />
                    <span className="truncate">{client.address}</span>
                  </div>
                )}
                {(client.tiktok_id || client.tiktok_nick_name) && (
                  <div className="flex items-center app-text-muted">
                    <Video size={12} className="mr-2 app-text-muted" />
                    <span className="truncate">
                      {client.tiktok_nick_name ? `@${client.tiktok_nick_name}` : client.tiktok_id}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t app-divider">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${trustDisplay.className}`}>
                    {trustDisplay.label}
                  </span>
                  <span className="app-text-muted">
                    {formatDateDisplay(client.created_at)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {filteredClients.length === 0 && (
          <div className="app-empty">
            <p className="app-empty-text">
              {searchTerm ? t('clients.noClientsFound') : t('clients.noClients')}
            </p>
          </div>
        )}
      </div>

      {/* Clients List - Desktop Table View */}
      <div className="hidden md:block app-table-wrap">
        <DataTable>
            <thead className="app-bg-muted">
              <tr>
                <th className={dtTh}>{t('clients.table.client')}</th>
                <th className={dtTh}>{t('clients.table.contact')}</th>
                <th className={dtTh}>{t('clients.table.trust')}</th>
                <th className={dtTh}>{t('clients.table.createdAt')}</th>
                <th className={dtThRight}>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-[var(--app-border)]">
              {filteredClients.map((client) => {
                const trustDisplay = getTrustRatingDisplay(client.trust_rating);
                return (
                  <tr key={client.id} className="hover:bg-[var(--app-surface-muted)] transition-colors">
                    <td className={dtTd}>
                      <div className="flex items-center">
                        <div className="w-7 h-7 rounded-full bg-[color-mix(in_srgb,var(--app-primary)_12%,var(--app-surface))] flex items-center justify-center flex-shrink-0">
                          <span className="app-text-link font-medium text-[11px]">
                            {client.first_name[0]}{client.last_name[0]}
                          </span>
                        </div>
                        <div className="ml-2 min-w-0">
                          <div className="font-medium truncate">
                            {client.first_name} {client.last_name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={dtTdWrap}>
                      <div className="space-y-0.5">
                        <div className="flex items-center app-text">
                          <Phone size={13} className="mr-1.5 app-text-muted flex-shrink-0" />
                          {client.phone}
                        </div>
                        <div className="flex items-center app-text-muted">
                          <MapPin size={13} className="mr-1.5 app-text-muted flex-shrink-0" />
                          <span className="truncate max-w-32">{client.address}</span>
                        </div>
                        {(client.tiktok_id || client.tiktok_nick_name) && (
                          <div className="flex items-center app-text-muted">
                            <Video size={13} className="mr-1.5 app-text-muted flex-shrink-0" />
                            <span className="truncate max-w-32">
                              {client.tiktok_nick_name ? `@${client.tiktok_nick_name}` : client.tiktok_id}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className={dtTd}>
                      <span className={`inline-flex px-1.5 py-0.5 text-[11px] font-medium rounded-full ${trustDisplay.className}`}>
                        {trustDisplay.label}
                      </span>
                    </td>
                    <td className={dtTdMuted}>
                      {formatDateDisplay(client.created_at)}
                    </td>
                    <td className={`${dtTd} text-right font-medium`}>
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={async () => {
                            await logger.logUserAction('VIEW_CLIENT_DETAILS', 'ClientsList', {
                              clientId: client.id,
                              clientName: `${client.first_name} ${client.last_name}`
                            });
                            setSelectedClient(client);
                            setShowDetails(true);
                          }}
                          className="app-icon-btn app-icon-btn-primary"
                          title={t('clients.viewDetails')}
                          aria-label={t('clients.viewDetails')}
                        >
                          <Eye size={14} />
                        </button>
                        {user.role === 'admin' && (
                          <>
                            <button
                              onClick={async () => {
                                await logger.logUserAction('EDIT_CLIENT', 'ClientsList', {
                                  clientId: client.id,
                                  clientName: `${client.first_name} ${client.last_name}`
                                });
                                setSelectedClient(client);
                                setShowForm(true);
                              }}
                              className="app-icon-btn"
                              title={t('common.edit')}
                              aria-label={t('common.edit')}
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(client)}
                              className="app-icon-btn app-icon-btn-danger"
                              title={t('common.delete')}
                              aria-label={t('common.delete')}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
        </DataTable>

        {filteredClients.length === 0 && (
          <div className="app-empty">
            <p className="app-empty-text">
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
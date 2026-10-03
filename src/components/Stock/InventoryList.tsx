import React, { useState, useEffect } from 'react';
import { devLog, devWarn } from '../../lib/devLog';
import { supabase } from '../../lib/supabase';
import { Inventory, User } from '../../types';
import { Plus, Calendar, Filter, Eye, CheckCircle, Clock, FileX, XCircle } from 'lucide-react';
import { SearchField } from '../ui/SearchField';
import { InventoryForm } from './InventoryForm';
import { InventoryDetails } from './InventoryDetails';
import { StockPeriodClosuresList } from './StockPeriodClosuresList';
import { useTranslation } from 'react-i18next';
import { DataTable, dtTh, dtTd, dtTdMuted, dtTdWrap } from '../ui/DataTable';
import { formatDateDisplay } from '../../lib/dateUtils';

interface InventoryListProps {
  user: User;
}

export const InventoryList: React.FC<InventoryListProps> = ({ user }) => {
  const { t } = useTranslation();
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(null);

  useEffect(() => {
    fetchInventories();
  }, []);

  const fetchInventories = async () => {
    try {
      setLoading(true);
      devLog('🔍 Chargement des inventaires...');
      
      // Récupérer les inventaires
      const { data, error } = await supabase
        .from('inventories')
        .select('*')
        .order('inventory_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erreur lors de la récupération des inventaires:', error);
        throw error;
      }

      devLog(`✅ ${data?.length || 0} inventaire(s) récupéré(s)`, data);

      // Si des données sont retournées, récupérer les profils utilisateurs
      if (data && data.length > 0) {
        const userIds = new Set<string>();
        data.forEach(inv => {
          if (inv.created_by) {
            userIds.add(inv.created_by);
            devLog(`📝 Inventaire ${inv.id} créé par: ${inv.created_by}`);
          }
          if (inv.completed_by) userIds.add(inv.completed_by);
        });

        devLog(`👥 ${userIds.size} utilisateur(s) unique(s) à récupérer:`, Array.from(userIds));

        // Récupérer les profils utilisateurs seulement s'il y a des IDs
        if (userIds.size > 0) {
          const { data: userProfiles, error: profilesError } = await supabase
            .from('user_profiles')
            .select('id, email, name')
            .in('id', Array.from(userIds));

          // Déclarer authUsersMap avant le bloc if/else pour qu'il soit accessible partout
          const authUsersMap = new Map();
          let userProfilesData = userProfiles || [];

          if (profilesError) {
            console.error('❌ Erreur lors de la récupération des profils utilisateurs:', profilesError);
            console.error('Détails de l\'erreur:', {
              message: profilesError.message,
              details: profilesError.details,
              hint: profilesError.hint
            });
          } else {
            devLog(`✅ ${userProfilesData.length} profil(s) utilisateur(s) récupéré(s):`, userProfilesData);
          }

          // Vérifier les IDs manquants
          const foundIds = new Set(userProfilesData.map(p => p.id));
          const missingIds = Array.from(userIds).filter(id => !foundIds.has(id));
          
          // Récupérer les informations depuis auth.users pour les profils manquants
          if (missingIds.length > 0) {
            devLog(`🔍 Récupération des informations depuis auth.users pour ${missingIds.length} utilisateur(s) manquant(s)...`);
            
            // Récupérer les informations pour chaque utilisateur manquant
            for (const userId of missingIds) {
              try {
                const { data: authUserInfo, error: authError } = await supabase
                  .rpc('get_user_info', { user_id: userId });
                
                if (!authError && authUserInfo && authUserInfo.length > 0) {
                  const userInfo = authUserInfo[0];
                  // Créer un objet compatible avec user_profiles
                  authUsersMap.set(userId, {
                    id: userInfo.id,
                    email: userInfo.email,
                    name: userInfo.name || userInfo.full_name || userInfo.email || 'Utilisateur',
                    full_name: userInfo.full_name || userInfo.name || null
                  });
                  devLog(`✅ Informations récupérées depuis auth.users pour ${userId}:`, userInfo.name || userInfo.full_name);
                } else if (authError) {
                  devWarn(`⚠️ Erreur lors de la récupération des informations pour ${userId}:`, authError);
                }
              } catch (error) {
                devWarn(`⚠️ Erreur lors de l'appel à get_user_info pour ${userId}:`, error);
              }
            }
            
            if (missingIds.length > 0 && authUsersMap.size === 0) {
              devWarn(`⚠️ Aucune information récupérée depuis auth.users pour les IDs:`, missingIds);
            }
          }

          // Mapper les profils aux inventaires (user_profiles + auth.users)
          const profilesMap = new Map(
            userProfilesData.map(profile => [profile.id, profile])
          );
          
          // Ajouter les informations depuis auth.users
          authUsersMap.forEach((value, key) => {
            profilesMap.set(key, value);
          });

          const inventoriesWithUsers = data.map(inv => {
            const createdByUser = inv.created_by ? profilesMap.get(inv.created_by) : null;
            const completedByUser = inv.completed_by ? profilesMap.get(inv.completed_by) : null;
            
            if (inv.created_by && !createdByUser) {
              devWarn(`⚠️ Aucune information utilisateur trouvée pour created_by: ${inv.created_by} (inventaire: ${inv.id})`);
            }
            
            return {
              ...inv,
              created_by_user: createdByUser,
              completed_by_user: completedByUser,
            };
          });

          devLog('✅ Inventaires avec profils utilisateurs:', inventoriesWithUsers);
          setInventories(inventoriesWithUsers);
        } else {
          devLog('ℹ️ Aucun utilisateur associé aux inventaires');
          setInventories(data);
        }
      } else {
        devLog('ℹ️ Aucun inventaire trouvé dans la base de données');
        setInventories([]);
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des inventaires:', error);
      setInventories([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredInventories = inventories.filter(inventory => {
    const matchesSearch = 
      inventory.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inventory.inventory_date.includes(searchTerm) ||
      (inventory.notes && inventory.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = filterStatus === 'all' || inventory.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 app-text-link" />;
      case 'draft':
        return <FileX className="h-5 w-5 app-text-muted" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Terminé';
      case 'in_progress':
        return 'En cours';
      case 'draft':
        return 'Brouillon';
      case 'cancelled':
        return 'Annulé';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress':
        return 'app-badge-info border-[color-mix(in_srgb,var(--app-primary)_30%,var(--app-border))]';
      case 'draft':
        return 'app-badge border-[var(--app-border)]';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'app-badge border-[var(--app-border)]';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--app-primary)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="app-sticky-chrome space-y-2">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <div className="min-w-0">
          <h1 className="app-page-title">Inventaires</h1>
          <p className="app-page-subtitle">Gestion des inventaires de stock</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setShowForm(true)}
            className="app-btn app-btn-primary app-btn-sm whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            Nouvel inventaire
          </button>
        </div>
      </div>

      {/* Filtres et recherche */}
        <div className="app-toolbar">
          <SearchField
            className="min-w-[12rem]"
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Rechercher un inventaire..."
            inputClassName="text-xs py-1.5"
          />
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <Filter className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--app-ink-muted)' }} />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="app-input text-xs py-1.5 w-auto sm:min-w-[12rem]"
            >
              <option value="all">Tous les statuts</option>
              <option value="draft">Brouillon</option>
              <option value="in_progress">En cours</option>
              <option value="completed">Terminé</option>
              <option value="cancelled">Annulé</option>
            </select>
          </div>
        </div>
      </div>

      <StockPeriodClosuresList />

      {/* Liste des inventaires — mobile */}
      <div className="md:hidden space-y-3">
        {filteredInventories.map((inventory) => {
          const creator = (inventory as any).created_by_user;
          const creatorLabel = creator
            ? creator.full_name || creator.name || creator.email
            : inventory.created_by
              ? `${inventory.created_by.substring(0, 8)}…`
              : 'N/A';
          const progressPct =
            inventory.total_products > 0
              ? (inventory.counted_products / inventory.total_products) * 100
              : 0;
          return (
            <div key={inventory.id} className="app-list-card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Calendar className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--app-ink-muted)' }} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium app-text">
                      {formatDateDisplay(inventory.inventory_date)}
                    </div>
                    <div className="text-xs app-text-muted truncate">{creatorLabel}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium border ${getStatusColor(inventory.status)}`}>
                    {getStatusIcon(inventory.status)}
                    <span className="ml-1">{getStatusLabel(inventory.status)}</span>
                  </span>
                  <button
                    onClick={() => setSelectedInventory(inventory)}
                    className="app-icon-btn app-icon-btn-primary"
                    title="Voir"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="space-y-2 text-xs pt-2 border-t app-divider">
                <div className="flex justify-between">
                  <span className="app-text-muted">Produits</span>
                  <span className="app-text">{inventory.total_products}</span>
                </div>
                <div className="flex justify-between">
                  <span className="app-text-muted">Comptés</span>
                  <span className="app-text">
                    {inventory.counted_products} / {inventory.total_products}
                  </span>
                </div>
                <div className="w-full bg-[var(--app-border)] rounded-full h-1.5">
                  <div
                    className="bg-[var(--app-primary)] h-1.5 rounded-full"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex justify-between pt-2 border-t border-[var(--app-border)]">
                  <span className="app-text-muted">Écarts</span>
                  <span className="font-medium app-text">{inventory.total_discrepancies}</span>
                </div>
              </div>
            </div>
          );
        })}
        {filteredInventories.length === 0 && (
          <div className="app-empty">
            <Calendar className="h-12 w-12 mx-auto app-text-muted mb-4" />
            <p className="app-empty-text">Aucun inventaire trouvé</p>
            {searchTerm || filterStatus !== 'all' ? (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('all');
                }}
                className="mt-2 app-text-link hover:text-[var(--app-primary-deep)] text-sm"
              >
                Réinitialiser les filtres
              </button>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 app-btn app-btn-primary"
              >
                Créer le premier inventaire
              </button>
            )}
          </div>
        )}
      </div>

      {/* Liste des inventaires — desktop */}
      <div className="hidden md:block app-table-wrap">
        {filteredInventories.length === 0 ? (
          <div className="app-empty">
            <Calendar className="h-12 w-12 mx-auto app-text-muted mb-4" />
            <p className="app-empty-text">Aucun inventaire trouvé</p>
            {searchTerm || filterStatus !== 'all' ? (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('all');
                }}
                className="mt-2 app-text-link hover:text-[var(--app-primary-deep)] text-sm"
              >
                Réinitialiser les filtres
              </button>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 app-btn app-btn-primary"
              >
                Créer le premier inventaire
              </button>
            )}
          </div>
        ) : (
          <DataTable>
              <thead className="app-bg-muted">
                <tr>
                  <th className={dtTh}>Date</th>
                  <th className={dtTh}>Statut</th>
                  <th className={dtTh}>Produits</th>
                  <th className={dtTh}>Comptés</th>
                  <th className={dtTh}>Écarts</th>
                  <th className={dtTh}>Créé par</th>
                  <th className={dtTh}>Actions</th>
                </tr>
              </thead>
              <tbody className="bg-[var(--app-surface)] divide-y divide-[var(--app-border)]">
                {filteredInventories.map((inventory) => (
                  <tr key={inventory.id} className="hover:bg-[var(--app-surface-muted)]">
                    <td className={dtTd}>
                      <div className="flex items-center">
                        <Calendar className="h-3.5 w-3.5 app-text-muted mr-1.5 flex-shrink-0" />
                        <div>
                          {formatDateDisplay(inventory.inventory_date)}
                        </div>
                      </div>
                    </td>
                    <td className={dtTd}>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium border ${getStatusColor(inventory.status)}`}>
                        {getStatusIcon(inventory.status)}
                        <span className="ml-1">{getStatusLabel(inventory.status)}</span>
                      </span>
                    </td>
                    <td className={dtTd}>
                      {inventory.total_products}
                    </td>
                    <td className={dtTdWrap}>
                      <div>
                        {inventory.counted_products} / {inventory.total_products}
                      </div>
                      <div className="w-full bg-[var(--app-border)] rounded-full h-1.5 mt-1">
                        <div
                          className="bg-[var(--app-primary)] h-1.5 rounded-full"
                          style={{
                            width: `${inventory.total_products > 0 ? (inventory.counted_products / inventory.total_products) * 100 : 0}%`
                          }}
                        />
                      </div>
                    </td>
                    <td className={dtTd}>
                      {inventory.total_discrepancies}
                    </td>
                    <td className={dtTdMuted}>
                      {(() => {
                        const creator = (inventory as any).created_by_user;
                        if (creator) {
                          // Afficher le full_name si disponible, sinon name, sinon email
                          return creator.full_name || creator.name || creator.email || inventory.created_by || 'N/A';
                        }
                        // Si le profil n'existe pas mais created_by est défini, afficher l'ID tronqué
                        if (inventory.created_by) {
                          return inventory.created_by.substring(0, 8) + '...';
                        }
                        return 'N/A';
                      })()}
                    </td>
                    <td className={`${dtTd} font-medium`}>
                      <button
                        onClick={() => setSelectedInventory(inventory)}
                        className="app-icon-btn app-icon-btn-primary"
                        title="Voir"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Voir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
          </DataTable>
        )}
      </div>

      {/* Modales */}
      {showForm && (
        <InventoryForm
          user={user}
          onClose={() => setShowForm(false)}
          onSuccess={(inventoryId) => {
            fetchInventories();
            setShowForm(false);
            // Optionnel : rediriger vers les détails
            const newInventory = inventories.find(inv => inv.id === inventoryId);
            if (newInventory) {
              setSelectedInventory(newInventory);
            }
          }}
        />
      )}

      {selectedInventory && (
        <InventoryDetails
          inventory={selectedInventory}
          user={user}
          onClose={() => setSelectedInventory(null)}
          onUpdate={fetchInventories}
        />
      )}
    </div>
  );
};


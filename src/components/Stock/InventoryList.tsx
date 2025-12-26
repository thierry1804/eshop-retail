import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Inventory, User } from '../../types';
import { Plus, Search, Calendar, Filter, Eye, CheckCircle, Clock, FileX, XCircle } from 'lucide-react';
import { InventoryForm } from './InventoryForm';
import { InventoryDetails } from './InventoryDetails';
import { useTranslation } from 'react-i18next';

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
      console.log('🔍 Chargement des inventaires...');
      
      // Récupérer les inventaires sans jointure pour éviter les problèmes
      // Les jointures avec auth.users ne fonctionnent pas directement
      const { data, error } = await supabase
        .from('inventories')
        .select('*')
        .order('inventory_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erreur lors de la récupération des inventaires:', error);
        throw error;
      }

      console.log(`✅ ${data?.length || 0} inventaire(s) récupéré(s)`, data);

      // Si des données sont retournées, récupérer les profils utilisateurs séparément
      if (data && data.length > 0) {
        const userIds = new Set<string>();
        data.forEach(inv => {
          if (inv.created_by) userIds.add(inv.created_by);
          if (inv.completed_by) userIds.add(inv.completed_by);
        });

        // Récupérer les profils utilisateurs seulement s'il y a des IDs
        if (userIds.size > 0) {
          const { data: userProfiles, error: profilesError } = await supabase
            .from('user_profiles')
            .select('id, email, name')
            .in('id', Array.from(userIds));

          if (profilesError) {
            console.warn('⚠️ Erreur lors de la récupération des profils utilisateurs:', profilesError);
          }

          // Mapper les profils aux inventaires
          const profilesMap = new Map(
            (userProfiles || []).map(profile => [profile.id, profile])
          );

          const inventoriesWithUsers = data.map(inv => ({
            ...inv,
            created_by_user: inv.created_by ? profilesMap.get(inv.created_by) : null,
            completed_by_user: inv.completed_by ? profilesMap.get(inv.completed_by) : null,
          }));

          console.log('✅ Inventaires avec profils utilisateurs:', inventoriesWithUsers);
          setInventories(inventoriesWithUsers);
        } else {
          setInventories(data);
        }
      } else {
        console.log('ℹ️ Aucun inventaire trouvé dans la base de données');
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
        return <Clock className="h-5 w-5 text-blue-600" />;
      case 'draft':
        return <FileX className="h-5 w-5 text-gray-600" />;
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
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Inventaires</h1>
          <p className="text-sm sm:text-base text-gray-600">Gestion des inventaires de stock</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm sm:text-base"
        >
          <Plus className="h-4 w-4" />
          Nouvel inventaire
        </button>
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Rechercher un inventaire..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
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
      </div>

      {/* Liste des inventaires */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredInventories.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">Aucun inventaire trouvé</p>
            {searchTerm || filterStatus !== 'all' ? (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('all');
                }}
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                Réinitialiser les filtres
              </button>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Créer le premier inventaire
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Produits
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Comptés
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Écarts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Créé par
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInventories.map((inventory) => (
                  <tr key={inventory.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                        <div className="text-sm text-gray-900">
                          {new Date(inventory.inventory_date).toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(inventory.status)}`}>
                        {getStatusIcon(inventory.status)}
                        <span className="ml-1">{getStatusLabel(inventory.status)}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {inventory.total_products}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {inventory.counted_products} / {inventory.total_products}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full"
                          style={{
                            width: `${inventory.total_products > 0 ? (inventory.counted_products / inventory.total_products) * 100 : 0}%`
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {inventory.total_discrepancies}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(inventory as any).created_by_user?.email || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setSelectedInventory(inventory)}
                        className="text-blue-600 hover:text-blue-900 transition-colors flex items-center gap-1"
                      >
                        <Eye className="h-4 w-4" />
                        Voir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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


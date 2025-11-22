import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Eye, Calendar, User, Activity, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';

interface LogEntry {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  page: string;
  url: string;
  component: string;
  details: any;
  timestamp: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export const LogsViewer: React.FC = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [logs, searchTerm, actionFilter, userFilter, dateFilter]);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('user_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Erreur lors de la récupération des logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = [...logs];

    // Filtre par terme de recherche
    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.component.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.page.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtre par action
    if (actionFilter !== 'all') {
      filtered = filtered.filter(log => log.action === actionFilter);
    }

    // Filtre par utilisateur
    if (userFilter !== 'all') {
      filtered = filtered.filter(log => log.user_email === userFilter);
    }

    // Filtre par date
    if (dateFilter) {
      filtered = filtered.filter(log => {
        const logDate = new Date(log.created_at).toISOString().split('T')[0];
        return logDate === dateFilter;
      });
    }

    setFilteredLogs(filtered);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'NAVIGATION':
        return <Activity size={16} className="text-blue-600" />;
      case 'CREATE':
      case 'CRUD_ACTION':
        return <User size={16} className="text-green-600" />;
      case 'UPDATE':
        return <User size={16} className="text-yellow-600" />;
      case 'DELETE':
        return <User size={16} className="text-red-600" />;
      case 'ERROR':
        return <User size={16} className="text-red-600" />;
      default:
        return <Activity size={16} className="text-gray-600" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'NAVIGATION':
        return 'bg-blue-100 text-blue-800';
      case 'CREATE':
      case 'CRUD_ACTION':
        return 'bg-green-100 text-green-800';
      case 'UPDATE':
        return 'bg-yellow-100 text-yellow-800';
      case 'DELETE':
        return 'bg-red-100 text-red-800';
      case 'ERROR':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const exportLogs = () => {
    const csvContent = [
      ['Timestamp', 'User', 'Action', 'Page', 'Component', 'Details'],
      ...filteredLogs.map(log => [
        new Date(log.created_at).toLocaleString(),
        log.user_email,
        log.action,
        log.page,
        log.component,
        JSON.stringify(log.details)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const uniqueActions = [...new Set(logs.map(log => log.action))];
  const uniqueUsers = [...new Set(logs.map(log => log.user_email))];

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
    <div className="p-3 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">📊 Logs des Utilisateurs</h1>
        <button
          onClick={exportLogs}
          className="flex items-center justify-center space-x-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm sm:text-base whitespace-nowrap"
        >
          <Download size={18} className="sm:w-5 sm:h-5" />
          <span>Exporter CSV</span>
        </button>
      </div>

      {/* Filtres */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">Toutes les actions</option>
          {uniqueActions.map(action => (
            <option key={action} value={action}>{action}</option>
          ))}
        </select>

        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">Tous les utilisateurs</option>
          {uniqueUsers.map(user => (
            <option key={user} value={user}>{user}</option>
          ))}
        </select>

        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center">
            <Activity className="text-blue-600" size={24} />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Logs</p>
              <p className="text-2xl font-bold text-gray-900">{logs.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center">
            <User className="text-green-600" size={24} />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Utilisateurs Actifs</p>
              <p className="text-2xl font-bold text-gray-900">{uniqueUsers.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center">
            <Filter className="text-yellow-600" size={24} />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Actions Uniques</p>
              <p className="text-2xl font-bold text-gray-900">{uniqueActions.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center">
            <Calendar className="text-purple-600" size={24} />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Logs Filtrés</p>
              <p className="text-2xl font-bold text-gray-900">{filteredLogs.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Liste des logs - Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {filteredLogs.map((log) => (
          <div key={log.id} className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{log.user_email}</div>
                <div className="text-xs text-gray-500">{new Date(log.created_at).toLocaleString()}</div>
              </div>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ml-2 flex-shrink-0 ${getActionColor(log.action)}`}>
                {getActionIcon(log.action)}
                <span className="ml-1 hidden sm:inline">{log.action}</span>
              </span>
            </div>
            <div className="space-y-1 text-xs pt-2 border-t border-gray-100">
              <div className="flex justify-between">
                <span className="text-gray-600">Page:</span>
                <span className="text-gray-900">{log.page}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Composant:</span>
                <span className="text-gray-900 truncate ml-2">{log.component}</span>
              </div>
              <div className="pt-1">
                <span className="text-gray-600">Détails: </span>
                <span className="text-gray-900 text-xs">{JSON.stringify(log.details).substring(0, 50)}...</span>
              </div>
              <div className="pt-2 border-t border-gray-100">
                <button
                  onClick={() => {
                    setSelectedLog(log);
                    setShowDetails(true);
                  }}
                  className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                >
                  Voir les détails
                </button>
              </div>
            </div>
          </div>
        ))}
        {filteredLogs.length === 0 && (
          <div className="text-center py-8 bg-white rounded-lg shadow-md">
            <p className="text-gray-500 text-sm">Aucun log trouvé</p>
          </div>
        )}
      </div>

      {/* Liste des logs - Desktop Table View */}
      <div className="hidden lg:block bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Page/Composant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Détails
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.user_email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                      {getActionIcon(log.action)}
                      <span className="ml-1">{log.action}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{log.page}</div>
                      <div className="text-gray-500">{log.component}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {JSON.stringify(log.details).substring(0, 100)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => {
                        setSelectedLog(log);
                        setShowDetails(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                      title="Voir les détails"
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredLogs.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">Aucun log trouvé</p>
          </div>
        )}
      </div>

      {/* Modal de détails */}
      {showDetails && selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Détails du Log</h2>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Timestamp</label>
                  <p className="text-sm text-gray-900">{new Date(selectedLog.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Utilisateur</label>
                  <p className="text-sm text-gray-900">{selectedLog.user_email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Action</label>
                  <p className="text-sm text-gray-900">{selectedLog.action}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Page</label>
                  <p className="text-sm text-gray-900">{selectedLog.page}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">URL</label>
                  <p className="text-sm text-gray-900 break-all">{selectedLog.url}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Composant</label>
                  <p className="text-sm text-gray-900">{selectedLog.component}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Détails</label>
                  <pre className="text-sm text-gray-900 bg-gray-100 p-3 rounded-md overflow-auto">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
                {selectedLog.ip_address && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Adresse IP</label>
                    <p className="text-sm text-gray-900">{selectedLog.ip_address}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

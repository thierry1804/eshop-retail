import React, { useState, useEffect } from 'react';
import { Filter, Download, Eye, Calendar, User, Activity, X } from 'lucide-react';
import { SearchField } from '../ui/SearchField';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { Offcanvas, OffcanvasHeader, OffcanvasBody } from '../ui/Offcanvas';
import { DataTable, dtTh, dtThRight, dtTd, dtTdMuted } from '../ui/DataTable';
import { formatDateTimeDisplay } from '../../lib/dateUtils';

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
        return <Activity size={16} className="app-text-link" />;
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
        return <Activity size={16} className="app-text-muted" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'NAVIGATION':
        return 'app-badge-info';
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
        return 'app-badge';
    }
  };

  const exportLogs = () => {
    const csvContent = [
      ['Timestamp', 'User', 'Action', 'Page', 'Component', 'Details'],
      ...filteredLogs.map(log => [
        formatDateTimeDisplay(log.created_at),
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
          <div className="h-8 app-skeleton rounded w-1/4"></div>
          <div className="h-10 app-skeleton rounded"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 app-skeleton rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
        <h1 className="app-page-title">Logs des Utilisateurs</h1>
        <button
          onClick={exportLogs}
          className="app-btn app-btn-success whitespace-nowrap"
        >
          <Download size={18} className="sm:w-5 sm:h-5" />
          <span>Exporter CSV</span>
        </button>
      </div>

      {/* Filtres */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <SearchField
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Rechercher..."
          className="w-full"
        />

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="app-input"
        >
          <option value="all">Toutes les actions</option>
          {uniqueActions.map(action => (
            <option key={action} value={action}>{action}</option>
          ))}
        </select>

        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="app-input"
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
          className="app-input"
        />
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="app-kpi">
          <div className="flex items-center">
            <Activity className="app-text-link" size={24} />
            <div className="ml-3">
              <p className="app-label text-sm">Total Logs</p>
              <p className="text-2xl font-bold app-text">{logs.length}</p>
            </div>
          </div>
        </div>
        <div className="app-kpi">
          <div className="flex items-center">
            <User className="text-green-600" size={24} />
            <div className="ml-3">
              <p className="app-label text-sm">Utilisateurs Actifs</p>
              <p className="text-2xl font-bold app-text">{uniqueUsers.length}</p>
            </div>
          </div>
        </div>
        <div className="app-kpi">
          <div className="flex items-center">
            <Filter className="text-yellow-600" size={24} />
            <div className="ml-3">
              <p className="app-label text-sm">Actions Uniques</p>
              <p className="text-2xl font-bold app-text">{uniqueActions.length}</p>
            </div>
          </div>
        </div>
        <div className="app-kpi">
          <div className="flex items-center">
            <Calendar className="text-purple-600" size={24} />
            <div className="ml-3">
              <p className="app-label text-sm">Logs Filtrés</p>
              <p className="text-2xl font-bold app-text">{filteredLogs.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Liste des logs — mobile */}
      <div className="md:hidden space-y-3">
        {filteredLogs.map((log) => (
          <div key={log.id} className="app-list-card">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium app-text truncate">{log.user_email}</div>
                <div className="text-xs app-text-muted mt-0.5">{formatDateTimeDisplay(log.created_at)}</div>
              </div>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ml-2 flex-shrink-0 ${getActionColor(log.action)}`}>
                {getActionIcon(log.action)}
                <span className="ml-1">{log.action}</span>
              </span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="app-text-muted shrink-0">Page</span>
                <span className="app-text text-right truncate">{log.page}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="app-text-muted shrink-0">Composant</span>
                <span className="app-text text-right truncate">{log.component}</span>
              </div>
              <div className="pt-2 border-t border-[var(--app-border)] app-text-muted line-clamp-2">
                {JSON.stringify(log.details).substring(0, 80)}
                {JSON.stringify(log.details).length > 80 ? '…' : ''}
              </div>
              <div className="flex justify-end pt-2 border-t border-[var(--app-border)]">
                <button
                  onClick={() => {
                    setSelectedLog(log);
                    setShowDetails(true);
                  }}
                  className="app-icon-btn app-icon-btn-primary"
                  title="Voir les détails"
                >
                  <Eye size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filteredLogs.length === 0 && (
          <div className="app-empty">
            <p className="app-empty-text">Aucun log trouvé</p>
          </div>
        )}
      </div>

      {/* Liste des logs — desktop */}
      <div className="hidden md:block app-table-wrap">
        {filteredLogs.length === 0 ? (
          <div className="app-empty">
            <p className="app-empty-text">Aucun log trouvé</p>
          </div>
        ) : (
          <DataTable>
            <thead className="app-bg-muted">
              <tr>
                <th className={dtTh}>Timestamp</th>
                <th className={dtTh}>Utilisateur</th>
                <th className={dtTh}>Action</th>
                <th className={dtTh}>Page/Composant</th>
                <th className={dtTh}>Détails</th>
                <th className={dtThRight}>Actions</th>
              </tr>
            </thead>
            <tbody className="bg-[var(--app-surface)] divide-y divide-[var(--app-border)]">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[var(--app-surface-muted)]">
                  <td className={dtTdMuted}>{formatDateTimeDisplay(log.created_at)}</td>
                  <td className={dtTd}>{log.user_email}</td>
                  <td className={dtTd}>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                      {getActionIcon(log.action)}
                      <span className="ml-1">{log.action}</span>
                    </span>
                  </td>
                  <td className={dtTd}>
                    <div className="font-medium">{log.page}</div>
                    <div className="app-text-muted">{log.component}</div>
                  </td>
                  <td className={`${dtTd} max-w-xs truncate`}>
                    {JSON.stringify(log.details).substring(0, 100)}…
                  </td>
                  <td className={`${dtTd} text-right font-medium`}>
                    <button
                      onClick={() => {
                        setSelectedLog(log);
                        setShowDetails(true);
                      }}
                      className="app-icon-btn app-icon-btn-primary"
                      title="Voir les détails"
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </div>

      {/* Détails du log (offcanvas) */}
      {showDetails && selectedLog && (
        <Offcanvas onClose={() => setShowDetails(false)} width="lg">
          <OffcanvasHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold app-text">Détails du Log</h2>
              <button
                onClick={() => setShowDetails(false)}
                className="app-text-muted hover:text-[var(--app-ink-muted)] transition-colors"
              >
                <X size={24} />
              </button>
            </div>
          </OffcanvasHeader>
          <OffcanvasBody>
              <div className="space-y-4">
                <div>
                  <label className="app-label">Timestamp</label>
                  <p className="text-sm app-text">{formatDateTimeDisplay(selectedLog.created_at)}</p>
                </div>
                <div>
                  <label className="app-label">Utilisateur</label>
                  <p className="text-sm app-text">{selectedLog.user_email}</p>
                </div>
                <div>
                  <label className="app-label">Action</label>
                  <p className="text-sm app-text">{selectedLog.action}</p>
                </div>
                <div>
                  <label className="app-label">Page</label>
                  <p className="text-sm app-text">{selectedLog.page}</p>
                </div>
                <div>
                  <label className="app-label">URL</label>
                  <p className="text-sm app-text break-all">{selectedLog.url}</p>
                </div>
                <div>
                  <label className="app-label">Composant</label>
                  <p className="text-sm app-text">{selectedLog.component}</p>
                </div>
                <div>
                  <label className="app-label">Détails</label>
                  <pre className="text-sm app-text app-bg-muted p-3 rounded-md overflow-auto">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
                {selectedLog.ip_address && (
                  <div>
                    <label className="app-label">Adresse IP</label>
                    <p className="text-sm app-text">{selectedLog.ip_address}</p>
                  </div>
                )}
              </div>
          </OffcanvasBody>
        </Offcanvas>
      )}
    </div>
  );
};

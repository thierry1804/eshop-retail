import React, { useState, useEffect } from 'react';
import { User, LogOut, Users, ShoppingCart, CreditCard, BarChart3, Menu, X, Activity, Receipt, Package, Truck, ShoppingBag, ChevronDown, ChevronRight, Video, Settings, PackageSearch } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { signOut } from '../../lib/supabase';
import { User as UserType } from '../../types';
import { LanguageSwitcher } from './LanguageSwitcher';

interface NavbarProps {
  user: UserType;
  currentPage: string;
  onPageChange: (page: string) => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, currentPage, onPageChange, onLogout }) => {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fonction pour déterminer si une section contient la page active
  const getActiveSection = (currentPage: string) => {
    const pageToSection: Record<string, string> = {
      'dashboard': 'sales',
      'clients': 'sales',
      'sales': 'sales',
      'tiktok-live': 'sales',
      'payments': 'sales',
      'stock': 'inventory',
      'supply': 'inventory',
      'deliveries': 'inventory',
      'tracking': 'inventory',
      'expenses': 'finance',
      'logs': 'admin'
    };
    return pageToSection[currentPage] || 'sales';
  };

  // State pour gérer les sections pliées/dépliées
  // Par défaut, seule la section active est ouverte
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    const activeSection = getActiveSection(currentPage);
    return {
      sales: activeSection !== 'sales',      // Fermé si pas actif
      inventory: activeSection !== 'inventory',  // Fermé si pas actif
      finance: activeSection !== 'finance',    // Fermé si pas actif
      admin: activeSection !== 'admin'       // Fermé si pas actif
    };
  });

  const handleSignOut = async () => {
    if (onLogout) {
      await onLogout();
    } else {
      await signOut();
      window.location.reload();
    }
  };

  // Fonction pour basculer l'état d'une section
  const toggleSection = (sectionKey: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // Effet pour mettre à jour automatiquement les sections quand la page change
  useEffect(() => {
    const activeSection = getActiveSection(currentPage);
    setCollapsedSections(prev => {
      const newState = { ...prev };
      // Ouvrir la section active et fermer les autres
      Object.keys(newState).forEach(section => {
        newState[section] = section !== activeSection;
      });
      return newState;
    });
  }, [currentPage]);

  // Définir les éléments de navigation selon le rôle
  const getNavItems = () => {
    if (user.role === 'admin') {
      // Admin a accès à tous les menus, organisés par groupes logiques
      const navItems = [
        // 📊 VENTES & CLIENTS (flux principal)
        { id: 'dashboard', label: t('navigation.dashboard'), icon: BarChart3, group: 'sales' },
        { id: 'clients', label: t('navigation.clients'), icon: Users, group: 'sales' },
        { id: 'sales', label: t('navigation.sales'), icon: ShoppingCart, group: 'sales' },
        { id: 'tiktok-live', label: t('navigation.tiktokLive', 'Ventes Live TikTok'), icon: Video, group: 'sales' },
        { id: 'payments', label: t('navigation.payments'), icon: CreditCard, group: 'sales' },

        // 📦 GESTION DES STOCKS (logistique)
        { id: 'stock', label: t('navigation.stock'), icon: Package, group: 'inventory' },
        { id: 'supply', label: t('navigation.supply'), icon: ShoppingBag, group: 'inventory' },
        { id: 'deliveries', label: t('navigation.deliveries'), icon: Truck, group: 'inventory' },
        { id: 'tracking', label: t('navigation.tracking'), icon: PackageSearch, group: 'inventory' },

        // 💰 FINANCE (comptabilité)
        { id: 'expenses', label: t('navigation.expenses'), icon: Receipt, group: 'finance' },

        // ⚙️ ADMINISTRATION
        { id: 'referentials', label: 'Référentiels', icon: Settings, group: 'admin' },
      ];
      
      // Ajouter le menu logs uniquement pour thierry1804@gmail.com
      if (user.email === 'thierry1804@gmail.com') {
        navItems.push({ id: 'logs', label: '📊 Logs', icon: Activity, group: 'admin' });
      }
      
      return navItems;
    } else {
      // Employé a accès uniquement aux clients et ventes
      return [
        { id: 'clients', label: t('navigation.clients'), icon: Users, group: 'sales' },
        { id: 'sales', label: t('navigation.sales'), icon: ShoppingCart, group: 'sales' },
        { id: 'tiktok-live', label: t('navigation.tiktokLive', 'Ventes Live TikTok'), icon: Video, group: 'sales' },
      ];
    }
  };

  const navItems = getNavItems();

  return (
    <>
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-blue-600">{t('app.title')}</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-4">
            {(() => {
              // Grouper les éléments par catégorie
              const groupedItems = navItems.reduce((groups, item) => {
                const group = item.group || 'other';
                if (!groups[group]) {
                  groups[group] = [];
                }
                groups[group].push(item);
                return groups;
              }, {} as Record<string, typeof navItems>);

              // Définir l'ordre et les titres des groupes
              const groupOrder = [
                { key: 'sales', title: '📊 VENTES & CLIENTS', icon: '💼' },
                { key: 'inventory', title: '📦 GESTION DES STOCKS', icon: '📋' },
                { key: 'finance', title: '💰 FINANCE', icon: '💳' },
                { key: 'admin', title: '⚙️ ADMINISTRATION', icon: '🔧' }
              ];

              return groupOrder.map((groupInfo) => {
                const items = groupedItems[groupInfo.key];
                if (!items || items.length === 0) return null;

                const isCollapsed = collapsedSections[groupInfo.key];
                const isActiveSection = getActiveSection(currentPage) === groupInfo.key;

                return (
                  <div key={groupInfo.key} className="space-y-2">
                    {/* Titre du groupe avec bouton pliable */}
                    <button
                      onClick={() => toggleSection(groupInfo.key)}
                      className={`w-full flex items-center justify-between px-2 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors ${isActiveSection
                          ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                      <span>{groupInfo.title}</span>
                      {isCollapsed ? (
                        <ChevronRight size={16} className={isActiveSection ? "text-blue-400" : "text-gray-400"} />
                      ) : (
                        <ChevronDown size={16} className={isActiveSection ? "text-blue-400" : "text-gray-400"} />
                      )}
                    </button>

                    {/* Éléments du groupe avec animation */}
                    <div className={`space-y-1 transition-all duration-300 ease-in-out overflow-hidden ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-96 opacity-100'
                      }`}>
                      {items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              onPageChange(item.id);
                              setSidebarOpen(false);
                            }}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${currentPage === item.id
                              ? 'bg-blue-100 text-blue-700'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                              }`}
                          >
                            <Icon size={20} />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </nav>

          {/* Language Switcher */}
          <div className="p-4 border-t border-gray-200">
            <LanguageSwitcher />
          </div>

          {/* User Info */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <User size={16} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                  user.role === 'admin' 
                    ? 'bg-purple-100 text-purple-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {user.role === 'admin' ? 'Admin' : 'Employé'}
                </span>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
            >
              <LogOut size={16} />
              <span>{t('auth.logout')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile menu button with app name */}
      <div className="md:hidden fixed top-4 left-4 z-60 flex items-center gap-2">
        <button
          onClick={() => setSidebarOpen(true)}
          className="bg-white shadow-lg rounded-lg p-2 text-gray-600 hover:text-gray-900"
        >
          <Menu size={24} />
        </button>
        <h1 className="text-lg font-bold text-blue-600 bg-white shadow-lg rounded-lg px-3 py-2">
          {t('app.title')}
        </h1>
      </div>
    </>
  );
};
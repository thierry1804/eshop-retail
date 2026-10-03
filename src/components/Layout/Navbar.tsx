import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, LogOut, Users, ShoppingCart, CreditCard, BarChart3, Menu, X, Activity, Receipt, Package, Truck, ShoppingBag, ChevronDown, ChevronRight, Video, Settings, PackageSearch, ChevronLeft, ChevronRight as ChevronRightIcon, ClipboardCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { signOut } from '../../lib/supabase';
import { User as UserType } from '../../types';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useSidebar } from '../../contexts/SidebarContext';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';

interface NavbarProps {
  user: UserType;
  currentPage: string;
  onPageChange: (page: string) => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, currentPage, onPageChange, onLogout }) => {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isCollapsed: sidebarCollapsed, setIsCollapsed: setSidebarCollapsed } = useSidebar();
  const navRef = useRef<HTMLElement>(null);
  const [showTopIndicator, setShowTopIndicator] = useState(false);
  const [showBottomIndicator, setShowBottomIndicator] = useState(false);

  useLockBodyScroll(sidebarOpen);

  // Fonction pour déterminer si une section contient la page active
  const getActiveSection = (currentPage: string) => {
    const pageToSection: Record<string, string> = {
      'dashboard': 'sales',
      'clients': 'sales',
      'sales': 'sales',
      'tiktok-live': 'sales',
      'payments': 'sales',
      'stock': 'inventory',
      'inventories': 'inventory',
      'supply': 'inventory',
      'deliveries': 'inventory',
      'tracking': 'inventory',
      'expenses': 'finance',
      'referentials': 'admin',
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
        { id: 'inventories', label: 'Inventaires', icon: ClipboardCheck, group: 'inventory' },
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
        navItems.push({ id: 'logs', label: 'Logs', icon: Activity, group: 'admin' });
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

  // Fonction pour vérifier l'état du scroll et mettre à jour les indicateurs
  const checkScrollIndicators = useCallback(() => {
    if (!navRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = navRef.current;
    const canScrollUp = scrollTop > 0;
    const canScrollDown = scrollTop < scrollHeight - clientHeight - 1; // -1 pour éviter les problèmes d'arrondi
    
    setShowTopIndicator(canScrollUp);
    setShowBottomIndicator(canScrollDown);
  }, []);

  // Effet pour gérer les indicateurs de scroll
  useEffect(() => {
    const navElement = navRef.current;
    if (!navElement) return;

    // Vérifier initialement
    checkScrollIndicators();

    // Vérifier lors du scroll
    navElement.addEventListener('scroll', checkScrollIndicators);
    
    // Vérifier lors du redimensionnement ou changement de contenu
    const resizeObserver = new ResizeObserver(() => {
      checkScrollIndicators();
    });
    resizeObserver.observe(navElement);

    // Vérifier quand les sections changent
    const timeoutId = setTimeout(() => {
      checkScrollIndicators();
    }, 300); // Attendre la fin de l'animation

    return () => {
      navElement.removeEventListener('scroll', checkScrollIndicators);
      resizeObserver.disconnect();
      clearTimeout(timeoutId);
    };
  }, [collapsedSections, sidebarCollapsed, navItems, checkScrollIndicators]);

  return (
    <>
      {/* Sidebar */}
      <div className={`app-sidebar fixed inset-y-0 left-0 z-50 transform transition-all duration-200 ease-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0 ${
        sidebarCollapsed ? 'w-16' : 'w-64'
      }`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="app-sidebar-divider flex items-center justify-between p-4 border-b flex-shrink-0">
            {!sidebarCollapsed && (
              <p className="text-xl font-bold m-0" style={{ color: 'var(--sidebar-brand)' }}>
                {t('app.title')}
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden md:flex p-1 rounded transition-colors app-sidebar-nav-item"
                title={sidebarCollapsed ? t('navigation.expand', 'Agrandir') : t('navigation.collapse', 'Réduire')}
              >
                {sidebarCollapsed ? <ChevronRightIcon size={20} /> : <ChevronLeft size={20} />}
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="md:hidden p-1 rounded transition-colors app-sidebar-nav-item"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Navigation - scrollable sans barre visible avec indicateurs */}
          <div className="flex-1 relative overflow-hidden">
            {/* Indicateur en haut */}
            {showTopIndicator && (
              <div className="app-sidebar-fade-top absolute top-0 left-0 right-0 h-8 z-10 pointer-events-none" />
            )}
            
            {/* Indicateur en bas */}
            {showBottomIndicator && (
              <div className="app-sidebar-fade-bottom absolute bottom-0 left-0 right-0 h-8 z-10 pointer-events-none" />
            )}

            <nav 
              ref={navRef}
              className={`h-full px-2 py-4 space-y-4 overflow-y-auto ${sidebarCollapsed ? 'px-1' : 'px-4'} scrollbar-hide`} 
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
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

              const groupOrder = [
                { key: 'sales', title: 'Ventes' },
                { key: 'inventory', title: 'Stocks' },
                { key: 'finance', title: 'Finance' },
                { key: 'admin', title: 'Admin' }
              ];

              return groupOrder.map((groupInfo) => {
                const items = groupedItems[groupInfo.key];
                if (!items || items.length === 0) return null;

                const isCollapsed = collapsedSections[groupInfo.key];
                const isActiveSection = getActiveSection(currentPage) === groupInfo.key;

                return (
                  <div key={groupInfo.key} className="space-y-2">
                    {/* Titre du groupe avec bouton pliable */}
                    {!sidebarCollapsed && (
                      <button
                        onClick={() => toggleSection(groupInfo.key)}
                        className={`w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-medium rounded-md transition-colors ${
                          isActiveSection
                            ? 'app-sidebar-section-active'
                            : 'app-sidebar-section'
                        }`}
                      >
                        <span>{groupInfo.title}</span>
                        {isCollapsed ? (
                          <ChevronRight size={16} className="opacity-70" />
                        ) : (
                          <ChevronDown size={16} className="opacity-70" />
                        )}
                      </button>
                    )}

                    {/* Éléments du groupe avec animation */}
                    <div className={`space-y-1 transition-all duration-200 ease-out overflow-hidden ${isCollapsed && !sidebarCollapsed ? 'max-h-0 opacity-0' : 'max-h-96 opacity-100'
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
                            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3'} py-2 rounded-md text-[13px] font-medium transition-colors ${
                              currentPage === item.id
                                ? 'app-sidebar-nav-item-active'
                                : 'app-sidebar-nav-item'
                            }`}
                            title={sidebarCollapsed ? item.label : undefined}
                          >
                            <Icon size={18} />
                            {!sidebarCollapsed && <span>{item.label}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </nav>
          </div>

          {/* Footer - toujours visible en bas */}
          <div className={`app-sidebar-divider flex-shrink-0 border-t ${sidebarCollapsed ? 'p-2' : 'p-3'}`}>
            {sidebarCollapsed ? (
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: 'var(--sidebar-hover)' }}
                  title={user.name || user.email}
                >
                  <User size={16} style={{ color: 'var(--sidebar-muted)' }} />
                </div>
                <LanguageSwitcher collapsed />
                <button
                  onClick={handleSignOut}
                  className="w-8 h-8 flex items-center justify-center rounded-md transition-colors app-sidebar-nav-item"
                  title={t('auth.logout')}
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--sidebar-hover)' }}
                  >
                    <User size={16} style={{ color: 'var(--sidebar-muted)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs font-medium truncate leading-tight"
                      style={{ color: 'var(--sidebar-text)' }}
                    >
                      {user.name || user.email}
                    </p>
                    <p
                      className="text-[11px] leading-tight mt-0.5"
                      style={{ color: 'var(--sidebar-muted)' }}
                    >
                      {user.role === 'admin' ? 'Admin' : 'Employé'}
                    </p>
                  </div>
                  <LanguageSwitcher collapsed={false} />
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors app-sidebar-nav-item"
                >
                  <LogOut size={14} className="flex-shrink-0" />
                  <span>{t('auth.logout')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 md:hidden"
          style={{ backgroundColor: 'rgba(36, 48, 65, 0.45)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile top bar */}
      <div className="app-mobile-bar">
        <button
          onClick={() => setSidebarOpen(true)}
          className="app-icon-btn"
          aria-label="Menu"
        >
          <Menu size={22} />
        </button>
        <p className="text-base font-bold m-0" style={{ color: 'var(--sidebar-brand)' }}>
          {t('app.title')}
        </p>
      </div>
    </>
  );
};
import React, { useState } from 'react';
import { User, LogOut, Users, ShoppingCart, CreditCard, BarChart3, Menu, X, Activity, Receipt, Package, Truck, ShoppingBag } from 'lucide-react';
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

  const handleSignOut = async () => {
    if (onLogout) {
      await onLogout();
    } else {
      await signOut();
      window.location.reload();
    }
  };

  // Définir les éléments de navigation selon le rôle
  const getNavItems = () => {
    if (user.role === 'admin') {
      // Admin a accès à tous les menus, mais logs uniquement pour thierry1804@gmail.com
      const navItems = [
        { id: 'dashboard', label: t('navigation.dashboard'), icon: BarChart3 },
        { id: 'clients', label: t('navigation.clients'), icon: Users },
        { id: 'sales', label: t('navigation.sales'), icon: ShoppingCart },
        { id: 'payments', label: t('navigation.payments'), icon: CreditCard },
        { id: 'expenses', label: t('navigation.expenses'), icon: Receipt },
        { id: 'stock', label: t('navigation.stock'), icon: Package },
        { id: 'deliveries', label: t('navigation.deliveries'), icon: Truck },
        { id: 'supply', label: t('navigation.supply'), icon: ShoppingBag },
      ];
      
      // Ajouter le menu logs uniquement pour thierry1804@gmail.com
      if (user.email === 'thierry1804@gmail.com') {
        navItems.push({ id: 'logs', label: '📊 Logs', icon: Activity });
      }
      
      return navItems;
    } else {
      // Employé a accès uniquement aux clients et ventes
      return [
        { id: 'clients', label: t('navigation.clients'), icon: Users },
        { id: 'sales', label: t('navigation.sales'), icon: ShoppingCart },
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
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onPageChange(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === item.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </button>
              );
            })}
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

      {/* Mobile menu button only */}
      <div className="md:hidden fixed top-4 left-4 z-60">
        <button
          onClick={() => setSidebarOpen(true)}
          className="bg-white shadow-lg rounded-lg p-2 text-gray-600 hover:text-gray-900"
        >
          <Menu size={24} />
        </button>
      </div>
    </>
  );
};
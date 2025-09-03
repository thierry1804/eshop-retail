import { useState, useEffect } from 'react';
import { Navbar } from './components/Layout/Navbar';
import { LoginForm } from './components/Auth/LoginForm';
import { Dashboard } from './components/Dashboard/Dashboard';
import { ClientsList } from './components/Clients/ClientsList';
import { SalesList } from './components/Sales/SalesList';
import { PaymentsList } from './components/Payments/PaymentsList';
import { ConfigError } from './components/Debug/ConfigError';
import { supabase } from './lib/supabase';
import { User } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🚀 App: Initialisation de l\'application');
    const startTime = performance.now();
    
    try {
      checkAuth();
      
      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log(`🔄 App: Événement auth détecté: ${event}`);
        if (event === 'SIGNED_IN' && session) {
          console.log('👤 App: Utilisateur connecté, récupération du profil...');
          await fetchUserProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          console.log('👋 App: Utilisateur déconnecté');
          setUser(null);
        }
      });

      const endTime = performance.now();
      console.log(`⏱️ App: Initialisation terminée en ${(endTime - startTime).toFixed(2)}ms`);

      return () => subscription.unsubscribe();
    } catch (error) {
      console.error('❌ App: Erreur fatale lors de l\'initialisation:', error);
      setConfigError('Erreur lors de l\'initialisation de l\'application');
      setLoading(false);
    }
  }, []);

  const checkAuth = async () => {
    console.log('🔍 App: Vérification de l\'authentification...');
    const startTime = performance.now();
    
    try {
      // Vérifier d'abord si Supabase est configuré
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        console.error('❌ App: Configuration Supabase manquante');
        setConfigError('Variables d\'environnement Supabase manquantes');
        setLoading(false);
        return;
      }

      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('❌ App: Erreur lors de la récupération de session:', error);
        setLoading(false);
        return;
      }
      
      if (session) {
        console.log('✅ App: Session trouvée, récupération du profil utilisateur...');
        await fetchUserProfile(session.user.id);
      } else {
        console.log('❌ App: Aucune session trouvée');
      }
    } catch (error) {
      console.error('❌ App: Erreur lors de la vérification auth:', error);
    } finally {
      const endTime = performance.now();
      console.log(`⏱️ App: Vérification auth terminée en ${(endTime - startTime).toFixed(2)}ms`);
      setLoading(false);
    }
  };

  const fetchUserProfile = async (userId: string) => {
    console.log('👤 App: Récupération du profil utilisateur...');
    const startTime = performance.now();
    
    // Créer directement un profil temporaire sans appels à Supabase
    console.log('🔄 App: Création d\'un profil temporaire...');
    
    // Profil temporaire simple
    const tempProfile = {
      id: userId,
      email: 'utilisateur@example.com',
      name: 'Utilisateur',
      role: 'employee' as const,
      created_at: new Date().toISOString(),
    };
    
    console.log('✅ App: Profil temporaire créé:', tempProfile.name);
    setUser(tempProfile);
    setLoading(false);
    
    const endTime = performance.now();
    console.log(`⏱️ App: Récupération profil terminée en ${(endTime - startTime).toFixed(2)}ms`);
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'clients':
        return <ClientsList />;
      case 'sales':
        return <SalesList />;
      case 'payments':
        return <PaymentsList />;
      default:
        return <Dashboard />;
    }
  };

  if (configError) {
    return <ConfigError error={configError} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    // Forcer la connexion si aucun utilisateur
    console.log('🔐 App: Aucun utilisateur connecté, affichage du formulaire de connexion');
    return <LoginForm onLogin={checkAuth} />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar user={user} currentPage={currentPage} onPageChange={setCurrentPage} />
      <main className="md:ml-64">
        <div className="max-w-7xl mx-auto">
          {renderCurrentPage()}
        </div>
      </main>
    </div>
  );
}

export default App;
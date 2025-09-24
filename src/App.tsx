import { useState, useEffect } from 'react';
import { Navbar } from './components/Layout/Navbar';
import { LoginForm } from './components/Auth/LoginForm';
import { Dashboard } from './components/Dashboard/Dashboard';
import { ClientsList } from './components/Clients/ClientsList';
import { SalesList } from './components/Sales/SalesList';
import { PaymentsList } from './components/Payments/PaymentsList';
import { LogsViewer } from './components/Admin/LogsViewer';
import ExpensesList from './components/Expenses/ExpensesList';
import { ConfigError } from './components/Debug/ConfigError';
import { supabase } from './lib/supabase';
import { User } from './types';
import { logger } from './lib/logger';

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
    
    try {
      // Récupérer les informations de l'utilisateur connecté avec timeout
      console.log('ETO');

      // Ajouter un timeout pour éviter le blocage
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout après 5 secondes')), 5000)
      );

      const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]) as any;
      const authUser = session?.user;
      console.log('👤 App: Utilisateur connecté:', authUser);
      console.log('ETO2');

      if (error) {
        console.error('❌ App: Erreur lors de la récupération de l\'utilisateur:', error);
        setLoading(false);
        return;
      }

      if (!authUser) {
        console.error('❌ App: Aucun utilisateur trouvé');
        setLoading(false);
        return;
      }

      // Emails des administrateurs
      const adminEmails = [
        'laoban@eshopbyvalsue.mg',
        'admin@eshopbyvalsue.mg',
        'thierry1804@gmail.com'
      ];

      // Déterminer le rôle basé sur l'email
      const userEmail = authUser.email || '';
      const isAdmin = adminEmails.includes(userEmail);

      // Créer le profil utilisateur
      const userProfile = {
        id: userId,
        email: userEmail,
        name: userEmail, // Afficher l'email au lieu de "Utilisateur"
        role: isAdmin ? 'admin' as const : 'employee' as const,
        created_at: new Date().toISOString(),
      };

      console.log('✅ App: Profil utilisateur créé:', userProfile.name, 'Rôle:', userProfile.role);
      setUser(userProfile);

      // Définir la page par défaut selon le rôle
      if (userProfile.role !== 'admin') {
        setCurrentPage('clients');
      }

      setLoading(false);

    } catch (error) {
      console.error('❌ App: Erreur lors de la création du profil:', error);
      setLoading(false);
    }
    
    const endTime = performance.now();
    console.log(`⏱️ App: Récupération profil terminée en ${(endTime - startTime).toFixed(2)}ms`);
  };

  const renderCurrentPage = () => {
    // Vérifier si l'utilisateur a accès à la page demandée
    if (user && user.role !== 'admin') {
      // Les employés n'ont accès qu'aux clients et ventes
      if (currentPage === 'dashboard' || currentPage === 'payments') {
        // Logger la redirection
        logger.logNavigation(currentPage, 'clients');
        // Rediriger vers la page clients par défaut
        setCurrentPage('clients');
        return user ? <ClientsList user={user} /> : null;
      }
    }

    // Vérifier l'accès aux logs - uniquement pour thierry1804@gmail.com
    if (currentPage === 'logs' && user?.email !== 'thierry1804@gmail.com') {
      // Logger la tentative d'accès non autorisée
      logger.log('UNAUTHORIZED_ACCESS_ATTEMPT', {
        component: 'App',
        attemptedPage: 'logs',
        userEmail: user?.email || 'unknown'
      });
      // Rediriger vers le dashboard
      setCurrentPage('dashboard');
      return <Dashboard />;
    }

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'clients':
        return user ? <ClientsList user={user} /> : null;
      case 'sales':
        return user ? <SalesList user={user} /> : null;
      case 'payments':
        return <PaymentsList />;
      case 'expenses':
        return <ExpensesList />;
      case 'logs':
        return <LogsViewer />;
      default:
        // Par défaut, rediriger selon le rôle
        if (user && user.role !== 'admin') {
          logger.logNavigation(currentPage, 'clients');
          setCurrentPage('clients');
          return user ? <ClientsList user={user} /> : null;
        }
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
      <Navbar user={user} currentPage={currentPage} onPageChange={(page) => {
        // Logger le changement de page
        logger.logNavigation(currentPage, page);
        setCurrentPage(page);
      }} />
      <main className="md:ml-64">
        <div className="max-w-7xl mx-auto">
          {renderCurrentPage()}
        </div>
      </main>
    </div>
  );
}

export default App;
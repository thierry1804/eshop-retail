import { useState, useEffect } from 'react';
import { Navbar } from './components/Layout/Navbar';
import { LoginForm } from './components/Auth/LoginForm';
import { Dashboard } from './components/Dashboard/Dashboard';
import { ClientsList } from './components/Clients/ClientsList';
import { SalesList } from './components/Sales/SalesList';
import { PaymentsList } from './components/Payments/PaymentsList';
import { LogsViewer } from './components/Admin/LogsViewer';
import ExpensesList from './components/Expenses/ExpensesList';
import { ProductsList } from './components/Stock/ProductsList';
import { DeliveriesList } from './components/Delivery/DeliveriesList';
import { PurchaseOrdersList } from './components/Supply/PurchaseOrdersList';
import { CreatePurchaseOrderPage } from './components/Supply/CreatePurchaseOrderPage';
import { ConfigError } from './components/Debug/ConfigError';
import { supabase } from './lib/supabase';
import { User } from './types';
import { logger } from './lib/logger';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [pageParams, setPageParams] = useState<any>(null);
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

      // Vérifier d'abord le localStorage pour une session persistante
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          console.log('🔄 App: Utilisateur trouvé dans le localStorage, vérification de la session...');

          // Vérifier que la session est toujours valide
          const { data: { session }, error } = await supabase.auth.getSession();

          if (session && session.user.id === parsedUser.id) {
            console.log('✅ App: Session valide trouvée, restauration de l\'utilisateur');
            setUser(parsedUser);
            setLoading(false);
            return;
          } else {
            console.log('⚠️ App: Session expirée, nettoyage du localStorage');
            localStorage.removeItem('user');
          }
        } catch (error) {
          console.warn('⚠️ App: Erreur lors de la lecture du localStorage:', error);
          localStorage.removeItem('user');
        }
      }

      // Timeout plus long pour la vérification de session
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout session')), 10000) // 10 secondes
      );

      const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]) as any;
      
      if (error) {
        console.warn('⚠️ App: Erreur lors de la récupération de session:', error);
        setLoading(false);
        return;
      }
      
      if (session) {
        console.log('✅ App: Session trouvée, récupération du profil utilisateur...');
        await fetchUserProfile(session.user.id);
      } else {
        console.log('❌ App: Aucune session trouvée');
        setLoading(false);
      }
    } catch (error) {
      console.warn('⚠️ App: Erreur lors de la vérification auth:', error);
      setLoading(false);
    } finally {
      const endTime = performance.now();
      console.log(`⏱️ App: Vérification auth terminée en ${(endTime - startTime).toFixed(2)}ms`);
    }
  };

  const fetchUserProfile = async (userId: string) => {
    console.log('👤 App: Récupération du profil utilisateur...');
    const startTime = performance.now();
    
    try {
      // Timeout plus long pour éviter les déconnexions prématurées
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout après 10 secondes')), 10000)
      );

      const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]) as any;
      const authUser = session?.user;
      console.log('👤 App: Utilisateur connecté:', authUser?.email);

      if (error) {
        console.warn('⚠️ App: Erreur lors de la récupération de l\'utilisateur:', error);
        throw new Error('Erreur de session');
      }

      if (!authUser) {
        console.warn('⚠️ App: Aucun utilisateur trouvé dans la session');
        throw new Error('Aucune session utilisateur');
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

      // Sauvegarder dans le localStorage pour la persistance
      localStorage.setItem('user', JSON.stringify(userProfile));

      setUser(userProfile);

      // Définir la page par défaut selon le rôle
      if (userProfile.role !== 'admin') {
        setCurrentPage('clients');
      }

      setLoading(false);

    } catch (error) {
      console.warn('⚠️ App: Erreur lors de la récupération du profil:', error.message);
      setLoading(false);
    }
    
    const endTime = performance.now();
    console.log(`⏱️ App: Récupération profil terminée en ${(endTime - startTime).toFixed(2)}ms`);
  };

  const handleLogout = async () => {
    try {
      // Nettoyer le localStorage
      localStorage.removeItem('user');

      // Déconnexion Supabase
      await supabase.auth.signOut();

      // Réinitialiser l'état
      setUser(null);
      setCurrentPage('dashboard');

      console.log('✅ App: Déconnexion réussie');
    } catch (error) {
      console.error('❌ App: Erreur lors de la déconnexion:', error);
    }
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
      case 'stock':
        return user ? <ProductsList user={user} /> : null;
      case 'deliveries':
        return user ? <DeliveriesList user={user} /> : null;
      case 'supply':
        if (pageParams?.action === 'create-order') {
          return user ? (
            <CreatePurchaseOrderPage
              user={user}
              onBack={() => {
                setPageParams(null);
                setCurrentPage('supply');
              }}
              onSave={() => {
                setPageParams(null);
                setCurrentPage('supply');
              }}
            />
          ) : null;
        }
        return user ? (
          <PurchaseOrdersList
            user={user}
            onNavigateToCreate={() => {
              setPageParams({ action: 'create-order' });
              setCurrentPage('supply');
            }}
            key={pageParams ? 'refresh' : 'default'}
          />
        ) : null;
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
      }} onLogout={handleLogout} />
      <main className="md:ml-64">
        <div className="max-w-7xl mx-auto">
          {renderCurrentPage()}
        </div>
      </main>
    </div>
  );
}

export default App;
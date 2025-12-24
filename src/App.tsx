import { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Layout/Navbar';
import { LoginForm } from './components/Auth/LoginForm';
import { Dashboard } from './components/Dashboard/Dashboard';
import { ClientsList } from './components/Clients/ClientsList';
import { SalesList } from './components/Sales/SalesList';
import { TikTokLiveSales } from './components/Sales/TikTokLiveSales';
import { PaymentsList } from './components/Payments/PaymentsList';
import { LogsViewer } from './components/Admin/LogsViewer';
import { ReferentialsManager } from './components/Admin/ReferentialsManager';
import ExpensesList from './components/Expenses/ExpensesList';
import { ProductsList } from './components/Stock/ProductsList';
import { TrackingNumbersList } from './components/Stock/TrackingNumbersList';
import { DeliveriesList } from './components/Delivery/DeliveriesList';
import { PurchaseOrdersList } from './components/Supply/PurchaseOrdersList';
import { CreatePurchaseOrderPage } from './components/Supply/CreatePurchaseOrderPage';
import { ConfigError } from './components/Debug/ConfigError';
import { supabase } from './lib/supabase';
import { User } from './types';
import { logger } from './lib/logger';
import { OfflineIndicator } from './components/Offline/OfflineIndicator';
import { syncManager } from './lib/offline/sync-manager';
import { useSidebar } from './contexts/SidebarContext';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [pageParams, setPageParams] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const { isCollapsed } = useSidebar();

  // Flag pour éviter les initialisations multiples
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    // Ne s'exécuter qu'une seule fois
    if (hasInitializedRef.current) {
      console.log('⚠️ App: Initialisation déjà effectuée, skip');
      return;
    }
    hasInitializedRef.current = true;

    console.log('🚀 App: Initialisation de l\'application');
    const startTime = performance.now();
    
    try {
      checkAuth();
      
      // Désactiver la synchronisation automatique pour éviter les requêtes excessives
      // Les données sont déjà dans Supabase, pas besoin de synchroniser en continu
      // syncManager.startAutoSync(); // Désactivé pour réduire les requêtes
      
      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log(`🔄 App: Événement auth détecté: ${event}`);
        
        if (event === 'TOKEN_REFRESHED' && session) {
          // Ignorer silencieusement les rafraîchissements de token trop fréquents
          // Ne mettre à jour que si l'utilisateur n'est pas défini ou si c'est vraiment nécessaire
          if (!user) {
            console.log('🔄 App: Token rafraîchi, mise à jour de la session (utilisateur manquant)');
            const storedUser = localStorage.getItem('user');
            if (storedUser && session.user) {
              try {
                const parsedUser = JSON.parse(storedUser);
                if (parsedUser.id === session.user.id) {
                  parsedUser.updated_at = new Date().toISOString();
                  localStorage.setItem('user', JSON.stringify(parsedUser));
                  setUser(parsedUser);
                }
              } catch (error) {
                console.warn('⚠️ App: Erreur lors de la mise à jour du localStorage:', error);
              }
            }
          }
          // Ne pas logger chaque rafraîchissement pour éviter le spam dans la console
          return;
        }
        
        if (event === 'SIGNED_IN' && session) {
          console.log('👤 App: Utilisateur connecté, récupération du profil...');
          await fetchUserProfile(session.user.id);
          // Synchronisation désactivée pour éviter les requêtes excessives
          // if (navigator.onLine) {
          //   syncManager.startAutoSync();
          // }
        } else if (event === 'SIGNED_OUT') {
          // Vérifier si c'est vraiment une déconnexion ou juste une erreur de rafraîchissement
          // Ne déconnecter que si l'utilisateur n'a pas de session valide dans le localStorage
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            try {
              // Attendre un peu pour laisser le temps à Supabase de se stabiliser après une erreur 429
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Vérifier si la session est toujours valide (avec timeout pour éviter les blocages)
              const sessionPromise = supabase.auth.getSession();
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 2000)
              );
              
              try {
                const { data: { session: currentSession } } = await Promise.race([
                  sessionPromise,
                  timeoutPromise
                ]) as any;
                
                if (currentSession && currentSession.user) {
                  console.log('⚠️ App: Événement SIGNED_OUT reçu mais session toujours valide, ignoré (probable erreur 429)');
                  // Remettre l'utilisateur si la session est toujours valide
                  const parsedUser = JSON.parse(storedUser);
                  if (parsedUser.id === currentSession.user.id) {
                    setUser(parsedUser);
                  }
                  return; // Ignorer la déconnexion si la session est toujours valide
                }
              } catch (sessionError) {
                // En cas d'erreur ou timeout, vérifier le localStorage directement
                console.warn('⚠️ App: Erreur lors de la vérification de session, vérification du localStorage:', sessionError);
                // Si on a un utilisateur stocké, ne pas déconnecter immédiatement
                // Attendre un peu plus et réessayer
                await new Promise(resolve => setTimeout(resolve, 1000));
                const { data: { session: retrySession } } = await supabase.auth.getSession();
                if (retrySession && retrySession.user) {
                  console.log('⚠️ App: Session récupérée après retry, ignoré SIGNED_OUT');
                  const parsedUser = JSON.parse(storedUser);
                  if (parsedUser.id === retrySession.user.id) {
                    setUser(parsedUser);
                  }
                  return;
                }
              }
            } catch (error) {
              console.warn('⚠️ App: Erreur lors de la vérification de session:', error);
              // En cas d'erreur, ne pas déconnecter immédiatement, attendre un peu
              await new Promise(resolve => setTimeout(resolve, 1000));
              const { data: { session: finalSession } } = await supabase.auth.getSession();
              if (finalSession && finalSession.user) {
                console.log('⚠️ App: Session récupérée après erreur, ignoré SIGNED_OUT');
                const parsedUser = JSON.parse(storedUser);
                if (parsedUser.id === finalSession.user.id) {
                  setUser(parsedUser);
                }
                return;
              }
            }
          }
          
          console.log('👋 App: Utilisateur déconnecté');
          setUser(null);
          localStorage.removeItem('user');
          syncManager.stopAutoSync();
        }
      });

      const endTime = performance.now();
      console.log(`⏱️ App: Initialisation terminée en ${(endTime - startTime).toFixed(2)}ms`);

      return () => {
        subscription.unsubscribe();
        syncManager.stopAutoSync();
      };
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

      // Timeout pour la vérification de session
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout session')), 5000) // 5 secondes
      );

      const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]) as any;
      
      if (error) {
        console.warn('⚠️ App: Erreur lors de la récupération de session:', error);
        setLoading(false);
        return;
      }
      
      if (session) {
        console.log('✅ App: Session trouvée, récupération du profil utilisateur...');
        // Vérifier si la session est expirée ou proche de l'expiration
        const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
        const now = Date.now();
        const timeUntilExpiry = expiresAt - now;
        
        // Si la session expire dans moins de 5 minutes, essayer de la rafraîchir
        if (timeUntilExpiry < 300000 && timeUntilExpiry > 0) {
          console.log('🔄 App: Session expire bientôt, tentative de rafraîchissement...');
          try {
            const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshedSession && !refreshError) {
              console.log('✅ App: Session rafraîchie avec succès');
              await fetchUserProfile(refreshedSession.user.id);
            } else {
              console.log('⚠️ App: Impossible de rafraîchir la session, utilisation de la session actuelle');
              await fetchUserProfile(session.user.id);
            }
          } catch (refreshError) {
            console.warn('⚠️ App: Erreur lors du rafraîchissement, utilisation de la session actuelle:', refreshError);
            await fetchUserProfile(session.user.id);
          }
        } else {
          await fetchUserProfile(session.user.id);
        }
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
      // Timeout pour éviter les déconnexions prématurées
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout après 5 secondes')), 5000)
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
      case 'tiktok-live':
        return user ? <TikTokLiveSales /> : null;
      case 'payments':
        return <PaymentsList />;
      case 'expenses':
        return <ExpensesList />;
      case 'stock':
        return user ? <ProductsList user={user} /> : null;
      case 'tracking':
        return user ? <TrackingNumbersList user={user} /> : null;
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
      case 'referentials':
        return <ReferentialsManager />;
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
      <main className={`transition-all duration-300 ${isCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8 pt-16 md:pt-6 pb-3 sm:pb-4 md:pb-6">
          {renderCurrentPage()}
        </div>
      </main>
      <OfflineIndicator />
    </div>
  );
}

export default App;
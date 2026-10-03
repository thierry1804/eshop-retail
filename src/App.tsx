import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { devLog, devWarn } from './lib/devLog';
import { Navbar } from './components/Layout/Navbar';
import { LoginForm } from './components/Auth/LoginForm';
import { ConfigError } from './components/Debug/ConfigError';
import { supabase } from './lib/supabase';
import { User } from './types';
import { logger } from './lib/logger';
import { OfflineIndicator } from './components/Offline/OfflineIndicator';
import { syncManager } from './lib/offline/sync-manager';
import { useSidebar } from './contexts/SidebarContext';
import { getPageFromPathname, getPathnameForPage } from './lib/appRoutes';

const Dashboard = lazy(() =>
  import('./components/Dashboard/Dashboard').then((m) => ({ default: m.Dashboard }))
);
const ClientsList = lazy(() =>
  import('./components/Clients/ClientsList').then((m) => ({ default: m.ClientsList }))
);
const SalesList = lazy(() =>
  import('./components/Sales/SalesList').then((m) => ({ default: m.SalesList }))
);
const TikTokLiveSales = lazy(() =>
  import('./components/Sales/TikTokLiveSales').then((m) => ({ default: m.TikTokLiveSales }))
);
const PaymentsList = lazy(() =>
  import('./components/Payments/PaymentsList').then((m) => ({ default: m.PaymentsList }))
);
const LogsViewer = lazy(() =>
  import('./components/Admin/LogsViewer').then((m) => ({ default: m.LogsViewer }))
);
const ReferentialsManager = lazy(() =>
  import('./components/Admin/ReferentialsManager').then((m) => ({ default: m.ReferentialsManager }))
);
const ExpensesList = lazy(() => import('./components/Expenses/ExpensesList'));
const ProductsList = lazy(() =>
  import('./components/Stock/ProductsList').then((m) => ({ default: m.ProductsList }))
);
const InventoryList = lazy(() =>
  import('./components/Stock/InventoryList').then((m) => ({ default: m.InventoryList }))
);
const TrackingNumbersList = lazy(() =>
  import('./components/Stock/TrackingNumbersList').then((m) => ({ default: m.TrackingNumbersList }))
);
const DeliveriesList = lazy(() =>
  import('./components/Delivery/DeliveriesList').then((m) => ({ default: m.DeliveriesList }))
);
const PurchaseOrdersList = lazy(() =>
  import('./components/Supply/PurchaseOrdersList').then((m) => ({ default: m.PurchaseOrdersList }))
);
const CreatePurchaseOrderPage = lazy(() =>
  import('./components/Supply/CreatePurchaseOrderPage').then((m) => ({
    default: m.CreatePurchaseOrderPage,
  }))
);

function PageLoadFallback() {
  return (
    <div className="flex justify-center py-16">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2"
        style={{
          borderColor: 'color-mix(in srgb, var(--app-primary) 20%, transparent)',
          borderBottomColor: 'var(--app-primary)',
        }}
        role="status"
        aria-label="Chargement"
      />
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState(() =>
    typeof window !== 'undefined' ? getPageFromPathname(window.location.pathname) : 'dashboard'
  );
  const [pageParams, setPageParams] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const { isCollapsed } = useSidebar();

  // Flag pour éviter les initialisations multiples
  const hasInitializedRef = useRef(false);

  // Synchroniser l’URL (barre d’adresse) avec la page courante
  useEffect(() => {
    if (loading || !user) return;
    const next = getPathnameForPage(currentPage, pageParams);
    if (window.location.pathname !== next) {
      window.history.pushState({ page: currentPage }, '', next);
    }
  }, [currentPage, pageParams, user, loading]);

  useEffect(() => {
    const onPopState = () => {
      setCurrentPage(getPageFromPathname(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Écouter les événements de navigation personnalisés
  useEffect(() => {
    const handleNavigate = (event: CustomEvent) => {
      const page = event.detail;
      if (page) {
        logger.logNavigation(currentPage, page);
        setCurrentPage(page);
      }
    };

    window.addEventListener('navigate' as any, handleNavigate as EventListener);
    return () => {
      window.removeEventListener('navigate' as any, handleNavigate as EventListener);
    };
  }, [currentPage]);

  useEffect(() => {
    // Ne s'exécuter qu'une seule fois
    if (hasInitializedRef.current) {
      devLog('⚠️ App: Initialisation déjà effectuée, skip');
      return;
    }
    hasInitializedRef.current = true;

    devLog('🚀 App: Initialisation de l\'application');
    const startTime = performance.now();
    
    try {
      checkAuth();
      
      // Désactiver la synchronisation automatique pour éviter les requêtes excessives
      // Les données sont déjà dans Supabase, pas besoin de synchroniser en continu
      // syncManager.startAutoSync(); // Désactivé pour réduire les requêtes
      
      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        devLog(`🔄 App: Événement auth détecté: ${event}`);
        
        if (event === 'TOKEN_REFRESHED' && session) {
          // Ignorer silencieusement les rafraîchissements de token trop fréquents
          // Ne mettre à jour que si l'utilisateur n'est pas défini ou si c'est vraiment nécessaire
          if (!user) {
            devLog('🔄 App: Token rafraîchi, mise à jour de la session (utilisateur manquant)');
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
                devWarn('⚠️ App: Erreur lors de la mise à jour du localStorage:', error);
              }
            }
          }
          // Ne pas logger chaque rafraîchissement pour éviter le spam dans la console
          return;
        }
        
        if (event === 'SIGNED_IN' && session) {
          devLog('👤 App: Utilisateur connecté, récupération du profil...');
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
                  devLog('⚠️ App: Événement SIGNED_OUT reçu mais session toujours valide, ignoré (probable erreur 429)');
                  // Remettre l'utilisateur si la session est toujours valide
                  const parsedUser = JSON.parse(storedUser);
                  if (parsedUser.id === currentSession.user.id) {
                    setUser(parsedUser);
                  }
                  return; // Ignorer la déconnexion si la session est toujours valide
                }
              } catch (sessionError) {
                // En cas d'erreur ou timeout, vérifier le localStorage directement
                devWarn('⚠️ App: Erreur lors de la vérification de session, vérification du localStorage:', sessionError);
                // Si on a un utilisateur stocké, ne pas déconnecter immédiatement
                // Attendre un peu plus et réessayer
                await new Promise(resolve => setTimeout(resolve, 1000));
                const { data: { session: retrySession } } = await supabase.auth.getSession();
                if (retrySession && retrySession.user) {
                  devLog('⚠️ App: Session récupérée après retry, ignoré SIGNED_OUT');
                  const parsedUser = JSON.parse(storedUser);
                  if (parsedUser.id === retrySession.user.id) {
                    setUser(parsedUser);
                  }
                  return;
                }
              }
            } catch (error) {
              devWarn('⚠️ App: Erreur lors de la vérification de session:', error);
              // En cas d'erreur, ne pas déconnecter immédiatement, attendre un peu
              await new Promise(resolve => setTimeout(resolve, 1000));
              const { data: { session: finalSession } } = await supabase.auth.getSession();
              if (finalSession && finalSession.user) {
                devLog('⚠️ App: Session récupérée après erreur, ignoré SIGNED_OUT');
                const parsedUser = JSON.parse(storedUser);
                if (parsedUser.id === finalSession.user.id) {
                  setUser(parsedUser);
                }
                return;
              }
            }
          }
          
          devLog('👋 App: Utilisateur déconnecté');
          setUser(null);
          localStorage.removeItem('user');
          syncManager.stopAutoSync();
        }
      });

      const endTime = performance.now();
      devLog(`⏱️ App: Initialisation terminée en ${(endTime - startTime).toFixed(2)}ms`);

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
    devLog('🔍 App: Vérification de l\'authentification...');
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
          devLog('🔄 App: Utilisateur trouvé dans le localStorage, vérification de la session...');

          // Vérifier que la session est toujours valide
          const { data: { session }, error } = await supabase.auth.getSession();

          if (session && session.user.id === parsedUser.id) {
            devLog('✅ App: Session valide trouvée, restauration de l\'utilisateur');
            setUser(parsedUser);
            setLoading(false);
            return;
          } else {
            devLog('⚠️ App: Session expirée, nettoyage du localStorage');
            localStorage.removeItem('user');
          }
        } catch (error) {
          devWarn('⚠️ App: Erreur lors de la lecture du localStorage:', error);
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
        devWarn('⚠️ App: Erreur lors de la récupération de session:', error);
        setLoading(false);
        return;
      }
      
      if (session) {
        devLog('✅ App: Session trouvée, récupération du profil utilisateur...');
        // Vérifier si la session est expirée ou proche de l'expiration
        const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
        const now = Date.now();
        const timeUntilExpiry = expiresAt - now;
        
        // Si la session expire dans moins de 5 minutes, essayer de la rafraîchir
        if (timeUntilExpiry < 300000 && timeUntilExpiry > 0) {
          devLog('🔄 App: Session expire bientôt, tentative de rafraîchissement...');
          try {
            const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshedSession && !refreshError) {
              devLog('✅ App: Session rafraîchie avec succès');
              await fetchUserProfile(refreshedSession.user.id);
            } else {
              devLog('⚠️ App: Impossible de rafraîchir la session, utilisation de la session actuelle');
              await fetchUserProfile(session.user.id);
            }
          } catch (refreshError) {
            devWarn('⚠️ App: Erreur lors du rafraîchissement, utilisation de la session actuelle:', refreshError);
            await fetchUserProfile(session.user.id);
          }
        } else {
          await fetchUserProfile(session.user.id);
        }
      } else {
        devLog('❌ App: Aucune session trouvée');
        setLoading(false);
      }
    } catch (error) {
      devWarn('⚠️ App: Erreur lors de la vérification auth:', error);
      setLoading(false);
    } finally {
      const endTime = performance.now();
      devLog(`⏱️ App: Vérification auth terminée en ${(endTime - startTime).toFixed(2)}ms`);
    }
  };

  const fetchUserProfile = async (userId: string) => {
    devLog('👤 App: Récupération du profil utilisateur...');
    const startTime = performance.now();
    
    try {
      // Timeout pour éviter les déconnexions prématurées
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout après 5 secondes')), 5000)
      );

      const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]) as any;
      const authUser = session?.user;
      devLog('👤 App: Utilisateur connecté:', authUser?.email);

      if (error) {
        devWarn('⚠️ App: Erreur lors de la récupération de l\'utilisateur:', error);
        throw new Error('Erreur de session');
      }

      if (!authUser) {
        devWarn('⚠️ App: Aucun utilisateur trouvé dans la session');
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

      devLog('✅ App: Profil utilisateur créé:', userProfile.name, 'Rôle:', userProfile.role);

      // Sauvegarder dans le localStorage pour la persistance
      localStorage.setItem('user', JSON.stringify(userProfile));

      setUser(userProfile);

      // Définir la page par défaut selon le rôle
      if (userProfile.role !== 'admin') {
        setCurrentPage('clients');
      }

      setLoading(false);

    } catch (error) {
      devWarn('⚠️ App: Erreur lors de la récupération du profil:', error.message);
      setLoading(false);
    }
    
    const endTime = performance.now();
    devLog(`⏱️ App: Récupération profil terminée en ${(endTime - startTime).toFixed(2)}ms`);
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

      devLog('✅ App: Déconnexion réussie');
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
      case 'inventories':
        return user ? <InventoryList user={user} /> : null;
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--app-canvas)' }}>
        <PageLoadFallback />
      </div>
    );
  }

  if (!user) {
    // Forcer la connexion si aucun utilisateur
    devLog('🔐 App: Aucun utilisateur connecté, affichage du formulaire de connexion');
    return <LoginForm onLogin={checkAuth} />;
  }

  return (
    <div className="min-h-screen app-main">
      <Navbar user={user} currentPage={currentPage} onPageChange={(page) => {
        // Logger le changement de page
        logger.logNavigation(currentPage, page);
        setCurrentPage(page);
      }} onLogout={handleLogout} />
      <main className={`app-main transition-all duration-200 ${isCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 pt-14 md:pt-4 pb-4 md:pb-6">
          <Suspense fallback={<PageLoadFallback />}>
            {renderCurrentPage()}
          </Suspense>
        </div>
      </main>
      <OfflineIndicator />
    </div>
  );
}

export default App;
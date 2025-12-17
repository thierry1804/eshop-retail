import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AppTest } from './components/Debug/AppTest.tsx';
import { SimpleTest } from './components/Debug/SimpleTest.tsx';
import { SupabaseTest } from './components/Debug/SupabaseTest.tsx';
import { RLSTest } from './components/Debug/RLSTest.tsx';
import { DatabaseTest } from './components/Debug/DatabaseTest.tsx';
import { registerServiceWorker } from './lib/offline/register-sw';
import { SidebarProvider } from './contexts/SidebarContext';
import './index.css';
import './i18n';

// Enregistrer le service worker pour le PWA
registerServiceWorker();

// Temporairement utiliser DatabaseTest pour diagnostiquer
const useDatabaseTest = import.meta.env.VITE_DATABASE_TEST === 'true';
const useRLSTest = import.meta.env.VITE_RLS_TEST === 'true';
const useSupabaseTest = import.meta.env.VITE_SUPABASE_TEST === 'true';
const useSimpleTest = import.meta.env.VITE_SIMPLE_TEST === 'true';
const useTestMode = import.meta.env.VITE_TEST_MODE === 'true';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SidebarProvider>
      {useDatabaseTest ? <DatabaseTest /> : useRLSTest ? <RLSTest /> : useSupabaseTest ? <SupabaseTest /> : useSimpleTest ? <SimpleTest /> : useTestMode ? <AppTest /> : <App />}
    </SidebarProvider>
  </StrictMode>
);

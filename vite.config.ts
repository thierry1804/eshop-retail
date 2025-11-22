import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Séparer React et React DOM
          'react-vendor': ['react', 'react-dom', 'react-i18next'],
          // Séparer Supabase
          'supabase': ['@supabase/supabase-js'],
          // Séparer les bibliothèques de PDF et canvas (lourdes)
          'pdf-vendor': ['jspdf', 'html2canvas'],
          // Séparer les graphiques
          'charts': ['recharts'],
          // Séparer i18n
          'i18n': ['i18next', 'i18next-browser-languagedetector'],
          // Séparer les utilitaires de date
          'date-utils': ['date-fns'],
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Augmenter la limite à 1MB pour éviter les warnings inutiles
  },
});

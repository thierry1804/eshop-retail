import { registerSW } from 'virtual:pwa-register';
import { devLog } from '../devLog';

export const registerServiceWorker = () => {
  if ('serviceWorker' in navigator) {
    const updateSW = registerSW({
      immediate: true,
      onRegistered(registration) {
        devLog('✅ Service Worker enregistré:', registration);
      },
      onRegisterError(error) {
        console.error('❌ Erreur lors de l\'enregistrement du Service Worker:', error);
      },
      onNeedRefresh() {
        devLog('🔄 Nouvelle version disponible');
        if (confirm('Une nouvelle version de l\'application est disponible. Voulez-vous la charger maintenant ?')) {
          updateSW(true);
        }
      },
      onOfflineReady() {
        devLog('📴 Application prête pour le mode offline');
      }
    });

    return updateSW;
  }
  return null;
};


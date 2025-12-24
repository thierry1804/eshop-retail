import { registerSW } from 'virtual:pwa-register';

export const registerServiceWorker = () => {
  if ('serviceWorker' in navigator) {
    const updateSW = registerSW({
      immediate: true,
      onRegistered(registration) {
        console.log('✅ Service Worker enregistré:', registration);
      },
      onRegisterError(error) {
        console.error('❌ Erreur lors de l\'enregistrement du Service Worker:', error);
      },
      onNeedRefresh() {
        console.log('🔄 Nouvelle version disponible');
        if (confirm('Une nouvelle version de l\'application est disponible. Voulez-vous la charger maintenant ?')) {
          updateSW(true);
        }
      },
      onOfflineReady() {
        console.log('📴 Application prête pour le mode offline');
      }
    });

    return updateSW;
  }
  return null;
};


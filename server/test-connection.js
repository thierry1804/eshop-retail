import { WebcastPushConnection } from "tiktok-live-connector";
import dotenv from 'dotenv';

dotenv.config();

const username = process.env.TIKTOK_USERNAME;

if (!username) {
  console.error('❌ TIKTOK_USERNAME non défini dans .env');
  process.exit(1);
}

console.log(`🧪 Test de connexion TikTok pour: ${username}`);

const tiktok = new WebcastPushConnection(username, {
  requestOptions: { 
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  },
  clientParams: { 
    app_language: "fr-FR",
    browser_language: "fr-FR"
  }
});

tiktok.on('connected', (state) => {
  console.log('✅ Connexion réussie!');
  console.log('Room ID:', state.roomId);
  console.log('Viewer Count:', state.viewerCount);
  process.exit(0);
});

tiktok.on('disconnected', () => {
  console.log('❌ Déconnecté');
  process.exit(1);
});

tiktok.on('error', (err) => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});

console.log('🔄 Tentative de connexion...');
tiktok.connect().catch(err => {
  console.error('❌ Échec de connexion:', err.message || err);
  process.exit(1);
});

// Timeout après 10 secondes
setTimeout(() => {
  console.log('⏰ Timeout - le live n\'est probablement pas actif');
  process.exit(0);
}, 10000);

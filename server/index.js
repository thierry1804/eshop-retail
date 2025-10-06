import { WebcastPushConnection } from "tiktok-live-connector";
import { WebSocketServer } from 'ws';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const WS_PORT = process.env.WS_PORT || 3002;
const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME;

// Middleware
app.use(cors());
app.use(express.json());

// Serveur WebSocket
const wss = new WebSocketServer({ port: WS_PORT });

// Connexion TikTok Live
let tiktokConnection = null;
let isConnected = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

// Fonction pour créer une connexion TikTok
function createTikTokConnection() {
  if (!TIKTOK_USERNAME) {
    console.error('❌ TIKTOK_USERNAME non défini dans les variables d\'environnement');
    console.log('💡 Créez un fichier .env dans le dossier server/ avec: TIKTOK_USERNAME=votre_username');
    return null;
  }

  const tiktok = new WebcastPushConnection(TIKTOK_USERNAME, {
    requestOptions: { 
      timeout: 15000, // Augmenté le timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    },
    clientParams: { 
      app_language: "fr-FR",
      browser_language: "fr-FR",
      browser_platform: "Win32",
      browser_name: "Mozilla",
      browser_version: "5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    },
    enableExtendedGiftInfo: true,
    enableWebsocketUpgrade: true,
    processInitialData: true,
    // Ajout d'options pour améliorer la stabilité
    fetchRoomIdOnConnect: true,
    enableRequestLogging: false
  });

  // Événements de connexion
  tiktok.on('connected', (state) => {
    console.log(`✅ Connecté au LIVE TikTok: ${state.roomId}`);
    isConnected = true;
    reconnectAttempts = 0;
    
    
    // Notifier tous les clients WebSocket
    broadcastToClients({
      type: 'connection_status',
      status: 'connected',
      roomId: state.roomId,
      timestamp: new Date().toISOString()
    });
  });

  tiktok.on('disconnected', () => {
    console.log('❌ Déconnecté du LIVE TikTok');
    isConnected = false;
    
    // Notifier tous les clients WebSocket
    broadcastToClients({
      type: 'connection_status',
      status: 'disconnected',
      timestamp: new Date().toISOString()
    });

    // Tentative de reconnexion seulement si ce n'était pas une déconnexion volontaire
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      console.log(`🔄 Tentative de reconnexion ${reconnectAttempts}/${maxReconnectAttempts}...`);
      setTimeout(() => {
        // Vérifier que la connexion n'a pas été fermée manuellement
        if (tiktokConnection) {
          createTikTokConnection();
        }
      }, 5000 * reconnectAttempts); // Délai progressif
    } else {
      console.log('⏹️  Nombre maximum de tentatives de reconnexion atteint');
      console.log('💡 Utilisez l\'endpoint /reconnect pour réinitialiser les tentatives');
    }
  });

  tiktok.on('error', (err) => {
    // Convertir l'erreur en chaîne de caractères de manière sécurisée
    let errorMessage = 'Erreur inconnue';
    
    if (typeof err === 'string') {
      errorMessage = err;
    } else if (err && typeof err.message === 'string') {
      errorMessage = err.message;
    } else if (err && typeof err.toString === 'function') {
      errorMessage = err.toString();
    } else if (err) {
      errorMessage = JSON.stringify(err);
    }
    
    console.error('❌ Erreur TikTok Live:', {
      info: err?.info || 'Erreur de connexion',
      exception: err
    });
    
    // Gestion spécifique des erreurs courantes
    if (typeof errorMessage === 'string') {
      if (errorMessage.includes('Failed to extract Room ID')) {
        console.log('💡 Solution: Vérifiez que le live TikTok est actif et que le nom d\'utilisateur est correct');
        console.log('💡 Le live doit être en cours pour que la connexion fonctionne');
      } else if (errorMessage.includes('isn\'t online') || errorMessage.includes('offline')) {
        console.log('💡 Solution: L\'utilisateur n\'est pas en live actuellement');
        console.log('💡 Attendez qu\'un live soit lancé sur le compte:', TIKTOK_USERNAME);
      } else if (errorMessage.includes('not found')) {
        console.log('💡 Solution: Vérifiez que le nom d\'utilisateur TikTok est correct');
        console.log('💡 Le nom d\'utilisateur doit être exact (sans @)');
      }
    }
    
    broadcastToClients({
      type: 'error',
      message: errorMessage,
      timestamp: new Date().toISOString()
    });
  });

  // Événements du chat
  tiktok.on('chat', (data) => {
    console.log(`💬 [CHAT] ${data.uniqueId}: ${data.comment}`);
    
    const message = {
      type: 'chat',
      data: {
        uniqueId: data.uniqueId,
        nickname: data.nickname,
        comment: data.comment,
        timestamp: new Date().toISOString(),
        isJP: data.comment.toLowerCase().startsWith('jp'),
        userId: data.userId,
        profilePictureUrl: data.profilePictureUrl
      }
    };

    console.log('📤 Envoi message chat aux clients:', message);
    broadcastToClients(message);
  });

  // Événements des cadeaux
  tiktok.on('gift', (data) => {
    if (data.repeatEnd) {
      console.log(`🎁 [GIFT] ${data.uniqueId} -> ${data.giftName} x${data.repeatCount}`);
      
      broadcastToClients({
        type: 'gift',
        data: {
          uniqueId: data.uniqueId,
          nickname: data.nickname,
          giftName: data.giftName,
          repeatCount: data.repeatCount,
          timestamp: new Date().toISOString()
        }
      });
    }
  });

  // Événements des likes
  tiktok.on('like', (data) => {
    console.log(`❤️ [LIKE] ${data.uniqueId} a mis ${data.likeCount} like(s)`);
    
    broadcastToClients({
      type: 'like',
      data: {
        uniqueId: data.uniqueId,
        nickname: data.nickname,
        likeCount: data.likeCount,
        timestamp: new Date().toISOString()
      }
    });
  });




  return tiktok;
}

// Fonction pour diffuser un message à tous les clients connectés
function broadcastToClients(message) {
  const messageStr = JSON.stringify(message);
  const clientCount = wss.clients.size;
  let sentCount = 0;

  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(messageStr);
      sentCount++;
    }
  });

  console.log(`📡 Broadcast: ${sentCount}/${clientCount} clients ont reçu le message ${message.type}`);
}

// Gestion des connexions WebSocket
wss.on('connection', (ws) => {
  console.log('🔌 Nouveau client WebSocket connecté');
  
  // Envoyer le statut de connexion actuel
  ws.send(JSON.stringify({
    type: 'connection_status',
    status: isConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  }));

  ws.on('close', () => {
    console.log('🔌 Client WebSocket déconnecté');
  });

  ws.on('error', (error) => {
    console.error('❌ Erreur WebSocket:', error);
  });
});

// Routes API
app.get('/status', (req, res) => {
  res.json({
    status: isConnected ? 'connected' : 'disconnected',
    tiktokUsername: TIKTOK_USERNAME,
    reconnectAttempts,
    maxReconnectAttempts,
    hasUsername: !!TIKTOK_USERNAME,
    timestamp: new Date().toISOString()
  });
});

app.get('/config', (req, res) => {
  res.json({
    tiktokUsername: TIKTOK_USERNAME,
    hasUsername: !!TIKTOK_USERNAME,
    instructions: {
      setup: "Créez un fichier .env dans le dossier server/ avec: TIKTOK_USERNAME=votre_username",
      note: "Le nom d'utilisateur doit être exact (sans @) et le live doit être actif"
    }
  });
});

app.post('/connect', (req, res) => {
  if (tiktokConnection) {
    tiktokConnection.disconnect();
  }
  
  tiktokConnection = createTikTokConnection();
  if (tiktokConnection) {
    tiktokConnection.connect().catch(err => {
      // Convertir l'erreur en chaîne de caractères de manière sécurisée
      let errorMessage = 'Erreur de connexion inconnue';
      
      if (typeof err === 'string') {
        errorMessage = err;
      } else if (err && typeof err.message === 'string') {
        errorMessage = err.message;
      } else if (err && typeof err.toString === 'function') {
        errorMessage = err.toString();
      } else if (err) {
        errorMessage = JSON.stringify(err);
      }
      
      console.error('Erreur de connexion:', errorMessage);
    });
  }
  
  res.json({ message: 'Tentative de connexion initiée' });
});

app.post('/disconnect', (req, res) => {
  if (tiktokConnection) {
    tiktokConnection.disconnect();
    tiktokConnection = null;
  }
  res.json({ message: 'Déconnexion effectuée' });
});

app.post('/reconnect', (req, res) => {
  console.log('🔄 Demande de reconnexion reçue');
  
  // Déconnecter la connexion existante si elle existe
  if (tiktokConnection) {
    tiktokConnection.disconnect();
    tiktokConnection = null;
  }
  
  // Réinitialiser les tentatives de reconnexion
  reconnectAttempts = 0;
  
  // Créer une nouvelle connexion
  if (TIKTOK_USERNAME) {
    tiktokConnection = createTikTokConnection();
    if (tiktokConnection) {
      tiktokConnection.connect().catch(err => {
        // Convertir l'erreur en chaîne de caractères de manière sécurisée
        let errorMessage = 'Erreur de connexion inconnue';
        
        if (typeof err === 'string') {
          errorMessage = err;
        } else if (err && typeof err.message === 'string') {
          errorMessage = err.message;
        } else if (err && typeof err.toString === 'function') {
          errorMessage = err.toString();
        } else if (err) {
          errorMessage = JSON.stringify(err);
        }
        
        console.error('❌ Reconnexion échouée:', errorMessage);
      });
    }
  }
  
  res.json({ message: 'Tentative de reconnexion initiée' });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur TikTok Live démarré sur le port ${PORT}`);
  console.log(`🔌 WebSocket serveur sur le port ${WS_PORT}`);
  console.log(`📱 Username TikTok: ${TIKTOK_USERNAME || 'NON DÉFINI'}`);
  
  if (!TIKTOK_USERNAME) {
    console.log('⚠️  ATTENTION: TIKTOK_USERNAME non configuré');
    console.log('💡 Créez un fichier .env dans le dossier server/ avec:');
    console.log('   TIKTOK_USERNAME=votre_username_sans_@');
    console.log('📋 Endpoints disponibles:');
    console.log('   GET  http://localhost:' + PORT + '/status - Statut de la connexion');
    console.log('   GET  http://localhost:' + PORT + '/config - Configuration actuelle');
    console.log('   POST http://localhost:' + PORT + '/connect - Forcer la connexion');
    console.log('   POST http://localhost:' + PORT + '/reconnect - Réinitialiser et reconnecter');
    return;
  }
  
  // Connexion automatique si le username est défini
  console.log('🔄 Tentative de connexion automatique...');
  console.log('ℹ️  Note: Si le live n\'est pas actif, c\'est normal que la connexion échoue.');
  
  // Délai avant la première tentative pour éviter les erreurs de démarrage
  setTimeout(() => {
    tiktokConnection = createTikTokConnection();
    if (tiktokConnection) {
      tiktokConnection.connect().catch(err => {
        // Convertir l'erreur en chaîne de caractères de manière sécurisée
        let errorMessage = 'Erreur de connexion inconnue';
        
        if (typeof err === 'string') {
          errorMessage = err;
        } else if (err && typeof err.message === 'string') {
          errorMessage = err.message;
        } else if (err && typeof err.toString === 'function') {
          errorMessage = err.toString();
        } else if (err) {
          errorMessage = JSON.stringify(err);
        }
        
        console.error('❌ Connexion automatique échouée:', errorMessage);
        
        // Si c'est une erreur de live non actif, c'est normal
        if (typeof errorMessage === 'string' && (errorMessage.includes('live') || errorMessage.includes('offline') || errorMessage.includes('not found') || errorMessage.includes('Error while connecting'))) {
          console.log('ℹ️  Le live n\'est pas actif actuellement. Le serveur attendra qu\'un live soit lancé.');
          console.log('💡 Pour tester, lance un live TikTok sur le compte:', TIKTOK_USERNAME);
        }
      });
    }
  }, 2000); // Attendre 2 secondes avant de tenter la connexion
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du serveur...');
  if (tiktokConnection) {
    tiktokConnection.disconnect();
  }
  wss.close();
  process.exit(0);
});

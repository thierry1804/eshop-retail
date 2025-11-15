// Détecter automatiquement le protocole basé sur la page actuelle
const getProtocol = () => {
  if (typeof window !== 'undefined') {
    return window.location.protocol === 'https:' ? 'https:' : 'https:';
  }
  return 'https:'; // Par défaut, utiliser HTTPS
};

const getWebSocketProtocol = () => {
  if (typeof window !== 'undefined') {
    return window.location.protocol === 'https:' ? 'wss:' : 'wss:';
  }
  return 'wss:'; // Par défaut, utiliser WSS
};

// Utiliser les variables d'environnement si disponibles, sinon utiliser les valeurs par défaut
const TIKTOK_API_HOST = import.meta.env.VITE_TIKTOK_API_HOST || 'vps-7841b0bb.vps.ovh.ca:4431';
const TIKTOK_WS_HOST = import.meta.env.VITE_TIKTOK_WS_HOST || 'vps-7841b0bb.vps.ovh.ca:4432';

// Construire les URLs avec le bon protocole
// Permettre de forcer HTTP/WS en développement via variable d'environnement
// Par défaut, utiliser HTTPS/WSS pour la sécurité
const forceHttp = import.meta.env.VITE_TIKTOK_FORCE_HTTP === 'true';
const forceHttps = import.meta.env.VITE_TIKTOK_FORCE_HTTPS === 'true';

let protocol: string;
let wsProtocol: string;

if (forceHttp) {
  // Forcer HTTP/WS (développement local)
  protocol = 'http:';
  wsProtocol = 'wss:';
} else if (forceHttps) {
  // Forcer HTTPS/WSS (production)
  protocol = 'https:';
  wsProtocol = 'wss:';
} else {
  // Détection automatique basée sur le protocole de la page
  protocol = getProtocol();
  wsProtocol = getWebSocketProtocol();
}

const API_BASE_URL = `${protocol}//${TIKTOK_API_HOST}`;
const WS_URL = `${wsProtocol}//${TIKTOK_WS_HOST}`;

// Logger les URLs utilisées pour le débogage
console.log('🔧 TikTokApi: Configuration des URLs:', {
  API_BASE_URL,
  WS_URL,
  protocol,
  wsProtocol,
  forceHttp,
  forceHttps,
  currentPageProtocol: typeof window !== 'undefined' ? window.location.protocol : 'N/A'
});

export interface TikTokMessage {
  type: 'chat' | 'stats' | 'streamEnd' | 'error';
  data?: {
    uniqueId?: string;
    nickname?: string;
    comment?: string;
    timestamp?: number;
    viewers?: number;
    likes?: number;
    avatarUrl?: string;
    profilePicture?: string;
    avatar?: string;
  };
}

class TikTokApiService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private messageHandlers: Set<(message: TikTokMessage) => void> = new Set();
  private isConnecting = false;
  private shouldReconnect = false; // Flag pour contrôler la reconnexion automatique
  private currentUniqueId: string | null = null;
  private messageBuffer: TikTokMessage[] = []; // Buffer pour stocker les messages avant l'enregistrement des handlers

  /**
   * Démarrer l'écoute d'un live TikTok
   */
  async startListening(uniqueId: string): Promise<void> {
    try {
      // Vérifier d'abord si une connexion est déjà active
      const activeConnections = await this.getActiveConnections();
      const isAlreadyActive = activeConnections.length > 0;

      if (!isAlreadyActive) {
        // Si pas de connexion active, démarrer une nouvelle écoute
        const response = await fetch(`${API_BASE_URL}/api/tiktok/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uniqueId }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: 'Erreur lors du démarrage' }));
          throw new Error(error.message || 'Erreur lors du démarrage de l\'écoute');
        }
        // Activer la reconnexion seulement si on démarre une nouvelle connexion
        this.shouldReconnect = true;
      } else {
        // Si une connexion existe déjà, ne pas activer la reconnexion automatique
        // On se contente d'écouter les messages via WebSocket
        console.log('Serveur déjà actif, connexion directe au WebSocket pour écouter les messages');
        this.shouldReconnect = false;
      }

      this.currentUniqueId = uniqueId;
      // Connecter le WebSocket pour recevoir les messages (que ce soit une nouvelle connexion ou une existante)
      this.connectWebSocket();
    } catch (error) {
      console.error('Erreur lors du démarrage de l\'écoute:', error);
      throw error;
    }
  }

  /**
   * Arrêter l'écoute d'un live TikTok
   */
  async stopListening(uniqueId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tiktok/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uniqueId }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erreur lors de l\'arrêt' }));
        throw new Error(error.message || 'Erreur lors de l\'arrêt de l\'écoute');
      }

      // Déconnecter le WebSocket
      this.disconnectWebSocket();
      this.currentUniqueId = null;
      this.shouldReconnect = false;
    } catch (error) {
      console.error('Erreur lors de l\'arrêt de l\'écoute:', error);
      throw error;
    }
  }

  /**
   * Obtenir les connexions actives
   */
  async getActiveConnections(): Promise<string[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tiktok/active`);
      
      if (!response.ok) {
        // Si l'endpoint n'existe pas ou retourne une erreur, retourner un tableau vide
        // (le serveur peut ne pas avoir cet endpoint)
        return [];
      }

      const data = await response.json();
      // Gérer différents formats de réponse
      if (Array.isArray(data)) {
        return data;
      } else if (data.activeConnections && Array.isArray(data.activeConnections)) {
        return data.activeConnections;
      } else if (data.active && Array.isArray(data.active)) {
        return data.active;
      } else if (data.connections && Array.isArray(data.connections)) {
        return data.connections;
      }
      return [];
    } catch (error) {
      // En cas d'erreur (CORS, réseau, etc.), retourner un tableau vide
      // et laisser le code continuer (on essaiera quand même de démarrer)
      console.warn('Impossible de récupérer les connexions actives:', error);
      return [];
    }
  }

  /**
   * Connecter le WebSocket
   */
  private connectWebSocket(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.reconnectAttempts = 0;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('WebSocket connecté');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.notifyHandlers({
          type: 'stats',
          data: { comment: 'Connexion établie' }
        });
      };

      this.ws.onmessage = (event) => {
        try {
          console.log('📨 WebSocket message reçu (raw):', event.data, 'Type:', typeof event.data);
          
          // Gérer différents formats de messages
          let message: TikTokMessage;
          let parsed: any;
          
          // Si c'est déjà un objet, l'utiliser directement
          if (typeof event.data === 'object' && event.data !== null) {
            parsed = event.data;
          } else if (typeof event.data === 'string') {
            // Essayer de parser comme JSON
            try {
              parsed = JSON.parse(event.data);
            } catch (parseError) {
              // Si ce n'est pas du JSON, vérifier si c'est un message de chat au format texte
              // Format possible: "Message de username: comment"
              const textMatch = event.data.match(/Message de\s+([^:]+):\s*(.+)/);
              if (textMatch) {
                console.log('📨 Message détecté au format texte:', textMatch);
                this.notifyHandlers({
                  type: 'chat',
                  data: {
                    uniqueId: textMatch[1].trim(),
                    nickname: textMatch[1].trim(),
                    comment: textMatch[2].trim(),
                    timestamp: Date.now(),
                  }
                });
                return;
              }
              
              // Sinon, traiter comme texte brut
              console.log('⚠️ Message non-JSON, traitement comme texte brut');
              this.notifyHandlers({
                type: 'chat',
                data: {
                  comment: event.data,
                  uniqueId: 'unknown',
                  nickname: 'unknown',
                  timestamp: Date.now(),
                }
              });
              return;
            }
          } else {
            console.warn('⚠️ Format de message inconnu:', typeof event.data);
            return;
          }
          
          // Si le message a directement les propriétés (type, uniqueId, comment, etc.)
          if (parsed.type) {
            // Format standard avec type
            message = parsed;
            
            // Si c'est un message de type "chat" mais que les données sont au niveau racine
            if (parsed.type === 'chat' && !parsed.data && (parsed.uniqueId || parsed.comment)) {
              message = {
                type: 'chat',
                data: {
                  uniqueId: parsed.uniqueId || parsed.username || parsed.nickname || 'unknown',
                  nickname: parsed.nickname || parsed.username || parsed.uniqueId || 'unknown',
                  comment: parsed.comment || parsed.message || parsed.text || '',
                  timestamp: parsed.timestamp || Date.now(),
                  avatarUrl: parsed.avatarUrl || parsed.profilePicture || parsed.avatar,
                }
              };
            }
          } else if (parsed.uniqueId || parsed.comment || parsed.username || parsed.nickname || parsed.message) {
            // Format alternatif : message avec uniqueId/comment directement (sans type)
            // Vérifier si c'est un message de chat (a un comment/message)
            if (parsed.comment || parsed.message || parsed.text) {
              message = {
                type: 'chat',
                data: {
                  uniqueId: parsed.uniqueId || parsed.username || parsed.nickname || 'unknown',
                  nickname: parsed.nickname || parsed.username || parsed.uniqueId || 'unknown',
                  comment: parsed.comment || parsed.message || parsed.text || '',
                  timestamp: parsed.timestamp || Date.now(),
                  avatarUrl: parsed.avatarUrl || parsed.profilePicture || parsed.avatar,
                }
              };
            } else {
              // Pas de comment, probablement des stats
              message = {
                type: 'stats',
                data: parsed
              };
            }
          } else if (Object.keys(parsed).length > 0) {
            // Format inconnu mais avec des données
            // Si ça ressemble à des stats (viewerCount, etc.), traiter comme stats
            if (parsed.viewerCount !== undefined || parsed.likes !== undefined) {
              message = {
                type: 'stats',
                data: parsed
              };
            } else {
              // Sinon, essayer de le traiter comme un message chat
              message = {
                type: 'chat',
                data: {
                  ...parsed,
                  uniqueId: parsed.uniqueId || parsed.username || parsed.nickname || 'unknown',
                  nickname: parsed.nickname || parsed.username || parsed.uniqueId || 'unknown',
                  comment: parsed.comment || parsed.message || parsed.text || JSON.stringify(parsed),
                  timestamp: parsed.timestamp || Date.now(),
                  avatarUrl: parsed.avatarUrl || parsed.profilePicture || parsed.avatar,
                }
              };
            }
          } else {
            console.warn('⚠️ Message vide ou invalide:', parsed);
            return;
          }
          
          console.log('📨 WebSocket message parsé:', message);
          
          // Si on a des handlers, notifier immédiatement
          if (this.messageHandlers.size > 0) {
            this.notifyHandlers(message);
          } else {
            // Sinon, stocker dans le buffer pour traitement ultérieur
            console.warn('⚠️ WebSocket: Aucun handler enregistré, message mis en buffer:', message);
            this.messageBuffer.push(message);
            // Limiter la taille du buffer pour éviter les problèmes de mémoire
            if (this.messageBuffer.length > 100) {
              console.warn('⚠️ WebSocket: Buffer plein, suppression des anciens messages');
              this.messageBuffer.shift();
            }
          }
        } catch (error) {
          console.error('❌ Erreur lors du parsing du message WebSocket:', error, 'Raw data:', event.data);
          // Essayer de traiter comme un message texte brut
          if (typeof event.data === 'string' && event.data.trim()) {
            console.log('⚠️ Tentative de traitement comme message texte brut');
            this.notifyHandlers({
              type: 'chat',
              data: {
                comment: event.data,
                uniqueId: 'unknown',
                nickname: 'unknown',
                timestamp: Date.now(),
              }
            });
          }
        }
      };

      this.ws.onerror = (error) => {
        console.error('Erreur WebSocket:', error);
        this.isConnecting = false;
        this.notifyHandlers({
          type: 'error',
          data: { comment: 'Erreur de connexion WebSocket' }
        });
      };

      this.ws.onclose = (event) => {
        console.log('🔌 WebSocket fermé', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          shouldReconnect: this.shouldReconnect,
          handlers: this.messageHandlers.size,
          reconnectAttempts: this.reconnectAttempts
        });
        this.isConnecting = false;
        
        // Ne pas déconnecter si c'est une fermeture normale et qu'on a encore des handlers
        // ou si on est en train d'écouter un stream
        if (event.wasClean && event.code === 1000 && this.currentUniqueId) {
          console.log('ℹ️ WebSocket fermé proprement, mais on continue d\'écouter');
          // Ne pas tenter de reconnexion si c'était une fermeture propre
          return;
        }
        
        // Tentative de reconnexion automatique seulement si shouldReconnect est true
        // ET qu'on a encore des handlers actifs
        if (this.shouldReconnect && this.messageHandlers.size > 0 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`🔄 Tentative de reconnexion ${this.reconnectAttempts}/${this.maxReconnectAttempts} dans ${this.reconnectDelay}ms`);
          setTimeout(() => {
            if (this.messageHandlers.size > 0 && this.currentUniqueId) {
              console.log('🔄 Reconnexion en cours...');
              this.connectWebSocket();
            } else {
              console.log('⚠️ Pas de reconnexion: plus de handlers ou pas d\'uniqueId');
            }
          }, this.reconnectDelay);
        } else if (this.messageHandlers.size > 0 && this.currentUniqueId && !this.shouldReconnect) {
          // Si on a des handlers mais qu'on n'a pas démarré la connexion nous-mêmes,
          // essayer quand même de se reconnecter (le serveur peut être toujours actif)
          console.log('🔄 Reconnexion pour stream existant...');
          this.reconnectAttempts = 0; // Réinitialiser les tentatives
          setTimeout(() => {
            if (this.messageHandlers.size > 0 && this.currentUniqueId) {
              this.connectWebSocket();
            }
          }, this.reconnectDelay);
        } else {
          console.log('ℹ️ Pas de reconnexion:', {
            shouldReconnect: this.shouldReconnect,
            handlers: this.messageHandlers.size,
            uniqueId: this.currentUniqueId,
            maxAttempts: this.reconnectAttempts >= this.maxReconnectAttempts
          });
        }
      };
    } catch (error) {
      console.error('Erreur lors de la connexion WebSocket:', error);
      this.isConnecting = false;
      this.notifyHandlers({
        type: 'error',
        data: { comment: 'Impossible de se connecter au serveur' }
      });
    }
  }

  /**
   * Déconnecter le WebSocket
   */
  private disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
    this.isConnecting = false;
  }

  /**
   * Se connecter directement au WebSocket sans démarrer une nouvelle écoute
   * Utile quand le serveur est déjà en cours d'exécution
   */
  connectToExistingStream(): void {
    // Ne pas activer la reconnexion automatique car on n'a pas démarré cette connexion
    this.shouldReconnect = false;
    this.connectWebSocket();
  }

  /**
   * S'abonner aux messages
   */
  onMessage(handler: (message: TikTokMessage) => void): () => void {
    console.log('📝 TikTokApi: Ajout d\'un handler de messages');
    this.messageHandlers.add(handler);
    console.log('📝 TikTokApi: Nombre de handlers actifs:', this.messageHandlers.size);
    
    // Si on a des messages en buffer, les traiter maintenant
    if (this.messageBuffer.length > 0) {
      console.log(`📨 TikTokApi: Traitement de ${this.messageBuffer.length} message(s) en buffer`);
      const bufferedMessages = [...this.messageBuffer];
      this.messageBuffer = []; // Vider le buffer
      bufferedMessages.forEach((msg, index) => {
        console.log(`📨 TikTokApi: Traitement du message bufferisé ${index + 1}/${bufferedMessages.length}`);
        try {
          handler(msg);
        } catch (error) {
          console.error(`❌ TikTokApi: Erreur lors du traitement du message bufferisé:`, error);
        }
      });
    }
    
    // Si le WebSocket n'est pas connecté et qu'on a des handlers, se connecter
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('📝 TikTokApi: WebSocket non connecté, connexion en cours...');
      // Si on n'a pas de currentUniqueId, c'est qu'on se connecte à un stream existant
      if (!this.currentUniqueId) {
        this.shouldReconnect = false;
        console.log('📝 TikTokApi: Pas de currentUniqueId, pas de reconnexion automatique');
      }
      this.connectWebSocket();
    } else {
      console.log('📝 TikTokApi: WebSocket déjà connecté, handler ajouté');
    }

    // Retourner une fonction de désabonnement
    return () => {
      console.log('📝 TikTokApi: Suppression d\'un handler de messages');
      this.messageHandlers.delete(handler);
      console.log('📝 TikTokApi: Nombre de handlers restants:', this.messageHandlers.size);
      // NE PAS déconnecter automatiquement si on a encore un uniqueId actif
      // Le WebSocket doit rester ouvert tant qu'on écoute un stream
      if (this.messageHandlers.size === 0 && !this.currentUniqueId) {
        console.log('📝 TikTokApi: Plus aucun handler ET pas d\'uniqueId actif, déconnexion du WebSocket');
        this.disconnectWebSocket();
      } else if (this.messageHandlers.size === 0) {
        console.log('📝 TikTokApi: Plus aucun handler mais uniqueId actif, on garde le WebSocket ouvert');
      }
    };
  }

  /**
   * Notifier tous les handlers
   */
  private notifyHandlers(message: TikTokMessage): void {
    console.log('📢 TikTokApi: Notification de', this.messageHandlers.size, 'handler(s) avec message:', message);
    if (this.messageHandlers.size === 0) {
      console.warn('⚠️ TikTokApi: Aucun handler enregistré pour recevoir le message!');
    }
    let index = 0;
    this.messageHandlers.forEach((handler) => {
      try {
        index++;
        console.log(`📢 TikTokApi: Appel du handler ${index}/${this.messageHandlers.size}`);
        handler(message);
      } catch (error) {
        console.error(`❌ TikTokApi: Erreur dans le handler ${index}:`, error);
      }
    });
  }

  /**
   * Vérifier si le WebSocket est connecté
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Nettoyer les ressources
   */
  cleanup(): void {
    this.disconnectWebSocket();
    this.messageHandlers.clear();
    this.shouldReconnect = false;
    this.currentUniqueId = null;
  }
}

// Instance singleton
export const tiktokApi = new TikTokApiService();


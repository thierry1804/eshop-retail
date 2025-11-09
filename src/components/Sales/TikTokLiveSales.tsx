import React, { useState, useEffect, useRef, lazy, Suspense, useMemo } from 'react';
import { Video, Play, Square, MessageSquare, AlertCircle, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { tiktokApi } from '../../lib/tiktokApi';
import { TikTokMessage } from '../../types';
import { supabase } from '../../lib/supabase';
import { Client } from '../../types';

// Lazy load du formulaire de vente pour améliorer les performances
const SaleForm = lazy(() => import('./SaleForm').then(module => ({ default: module.SaleForm })));

interface ChatMessage {
  id: string;
  uniqueId: string;
  nickname: string;
  comment: string;
  timestamp: number;
  displayTime: string;
  avatarUrl?: string;
}

export const TikTokLiveSales: React.FC = () => {
  const { t } = useTranslation();
  const [uniqueId, setUniqueId] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stats, setStats] = useState<{ viewers?: number; likes?: number }>({});
  const [error, setError] = useState<string | null>(null);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [saleDescription, setSaleDescription] = useState('');
  const [messageFilter, setMessageFilter] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const hasCheckedServer = useRef(false);
  const isMountedRef = useRef(true);
  const isConnectedRef = useRef(false);

  // Filtrer les messages selon le terme de recherche
  const filteredMessages = useMemo(() => {
    if (!messageFilter.trim()) {
      return messages;
    }
    const filterLower = messageFilter.toLowerCase().trim();
    return messages.filter(message => {
      const comment = message.comment.toLowerCase();
      const nickname = message.nickname.toLowerCase();
      const uniqueId = message.uniqueId.toLowerCase();
      return comment.includes(filterLower) || 
             nickname.includes(filterLower) || 
             uniqueId.includes(filterLower);
    });
  }, [messages, messageFilter]);

  // Auto-scroll vers le bas quand de nouveaux messages filtrés arrivent
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredMessages]);

  // S'abonner aux messages IMMÉDIATEMENT au montage du composant
  // Cela garantit qu'on ne manque aucun message, même ceux qui arrivent très tôt
  useEffect(() => {
    if (!unsubscribeRef.current) {
      console.log('📝 TikTokLiveSales: Enregistrement du handler de messages au montage');
      unsubscribeRef.current = tiktokApi.onMessage((message: TikTokMessage) => {
        console.log('📨 TikTokLiveSales: Message reçu via handler:', message);
        handleMessage(message);
      });
    }
    
    return () => {
      // Ne pas désabonner ici car on veut garder les messages même pendant les re-renders
    };
  }, []); // Dépendances vides = uniquement au montage

  // Vérifier au chargement si le serveur est déjà en cours d'exécution
  useEffect(() => {
    const checkServerStatus = async () => {
      if (hasCheckedServer.current) return;
      hasCheckedServer.current = true;

      try {
        console.log('🔍 TikTokLiveSales: Vérification du statut du serveur...');
        const activeConnections = await tiktokApi.getActiveConnections();
        console.log('🔍 TikTokLiveSales: Connexions actives trouvées:', activeConnections);
        
        // S'assurer que le handler est bien enregistré (au cas où le premier useEffect n'a pas fonctionné)
        if (!unsubscribeRef.current) {
          console.log('📝 TikTokLiveSales: Enregistrement du handler de messages (fallback)');
          unsubscribeRef.current = tiktokApi.onMessage((message: TikTokMessage) => {
            console.log('📨 TikTokLiveSales: Message reçu via handler (fallback):', message);
            handleMessage(message);
          });
        }
        
        if (activeConnections.length > 0) {
          // Si une connexion est active, utiliser le premier uniqueId trouvé
          const activeUniqueId = activeConnections[0];
          console.log('✅ TikTokLiveSales: Serveur déjà actif, démarrage de l\'écoute pour', activeUniqueId);
          setUniqueId(activeUniqueId);
          
          // TOUJOURS appeler startListening pour s'assurer qu'on reçoit les messages
          // Le backend peut nécessiter que chaque client démarre l'écoute pour recevoir les messages
          try {
            await tiktokApi.startListening(activeUniqueId);
            console.log('✅ TikTokLiveSales: Écoute démarrée avec succès pour', activeUniqueId);
            setIsListening(true);
            
            // Attendre un peu pour que le WebSocket se connecte
            setTimeout(() => {
              if (tiktokApi.isConnected()) {
                console.log('✅ TikTokLiveSales: WebSocket confirmé connecté');
                isConnectedRef.current = true;
                setIsConnected(true);
              } else {
                console.warn('⚠️ TikTokLiveSales: WebSocket pas encore connecté après startListening');
              }
            }, 1000);
          } catch (error) {
            console.error('❌ TikTokLiveSales: Erreur lors du démarrage de l\'écoute:', error);
            // Même en cas d'erreur, on reste connecté au WebSocket
            setIsListening(true);
          }
        } else {
          console.log('ℹ️ TikTokLiveSales: Aucune connexion active détectée, connexion directe au WebSocket');
          // Se connecter au WebSocket même sans connexion active détectée
          // Le serveur peut être actif même si l'endpoint /api/tiktok/active ne fonctionne pas
          setIsListening(true);
        }
        
        // Vérifier immédiatement si le WebSocket est déjà connecté
        if (tiktokApi.isConnected()) {
          console.log('✅ TikTokLiveSales: WebSocket déjà connecté au chargement');
          isConnectedRef.current = true;
          setIsConnected(true);
        } else {
          // Vérifier périodiquement si le WebSocket est connecté
          const checkConnection = setInterval(() => {
            if (tiktokApi.isConnected()) {
              console.log('✅ TikTokLiveSales: WebSocket connecté (vérification périodique)');
              isConnectedRef.current = true;
              setIsConnected(true);
              setIsListening(true);
              clearInterval(checkConnection);
            }
          }, 500);

          // Arrêter la vérification après 10 secondes
          setTimeout(() => {
            clearInterval(checkConnection);
            if (tiktokApi.isConnected()) {
              isConnectedRef.current = true;
              setIsConnected(true);
              setIsListening(true);
              console.log('✅ TikTokLiveSales: WebSocket finalement connecté');
            } else {
              console.warn('⚠️ TikTokLiveSales: WebSocket non connecté après 10 secondes');
            }
          }, 10000);
        }
      } catch (error) {
        console.error('❌ TikTokLiveSales: Erreur lors de la vérification du serveur:', error);
        // Même en cas d'erreur, essayer de se connecter au WebSocket
        if (!unsubscribeRef.current) {
          unsubscribeRef.current = tiktokApi.onMessage((message: TikTokMessage) => {
            handleMessage(message);
          });
        }
        setIsListening(true);
      }
    };

    checkServerStatus();
  }, []);

  // Marquer le composant comme monté
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Nettoyer la connexion au démontage UNIQUEMENT (pas lors des re-renders)
  useEffect(() => {
    return () => {
      // Vérifier que c'est vraiment un démontage, pas juste un re-render
      if (!isMountedRef.current) {
        console.log('🧹 TikTokLiveSales: Nettoyage au démontage du composant');
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
        // Ne pas appeler stopListening ici car cela fermerait le stream pour tous les clients
        // Le backend gère déjà les déconnexions WebSocket
      } else {
        console.log('ℹ️ TikTokLiveSales: Re-render détecté, pas de nettoyage');
      }
    };
  }, []); // Dépendances vides = uniquement au démontage

  // Formater le timestamp
  const formatTimestamp = (timestamp?: number): string => {
    if (!timestamp) {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      const centiseconds = Math.floor(now.getMilliseconds() / 10).toString().padStart(2, '0');
      return `${hours}:${minutes}:${seconds}.${centiseconds}`;
    }
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const centiseconds = Math.floor(date.getMilliseconds() / 10).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}.${centiseconds}`;
  };

  // Démarrer l'écoute
  const handleStart = async () => {
    if (!uniqueId.trim()) {
      setError('Veuillez saisir un uniqueId TikTok');
      return;
    }

    setError(null);
    setIsListening(true);

    try {
      await tiktokApi.startListening(uniqueId.trim());
      
      // S'abonner aux messages AVANT de vérifier la connexion
      if (!unsubscribeRef.current) {
        unsubscribeRef.current = tiktokApi.onMessage((message: TikTokMessage) => {
          handleMessage(message);
        });
      }

      // Vérifier la connexion immédiatement après l'abonnement
      // Le WebSocket peut être déjà connecté
      const checkConnection = () => {
        const connected = tiktokApi.isConnected();
        if (connected) {
          console.log('✅ TikTokLiveSales: WebSocket déjà connecté, mise à jour de l\'état');
          isConnectedRef.current = true;
          setIsConnected(true);
          return true;
        }
        return false;
      };

      // Vérification immédiate
      if (!checkConnection()) {
        // Si pas encore connecté, on laisse isConnected à false
        // Il sera mis à jour par les messages ou les vérifications périodiques
        isConnectedRef.current = false;
        setIsConnected(false);
      }
      
      // Si pas encore connecté, vérifications périodiques jusqu'à ce que connecté ou timeout
      if (!tiktokApi.isConnected()) {
        let attempts = 0;
        const maxAttempts = 20; // 10 secondes max (20 * 500ms)
        const interval = setInterval(() => {
          attempts++;
          if (checkConnection() || attempts >= maxAttempts) {
            clearInterval(interval);
            if (attempts >= maxAttempts && !tiktokApi.isConnected()) {
              console.warn('⚠️ WebSocket non connecté après 10 secondes');
            }
          }
        }, 500);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du démarrage de l\'écoute');
      setIsListening(false);
      isConnectedRef.current = false;
      setIsConnected(false);
    }
  };

  // Arrêter l'écoute
  const handleStop = async () => {
    try {
      if (uniqueId) {
        await tiktokApi.stopListening(uniqueId);
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      setIsListening(false);
      isConnectedRef.current = false;
      setIsConnected(false);
      setMessages([]);
      setStats({});
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'arrêt de l\'écoute');
    }
  };

  // Gérer les messages reçus
  const handleMessage = (message: TikTokMessage) => {
    console.log('📥 TikTokLiveSales: Message reçu:', message);
    switch (message.type) {
      case 'chat':
        console.log('💬 Message de type chat:', message.data);
        // Si on reçoit un message de chat, c'est que le WebSocket est connecté
        // TOUJOURS mettre à jour pour s'assurer que l'état est synchronisé
        // Utiliser une fonction de mise à jour pour éviter les problèmes de closure
        setIsConnected((prevConnected) => {
          if (!prevConnected) {
            console.log('✅ TikTokLiveSales: Connexion détectée via message de chat');
            isConnectedRef.current = true;
            return true;
          }
          return prevConnected;
        });
        
        // Accepter les messages même si certains champs sont manquants
        const comment = message.data?.comment || message.data?.message || message.data?.text || '';
        const uniqueId = message.data?.uniqueId || message.data?.username || message.data?.nickname || 'unknown';
        
        if (comment || uniqueId !== 'unknown') {
          const newMessage: ChatMessage = {
            id: `${Date.now()}-${Math.random()}`,
            uniqueId: uniqueId,
            nickname: message.data?.nickname || message.data?.username || uniqueId,
            comment: comment || '(message vide)',
            timestamp: message.data?.timestamp || Date.now(),
            displayTime: formatTimestamp(message.data?.timestamp),
            avatarUrl: message.data?.avatarUrl || message.data?.profilePicture || message.data?.avatar,
          };
          console.log('✅ Ajout du message à la liste:', newMessage);
          setMessages(prev => [...prev, newMessage]);
        } else {
          console.warn('⚠️ Message chat invalide - aucune donnée utile:', message.data);
        }
        break;

      case 'stats':
        if (message.data) {
          // Détecter si c'est un message de connexion établie
          if (message.data.comment === 'Connexion établie' || message.data.comment?.includes('Connexion')) {
            console.log('✅ TikTokLiveSales: Connexion WebSocket établie détectée');
            isConnectedRef.current = true;
            setIsConnected(true);
          }
          
          // Mettre à jour les stats si disponibles
          if (message.data.viewers !== undefined || message.data.likes !== undefined) {
            setStats({
              viewers: message.data.viewers,
              likes: message.data.likes,
            });
          }
        }
        break;

      case 'streamEnd':
        setIsListening(false);
        isConnectedRef.current = false;
        setIsConnected(false);
        setError('Le stream a pris fin');
        break;

      case 'error':
        const errorMessage = message.data?.error || message.data?.comment || 'Une erreur est survenue';
        console.error('❌ TikTokLiveSales: Erreur reçue:', errorMessage, message.data);
        // Ne pas afficher l'erreur si c'est juste une erreur temporaire du backend
        // Le WebSocket peut continuer à fonctionner
        if (errorMessage.includes('Erreur inconnue') || errorMessage.includes('timeout')) {
          console.warn('⚠️ TikTokLiveSales: Erreur temporaire ignorée, connexion maintenue');
          // Ne pas définir l'erreur pour ne pas perturber l'utilisateur
        } else {
          setError(errorMessage);
        }
        break;
    }
  };

  // Rechercher un client par TikTok ID
  const findClientByTikTokId = async (tiktokUniqueId: string): Promise<Client | null> => {
    try {
      // Normaliser l'ID (enlever @ si présent, mettre en minuscules)
      const normalizedId = tiktokUniqueId.replace(/^@/, '').toLowerCase().trim();

      // Rechercher d'abord par tiktok_nick_name (recherche exacte après normalisation)
      const { data: clientsByNick, error: errorNick } = await supabase
        .from('clients')
        .select('*')
        .not('tiktok_nick_name', 'is', null);

      if (!errorNick && clientsByNick) {
        const clientByNick = clientsByNick.find(client => {
          const clientNick = (client.tiktok_nick_name || '').replace(/^@/, '').toLowerCase().trim();
          return clientNick === normalizedId;
        });
        if (clientByNick) {
          return clientByNick as Client;
        }
      }

      // Si non trouvé, rechercher par tiktok_id (recherche exacte après normalisation)
      const { data: clientsById, error: errorId } = await supabase
        .from('clients')
        .select('*')
        .not('tiktok_id', 'is', null);

      if (!errorId && clientsById) {
        const clientById = clientsById.find(client => {
          const clientId = (client.tiktok_id || '').toLowerCase().trim();
          return clientId === normalizedId;
        });
        if (clientById) {
          return clientById as Client;
        }
      }

      return null;
    } catch (error) {
      console.error('Erreur lors de la recherche du client:', error);
      return null;
    }
  };

  // Créer un client automatiquement depuis un message TikTok
  const createClientFromTikTokMessage = async (message: ChatMessage): Promise<Client | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const normalizedId = message.uniqueId.replace(/^@/, '').toLowerCase().trim();
      
      // Extraire le prénom et nom du nickname si possible
      const nameParts = message.nickname.trim().split(/\s+/);
      const firstName = nameParts[0] || message.nickname || 'Client';
      const lastName = nameParts.slice(1).join(' ') || 'TikTok';
      
      const newClient = {
        first_name: firstName,
        last_name: lastName,
        phone: '', // Pas de téléphone disponible depuis TikTok
        address: '',
        trust_rating: 'good' as const,
        notes: `Client créé automatiquement depuis TikTok Live. UniqueId: ${message.uniqueId}`,
        tiktok_id: normalizedId,
        tiktok_nick_name: message.uniqueId,
        created_by: user?.id,
      };

      const { data, error } = await supabase
        .from('clients')
        .insert(newClient as any)
        .select()
        .single();

      if (error) {
        console.error('Erreur lors de la création du client:', error);
        return null;
      }

      console.log('✅ Client créé automatiquement:', data);
      return data as Client;
    } catch (error) {
      console.error('Erreur lors de la création du client:', error);
      return null;
    }
  };

  // Gérer le clic sur un message
  const handleMessageClick = async (message: ChatMessage) => {
    setSelectedMessage(message);
    
    // Rechercher le client
    let client = await findClientByTikTokId(message.uniqueId);
    
    // Si le client n'existe pas, le créer automatiquement
    if (!client) {
      console.log('📝 Client non trouvé, création automatique...');
      client = await createClientFromTikTokMessage(message);
    }
    
    setSelectedClient(client);
    
    // Pré-remplir la description avec le message
    setSaleDescription(`Message TikTok: "${message.comment}"`);
    
    // Ouvrir le formulaire de vente
    setShowSaleForm(true);
  };

  // Fermer le formulaire de vente
  const handleSaleFormClose = () => {
    setShowSaleForm(false);
    setSelectedMessage(null);
    setSelectedClient(null);
    setSaleDescription('');
  };

  // Soumettre la vente
  const handleSaleSubmit = () => {
    handleSaleFormClose();
    // Le formulaire gère déjà la sauvegarde
  };

  return (
    <div className="p-6 flex flex-col h-screen min-h-0 overflow-hidden">
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Video className="h-6 w-6 text-blue-600" />
          {t('sales.tiktokLive.title', 'Ventes Live TikTok')}
        </h1>
        <p className="text-gray-600 mt-1">
          {t('sales.tiktokLive.subtitle', 'Écoutez les messages TikTok en direct et créez des ventes rapidement')}
        </p>
      </div>

      {/* Contrôles */}
      <div className="bg-white rounded-lg shadow p-6 mb-6 flex-shrink-0">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('sales.tiktokLive.uniqueId', 'UniqueId TikTok')}
            </label>
            <input
              type="text"
              value={uniqueId}
              onChange={(e) => setUniqueId(e.target.value)}
              disabled={isListening}
              placeholder="shentyandrianirina"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
          <div className="flex gap-2">
            {!isListening ? (
              <button
                onClick={handleStart}
                disabled={!uniqueId.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <Play className="h-4 w-4" />
                {t('sales.tiktokLive.start', 'Démarrer l\'écoute')}
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                <Square className="h-4 w-4" />
                {t('sales.tiktokLive.stop', 'Arrêter l\'écoute')}
              </button>
            )}
          </div>
        </div>

        {/* Statut de connexion */}
        <div className="mt-4 flex items-center gap-2">
          <div
            className={`h-3 w-3 rounded-full ${
              isConnected ? 'bg-green-500' : isListening ? 'bg-yellow-500 animate-pulse' : 'bg-gray-400'
            }`}
          />
          <span className="text-sm text-gray-600">
            {isConnected
              ? t('sales.tiktokLive.connected', 'Connecté')
              : isListening
              ? t('sales.tiktokLive.connecting', 'Connexion en cours...')
              : t('sales.tiktokLive.disconnected', 'Déconnecté')}
          </span>
        </div>

        {/* Statistiques */}
        {(stats.viewers || stats.likes) && (
          <div className="mt-4 flex gap-4 text-sm">
            {stats.viewers && (
              <div className="text-gray-600">
                <span className="font-medium">Viewers:</span> {stats.viewers}
              </div>
            )}
            {stats.likes && (
              <div className="text-gray-600">
                <span className="font-medium">Likes:</span> {stats.likes}
              </div>
            )}
          </div>
        )}

        {/* Erreur */}
        {error && (
          <div className="mt-4 flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Liste des messages */}
      <div className="bg-white rounded-lg shadow flex flex-col flex-1 min-h-0">
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              {t('sales.tiktokLive.messages', 'Messages en direct')}
              {filteredMessages.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({filteredMessages.length}{messageFilter && filteredMessages.length !== messages.length ? ` / ${messages.length}` : ''})
                </span>
              )}
            </h2>
          </div>
          {/* Filtre de recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={messageFilter}
              onChange={(e) => setMessageFilter(e.target.value)}
              placeholder="Filtrer les messages (ex: jp, prix, etc.)"
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            {messageFilter && (
              <button
                onClick={() => setMessageFilter('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {filteredMessages.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              {messageFilter ? (
                <div>
                  <p>Aucun message ne correspond au filtre "{messageFilter}"</p>
                  <button
                    onClick={() => setMessageFilter('')}
                    className="mt-2 text-blue-600 hover:text-blue-700 text-sm underline"
                  >
                    Effacer le filtre
                  </button>
                </div>
              ) : isConnected ? (
                t('sales.tiktokLive.noMessages', 'Aucun message pour le moment')
              ) : (
                t('sales.tiktokLive.waiting', 'En attente de connexion...')
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMessages.map((message) => (
                <div
                  key={message.id}
                  onClick={() => handleMessageClick(message)}
                  className="p-3 border border-gray-200 rounded-md hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 flex gap-3">
                      {/* Photo de profil */}
                      <div className="flex-shrink-0 relative">
                        {message.avatarUrl ? (
                          <img
                            src={message.avatarUrl}
                            alt={message.nickname}
                            className="w-10 h-10 rounded-full object-cover border border-gray-200"
                            onError={(e) => {
                              // Si l'image ne charge pas, masquer l'image et afficher le placeholder
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const placeholder = target.parentElement?.querySelector('.avatar-placeholder') as HTMLElement;
                              if (placeholder) {
                                placeholder.style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <div
                          className={`avatar-placeholder w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm ${
                            message.avatarUrl ? 'hidden' : 'flex'
                          }`}
                        >
                          {message.nickname.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">
                            {message.nickname}
                          </span>
                          <span className="text-xs text-gray-500">@{message.uniqueId}</span>
                        </div>
                        <p className="text-gray-700 break-words">{message.comment}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                      {message.displayTime}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Formulaire de vente */}
      {showSaleForm && (
        <Suspense fallback={
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 shadow-xl">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Chargement du formulaire...</p>
            </div>
          </div>
        }>
          <SaleForm
            sale={selectedClient ? {
              id: '',
              client_id: selectedClient.id,
              description: saleDescription,
              total_amount: 0,
              deposit: 0,
              remaining_balance: 0,
              status: 'ongoing',
              created_at: new Date().toISOString(),
              created_by: '',
            } : undefined}
            onClose={handleSaleFormClose}
            onSubmit={handleSaleSubmit}
          />
        </Suspense>
      )}
    </div>
  );
};


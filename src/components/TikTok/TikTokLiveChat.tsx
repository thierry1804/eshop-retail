import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Wifi, WifiOff, Plus, Heart, Gift } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TikTokChatMessage, WebSocketMessage, TikTokLiveConnection } from '../../types';

interface TikTokLiveChatProps {
  onCreateSaleFromJP: (message: TikTokChatMessage) => void;
}

export const TikTokLiveChat: React.FC<TikTokLiveChatProps> = ({ onCreateSaleFromJP }) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<TikTokChatMessage[]>([]);
  const [connection, setConnection] = useState<TikTokLiveConnection>({
    status: 'disconnected',
    reconnectAttempts: 0
  });
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [filterJPOnly, setFilterJPOnly] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const WS_URL = 'ws://localhost:3002';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Connexion WebSocket
    const connectWebSocket = () => {
      try {
        wsRef.current = new WebSocket(WS_URL);

        wsRef.current.onopen = () => {
          console.log('🔌 Connecté au serveur TikTok Live');
        };

        wsRef.current.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            handleWebSocketMessage(message);
          } catch (error) {
            console.error('Erreur parsing message WebSocket:', error);
          }
        };

        wsRef.current.onclose = () => {
          console.log('🔌 Déconnecté du serveur TikTok Live');
          setConnection(prev => ({ ...prev, status: 'disconnected' }));
          
          // Tentative de reconnexion après 3 secondes
          setTimeout(() => {
            if (wsRef.current?.readyState === WebSocket.CLOSED) {
              connectWebSocket();
            }
          }, 3000);
        };

        wsRef.current.onerror = (error) => {
          console.error('❌ Erreur WebSocket:', error);
        };
      } catch (error) {
        console.error('❌ Erreur de connexion WebSocket:', error);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleWebSocketMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'chat':
        if (message.data) {
          const chatMessage: TikTokChatMessage = {
            uniqueId: message.data.uniqueId,
            nickname: message.data.nickname,
            comment: message.data.comment,
            timestamp: message.data.timestamp,
            isJP: message.data.isJP,
            userId: message.data.userId,
            profilePictureUrl: message.data.profilePictureUrl
          };

          setMessages(prev => {
            const newMessages = [...prev, chatMessage];
            // Garder seulement les 100 derniers messages
            return newMessages.slice(-100);
          });
        }
        break;

      case 'connection_status':
        setConnection(prev => ({
          ...prev,
          status: message.status as 'connected' | 'disconnected' | 'connecting',
          roomId: message.data?.roomId,
          lastConnected: message.timestamp
        }));
        
        // Réinitialiser l'état de reconnexion quand on se connecte
        if (message.status === 'connected') {
          setIsReconnecting(false);
        }
        break;


      case 'error':
        console.error('Erreur TikTok Live:', message.message);
        break;
    }
  };

  const handleJPClick = (message: TikTokChatMessage) => {
    onCreateSaleFromJP(message);
  };

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      // Appeler l'API de reconnexion du serveur
      const response = await fetch('http://localhost:3001/reconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        console.log('🔄 Reconnexion demandée au serveur');
        // Fermer la connexion WebSocket actuelle pour forcer une reconnexion
        if (wsRef.current) {
          wsRef.current.close();
        }
      } else {
        console.error('❌ Erreur lors de la demande de reconnexion');
        setIsReconnecting(false);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la reconnexion:', error);
      setIsReconnecting(false);
    }
  };

  const filteredMessages = filterJPOnly 
    ? messages.filter(msg => msg.isJP)
    : messages;

  const getConnectionStatusColor = () => {
    switch (connection.status) {
      case 'connected': return 'text-green-500';
      case 'connecting': return 'text-yellow-500';
      case 'disconnected': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connection.status) {
      case 'connected': return <Wifi className="w-4 h-4" />;
      case 'connecting': return <Wifi className="w-4 h-4 animate-pulse" />;
      case 'disconnected': return <WifiOff className="w-4 h-4" />;
      default: return <WifiOff className="w-4 h-4" />;
    }
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-pink-500 hover:bg-pink-600 text-white p-3 rounded-full shadow-lg transition-colors"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 h-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-pink-500 text-white p-3 rounded-t-lg flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MessageCircle className="w-5 h-5" />
          <span className="font-semibold">TikTok Live</span>
          <div className={`flex items-center space-x-1 ${getConnectionStatusColor()}`}>
            {getConnectionStatusIcon()}
            <span className="text-xs">
              {connection.status === 'connected' ? 'Connecté' : 
               connection.status === 'connecting' ? 'Connexion...' : 'Déconnecté'}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {connection.status === 'disconnected' && (
            <button
              onClick={handleReconnect}
              disabled={isReconnecting}
              className={`text-white px-2 py-1 rounded text-xs ${
                isReconnecting 
                  ? 'bg-gray-500 cursor-not-allowed' 
                  : 'bg-red-500 hover:bg-red-600'
              }`}
              title={isReconnecting ? "Reconnexion en cours..." : "Reconnecter"}
            >
              {isReconnecting ? '⏳' : '🔄'}
            </button>
          )}
          <button
            onClick={() => setIsMinimized(true)}
            className="text-white hover:text-gray-200"
          >
            ×
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="p-2 border-b border-gray-200">
        <label className="flex items-center space-x-2 text-sm">
          <input
            type="checkbox"
            checked={filterJPOnly}
            onChange={(e) => setFilterJPOnly(e.target.checked)}
            className="rounded"
          />
          <span>Afficher seulement les "JP"</span>
        </label>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {connection.status === 'disconnected' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <WifiOff className="w-4 h-4 text-red-500" />
                <span className="text-red-700 text-sm font-medium">Connexion perdue</span>
              </div>
              <button
                onClick={handleReconnect}
                disabled={isReconnecting}
                className={`text-white px-3 py-1 rounded text-xs ${
                  isReconnecting 
                    ? 'bg-gray-500 cursor-not-allowed' 
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {isReconnecting ? 'Reconnexion...' : 'Reconnecter'}
              </button>
            </div>
            <p className="text-red-600 text-xs mt-1">
              Cliquez sur "Reconnecter" pour rétablir la connexion au live TikTok
            </p>
          </div>
        )}
        
        {filteredMessages.length === 0 && connection.status !== 'disconnected' ? (
          <div className="text-center text-gray-500 text-sm py-8">
            {connection.status === 'connected' 
              ? 'En attente des messages...' 
              : 'Connexion au live en cours...'}
          </div>
        ) : (
          filteredMessages.map((message, index) => (
            <div
              key={`${message.uniqueId}-${index}`}
              className={`p-2 rounded-lg text-sm ${
                message.isJP 
                  ? 'bg-yellow-50 border border-yellow-200 cursor-pointer hover:bg-yellow-100' 
                  : 'bg-gray-50'
              }`}
              onClick={() => message.isJP && handleJPClick(message)}
            >
              <div className="flex items-start space-x-2">
                {message.profilePictureUrl && (
                  <img
                    src={message.profilePictureUrl}
                    alt={message.nickname}
                    className="w-6 h-6 rounded-full"
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-pink-600">
                      {message.nickname}
                    </span>
                    {message.isJP && (
                      <span className="bg-yellow-500 text-white text-xs px-1 rounded">
                        JP
                      </span>
                    )}
                  </div>
                  <p className="text-gray-800 mt-1">{message.comment}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                {message.isJP && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJPClick(message);
                    }}
                    className="text-green-600 hover:text-green-700 p-1"
                    title="Créer une vente"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-gray-200 text-xs text-gray-500">
        Messages: {filteredMessages.length} | 
        JP: {messages.filter(m => m.isJP).length}
      </div>
    </div>
  );
};

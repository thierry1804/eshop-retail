import React, { useState } from 'react';
import { ArrowLeft, Video, MessageCircle } from 'lucide-react';
import { TikTokLive } from './TikTokLive';
import { User } from '../../types';

interface TikTokLivePageProps {
  user: User;
  onBack?: () => void;
  onNavigateToSales?: () => void;
}

export const TikTokLivePage: React.FC<TikTokLivePageProps> = ({ user, onBack, onNavigateToSales }) => {
  const [showChat, setShowChat] = useState(true);

  const handleCreateSaleFromJP = (message: any) => {
    // Cette fonction sera passée au composant TikTokLive
    console.log('Création de vente depuis JP:', message);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Retour</span>
              </button>
            )}
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-pink-100 rounded-lg">
                <Video className="w-6 h-6 text-pink-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Vente Live TikTok</h1>
                <p className="text-gray-600">Suivi des commandes en direct</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {onNavigateToSales && (
              <button
                onClick={onNavigateToSales}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <span>📋</span>
                <span>Voir les ventes</span>
              </button>
            )}
            <button
              onClick={() => setShowChat(!showChat)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                showChat 
                  ? 'bg-pink-500 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              <span>{showChat ? 'Masquer le chat' : 'Afficher le chat'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Zone de chat TikTok */}
        {showChat && (
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-[600px] overflow-hidden">
              <TikTokLive onCreateSaleFromJP={handleCreateSaleFromJP} />
            </div>
          </div>
        )}

        {/* Zone de travail */}
        <div className={`${showChat ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-center py-12">
              <div className="p-4 bg-pink-100 rounded-full w-16 h-16 mx-auto mb-4">
                <Video className="w-8 h-8 text-pink-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Zone de travail TikTok Live
              </h3>
              <p className="text-gray-600 mb-6">
                Cette zone sera utilisée pour afficher les commandes en cours, 
                les statistiques de vente et les outils de gestion des commandes live.
              </p>
              
              {/* Statistiques rapides */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
                <div className="bg-pink-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-pink-600">0</div>
                  <div className="text-sm text-gray-600">Commandes JP</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600">0</div>
                  <div className="text-sm text-gray-600">Ventes créées</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600">0</div>
                  <div className="text-sm text-gray-600">Clients TikTok</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { TikTokLiveChat } from './TikTokLiveChat';
import { SaleForm } from '../Sales/SaleForm';
import { TikTokChatMessage, Sale, Client } from '../../types';
import { supabase } from '../../lib/supabase';

interface TikTokLiveProps {
  onCreateSaleFromMessage?: (message: TikTokChatMessage) => void;
}

export const TikTokLive: React.FC<TikTokLiveProps> = ({ onCreateSaleFromMessage }) => {
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [selectedTikTokMessage, setSelectedTikTokMessage] = useState<TikTokChatMessage | null>(null);
  const [createdClient, setCreatedClient] = useState<Client | null>(null);
  const [isCreatingClient, setIsCreatingClient] = useState(false);

  const handleCreateSaleFromMessage = async (message: TikTokChatMessage) => {
    // Appeler la fonction parent si fournie
    if (onCreateSaleFromMessage) {
      onCreateSaleFromMessage(message);
    }

    setSelectedTikTokMessage(message);
    setIsCreatingClient(true);

    try {
      // Créer automatiquement le client TikTok
      const clientData = {
        first_name: message.nickname.split(' ')[0] || message.nickname,
        last_name: message.nickname.split(' ').slice(1).join(' ') || '',
        phone: '',
        address: '',
        trust_rating: 'good' as 'good' | 'average' | 'poor',
        notes: `Client TikTok - ${message.nickname}`,
        tiktok_id: message.uniqueId,
        tiktok_nick_name: message.nickname,
        created_by: (await supabase.auth.getUser()).data.user?.id
      };

      const { data: newClient, error } = await supabase
        .from('clients')
        .insert([clientData])
        .select()
        .single();

      if (error) {
        console.error('Erreur lors de la création du client:', error);
        return;
      }

      setCreatedClient(newClient);
      setShowSaleForm(true);
    } catch (error) {
      console.error('Erreur lors de la création du client:', error);
    } finally {
      setIsCreatingClient(false);
    }
  };

  const handleSaleCreated = () => {
    console.log('Vente créée');
    // Fermer le formulaire après création
    handleCloseSaleForm();
  };


  const handleCloseSaleForm = () => {
    setShowSaleForm(false);
    setSelectedTikTokMessage(null);
    setCreatedClient(null);
  };

  return (
    <>
      <TikTokLiveChat onCreateSaleFromMessage={handleCreateSaleFromMessage} />

      {isCreatingClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600 mx-auto mb-4"></div>
              <p className="text-gray-700">Création du client TikTok...</p>
            </div>
          </div>
        </div>
      )}

      {showSaleForm && createdClient && (
        <SaleForm
          sale={{
            id: '',
            client_id: createdClient.id,
            description: 'TIKTOK',
            total_amount: 0,
            deposit: 0,
            status: 'ongoing',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: '',
            updated_by: '',
            client: createdClient
          }}
          onClose={handleCloseSaleForm}
          onSubmit={handleSaleCreated}
          tiktokMessage={selectedTikTokMessage}
        />
      )}
    </>
  );
};

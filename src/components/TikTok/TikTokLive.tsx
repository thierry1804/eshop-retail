import React, { useState } from 'react';
import { TikTokLiveChat } from './TikTokLiveChat';
import { TikTokSaleForm } from './TikTokSaleForm';
import { TikTokChatMessage, Sale } from '../../types';

export const TikTokLive: React.FC = () => {
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [selectedTikTokMessage, setSelectedTikTokMessage] = useState<TikTokChatMessage | null>(null);

  const handleCreateSaleFromJP = (message: TikTokChatMessage) => {
    setSelectedTikTokMessage(message);
    setShowSaleForm(true);
  };

  const handleSaleCreated = (sale: Sale) => {
    console.log('Vente créée:', sale);
    // Ici tu peux ajouter une notification ou rediriger vers la vente créée
  };

  const handleCloseSaleForm = () => {
    setShowSaleForm(false);
    setSelectedTikTokMessage(null);
  };

  return (
    <>
      <TikTokLiveChat onCreateSaleFromJP={handleCreateSaleFromJP} />
      
      {showSaleForm && selectedTikTokMessage && (
        <TikTokSaleForm
          tiktokMessage={selectedTikTokMessage}
          onClose={handleCloseSaleForm}
          onSaleCreated={handleSaleCreated}
        />
      )}
    </>
  );
};

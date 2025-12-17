import { supabase } from './supabase';
import { Client } from '../types';

/**
 * Normalise un numéro de téléphone en enlevant tous les espaces
 * @param phone - Le numéro de téléphone à normaliser
 * @returns Le numéro de téléphone sans espaces
 * 
 * Exemple: "+261 34 12 34 56" → "+26134123456"
 */
export const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  return phone.replace(/\s+/g, '');
};

/**
 * Recherche un client par son numéro de téléphone (normalisé sans espaces)
 * @param phone - Le numéro de téléphone à rechercher
 * @returns Le premier client trouvé avec ce numéro, ou null si aucun n'est trouvé
 */
export const findClientByPhone = async (phone: string): Promise<Client | null> => {
  if (!phone || !phone.trim()) {
    return null;
  }

  const normalizedPhone = normalizePhone(phone);
  
  try {
    // Récupérer tous les clients (avec une limite raisonnable pour la performance)
    // On filtre côté client car Supabase ne permet pas facilement de normaliser côté serveur
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*')
      .limit(10000); // Limite pour éviter les problèmes de performance

    if (error) {
      console.error('Erreur lors de la recherche du client par téléphone:', error);
      return null;
    }

    if (!clients || clients.length === 0) {
      return null;
    }

    // Trouver le premier client dont le téléphone normalisé correspond
    const foundClient = clients.find(client => {
      const clientPhoneNormalized = normalizePhone(client.phone || '');
      return clientPhoneNormalized === normalizedPhone;
    });

    return foundClient ? (foundClient as Client) : null;
  } catch (error) {
    console.error('Erreur lors de la recherche du client par téléphone:', error);
    return null;
  }
};

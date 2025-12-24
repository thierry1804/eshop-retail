import { supabase } from './supabase';

/**
 * Vérifie si une vente est déjà associée à une livraison
 * @param saleId - ID de la vente à vérifier
 * @returns Promise<boolean> - true si la vente est déjà livrée
 */
export const isSaleAlreadyDelivered = async (saleId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('deliveries')
      .select('id')
      .eq('sale_id', saleId)
      .not('sale_id', 'is', null)
      .limit(1);

    if (error) {
      console.error('Erreur lors de la vérification de livraison:', error);
      return false; // En cas d'erreur, considérer comme non livrée
    }

    return data && data.length > 0;
  } catch (error) {
    console.error('Erreur lors de la vérification de livraison:', error);
    return false;
  }
};

/**
 * Récupère les ventes disponibles (non livrées) pour un client
 * @param clientId - ID du client
 * @returns Promise<Sale[]> - Liste des ventes non livrées
 */
export const getAvailableSalesForClient = async (clientId: string) => {
  try {
    // Récupérer toutes les ventes du client
    const { data: allSales, error: salesError } = await supabase
      .from('sales')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (salesError) {
      console.error('Erreur lors de la récupération des ventes:', salesError);
      return [];
    }

    if (!allSales || allSales.length === 0) {
      return [];
    }

    // Récupérer les IDs des ventes déjà associées à des livraisons
    const saleIds = allSales.map(sale => sale.id);
    const { data: deliveriesWithSales, error: deliveriesError } = await supabase
      .from('deliveries')
      .select('sale_id')
      .in('sale_id', saleIds)
      .not('sale_id', 'is', null);

    if (deliveriesError) {
      console.error('Erreur lors de la récupération des livraisons:', deliveriesError);
      return allSales; // En cas d'erreur, retourner toutes les ventes
    }

    // Extraire les IDs des ventes déjà livrées
    const deliveredSaleIds = new Set(
      deliveriesWithSales?.map(delivery => delivery.sale_id).filter(Boolean) || []
    );

    // Filtrer les ventes pour ne garder que celles non livrées
    return allSales.filter(sale => !deliveredSaleIds.has(sale.id));
  } catch (error) {
    console.error('Erreur lors du filtrage des ventes:', error);
    return [];
  }
};

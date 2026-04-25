import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  parseIeApiTrackingPayload,
  downloadIeApiRowsAsExcel,
  mapIeStatusToDbStatus,
  isStatusProgression,
  IE_API_TABLE_COLUMN_ORDER,
  type IeApiTableColumnKey,
  type IeApiTrackingTableRow
} from '../../lib/importationExpressPublicTracking';
import { TrackingNumber, User } from '../../types';
import { useTranslation } from 'react-i18next';
import {
  PackageSearch, Search, Trash2,
  X, CheckCircle, Clock, Truck, RefreshCw, Save, Braces, Download, Database
} from 'lucide-react';

const IMPORTATION_EXPRESS_PUBLIC_TRACKING_URL =
  'https://api.importation-express.com/public/tracking?customerId=3239&phoneNumber=0384271168';

interface TrackingNumbersListProps {
  user: User;
}

export const TrackingNumbersList: React.FC<TrackingNumbersListProps> = ({ user }) => {
  const { t } = useTranslation();
  const [trackingNumbers, setTrackingNumbers] = useState<TrackingNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingRows, setEditingRows] = useState<Map<string, Partial<TrackingNumber>>>(new Map());
  const [savingRows, setSavingRows] = useState<Set<string>>(new Set());
  const [ieApiModalOpen, setIeApiModalOpen] = useState(false);
  const [ieApiRows, setIeApiRows] = useState<IeApiTrackingTableRow[]>([]);
  const [ieApiMatchCount, setIeApiMatchCount] = useState<number | null>(null);
  const [ieApiRawText, setIeApiRawText] = useState<string | null>(null);
  const [ieApiLoading, setIeApiLoading] = useState(false);
  const [ieApiError, setIeApiError] = useState<string | null>(null);

  // Sync BDD depuis IE API
  interface IeSyncItem {
    dbId: string;
    trackingNumber: string;
    ieStatus: string;
    mappedStatus: 'pending' | 'in_transit' | 'arrived' | 'received' | null;
    currentDbStatus: TrackingNumber['status'];
    statusChanged: boolean;
    ieWeightKg: number | null;
    currentWeightKg: number | null;
    weightChanged: boolean;
    ieVolumeCbm: number | null;
    currentVolumeM3: number | null;
    volumeChanged: boolean;
  }
  const [ieSyncPreview, setIeSyncPreview] = useState<IeSyncItem[] | null>(null);
  const [ieSyncApplying, setIeSyncApplying] = useState(false);
  const [ieSyncDone, setIeSyncDone] = useState<{ updated: number; errors: number } | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Flag pour éviter les chargements multiples au montage
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    // Ne charger qu'une seule fois au montage
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      syncAndFetchTrackingNumbers();
    }
    // syncAndFetchTrackingNumbers est voulu uniquement au montage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // OPTIMISÉ: Fonction légère pour rafraîchir seulement (utilisée après save/delete)
  const refreshTrackingNumbers = async () => {
    try {
      // Récupérer les tracking numbers
      const { data: trackingData, error: trackingError } = await supabase
        .from('tracking_numbers')
        .select('*')
        .order('created_at', { ascending: false });

      if (trackingError) throw trackingError;

      // Récupérer le nombre de commandes pour chaque
      const { data: ordersData, error: ordersError } = await supabase
        .from('purchase_orders')
        .select('tracking_number')
        .not('tracking_number', 'is', null)
        .neq('tracking_number', '');

      if (ordersError) throw ordersError;

      // Compter les commandes par tracking_number
      const trackingCountMap = new Map<string, number>();
      (ordersData || []).forEach(po => {
        const tn = po.tracking_number!;
        trackingCountMap.set(tn, (trackingCountMap.get(tn) || 0) + 1);
      });

      // Mapper avec le comptage
      const mapped = (trackingData || []).map((item) => {
        const row = item as TrackingNumber;
        return {
          ...row,
          orderCount: trackingCountMap.get(row.tracking_number) || 1
        };
      });

      setTrackingNumbers(mapped);
    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
    }
  };

  // OPTIMISÉ: Fonction unique qui fait tout en 2-3 requêtes au lieu de 6
  const syncAndFetchTrackingNumbers = async () => {
    try {
      setLoading(true);

      // 1️⃣ REQUÊTE 1: Récupérer TOUTES les commandes avec tracking_number + leur statut EN UNE FOIS
      const { data: allOrders, error: ordersError } = await supabase
        .from('purchase_orders')
        .select('id, tracking_number, created_by, status')
        .not('tracking_number', 'is', null)
        .neq('tracking_number', '');

      if (ordersError) throw ordersError;

      // 2️⃣ REQUÊTE 2: Récupérer tous les tracking numbers existants EN UNE FOIS
      const { data: existingTracking, error: trackingError } = await supabase
        .from('tracking_numbers')
        .select('*')
        .order('created_at', { ascending: false });

      if (trackingError) throw trackingError;

      // 🔧 TRAITEMENT LOCAL (pas de requêtes supplémentaires)

      // Créer un Set des tracking numbers existants
      const existingTrackingNumbers = new Set(
        (existingTracking || []).map(t => t.tracking_number)
      );

      // Grouper les commandes par tracking_number
      const ordersByTracking = new Map<string, Array<{ id: string; status: string; created_by: string }>>();

      (allOrders || []).forEach(order => {
        const tn = order.tracking_number!;
        if (!ordersByTracking.has(tn)) {
          ordersByTracking.set(tn, []);
        }
        ordersByTracking.get(tn)!.push({
          id: order.id,
          status: order.status,
          created_by: order.created_by || user.id
        });
      });

      // Identifier les nouveaux tracking numbers à créer
      const newTrackingNumbers: Array<{
        purchase_order_id: string;
        tracking_number: string;
        status: 'pending';
        created_by: string;
      }> = [];
      for (const [trackingNumber, orders] of ordersByTracking.entries()) {
        if (!existingTrackingNumbers.has(trackingNumber)) {
          // Prendre la première commande comme référence
          const firstOrder = orders[0];
          newTrackingNumbers.push({
            purchase_order_id: firstOrder.id,
            tracking_number: trackingNumber,
            status: 'pending',
            created_by: firstOrder.created_by
          });
        }
      }

      // 3️⃣ REQUÊTE 3 (optionnelle): Insérer les nouveaux tracking numbers si nécessaire
      if (newTrackingNumbers.length > 0) {
        const { error: insertError } = await supabase
          .from('tracking_numbers')
          .insert(newTrackingNumbers);

        if (insertError) {
          console.error('Erreur lors de l\'insertion:', insertError);
        }
      }

      // Calculer les statuts et préparer les mises à jour
      const statusUpdates: Array<{ id: string; trackingNumber: string }> = [];
      const trackingWithCounts: TrackingNumber[] = [];

      for (const tracking of existingTracking || []) {
        const orders = ordersByTracking.get(tracking.tracking_number) || [];
        const orderCount = orders.length;

        // Vérifier si toutes les commandes sont "received"
        const allReceived = orders.length > 0 && orders.every(order => order.status === 'received');

        // Si status doit être "received" mais ne l'est pas encore
        if (allReceived && tracking.status !== 'received') {
          statusUpdates.push({ id: tracking.id, trackingNumber: tracking.tracking_number });
        }

        // Ajouter le comptage de commandes
        trackingWithCounts.push({
          ...tracking,
          orderCount: orderCount || 1
        });
      }

      // Ajouter les nouveaux tracking numbers dans la liste affichée
      for (const newTN of newTrackingNumbers) {
        const orders = ordersByTracking.get(newTN.tracking_number) || [];
        trackingWithCounts.push({
          ...newTN,
          id: newTN.tracking_number,
          orderCount: orders.length || 1
        } as TrackingNumber);
      }

      // 4️⃣ REQUÊTES 4+ (optionnelles): Mettre à jour les statuts si nécessaire
      if (statusUpdates.length > 0) {
        const updatePromises = statusUpdates.map(item =>
          supabase
            .from('tracking_numbers')
            .update({
              status: 'received',
              updated_at: new Date().toISOString(),
              updated_by: user.id
            })
            .eq('id', item.id)
        );

        const results = await Promise.allSettled(updatePromises);
        const errors = results.filter(r => r.status === 'rejected');
        if (errors.length > 0) {
          console.error(`${errors.length} erreur(s) lors de la mise à jour des statuts`);
        }

        // Mettre à jour les statuts localement
        trackingWithCounts.forEach(tn => {
          if (statusUpdates.some(u => u.trackingNumber === tn.tracking_number)) {
            tn.status = 'received';
          }
        });
      }

      // Mettre à jour l'état
      setTrackingNumbers(trackingWithCounts);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTracking = trackingNumbers.filter(tn => {
    const matchesSearch = 
      tn.tracking_number.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || tn.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-gray-500" />;
      case 'in_transit': return <Truck className="h-4 w-4 text-blue-500" />;
      case 'arrived': return <PackageSearch className="h-4 w-4 text-orange-500" />;
      case 'received': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    return t(`tracking.status.${status}`);
  };

  // Calculer les valeurs pour une ligne en cours d'édition (volume, coûts)
  const getCalculatedValues = (tn: TrackingNumber, editedData?: Partial<TrackingNumber>) => {
    const data = { ...tn, ...editedData };
    const length = data.length || 0;
    const width = data.width || 0;
    const height = data.height || 0;
    const hasDimensions = !!(length && width && height);
    // Priorité : dimensions saisies > volume stocké (provenant de l'API)
    const volumeM3 = hasDimensions
      ? (length * width * height) / 1000000
      : (data.volume_m3 || 0);
    const volumeSource: 'dimensions' | 'api' | 'none' = hasDimensions
      ? 'dimensions'
      : data.volume_m3 ? 'api' : 'none';
    const ratePerM3 = data.rate_per_m3 || 0;
    const costByVolume = volumeM3 && ratePerM3 ? volumeM3 * ratePerM3 : 0;
    const weightKg = data.weight_kg || 0;
    const ratePerKg = data.rate_per_kg || 0;
    const costByWeight = weightKg && ratePerKg ? weightKg * ratePerKg : 0;
    const totalCostUSD = Math.max(costByVolume, costByWeight);
    const exchangeRate = data.exchange_rate_mga || 0;
    const totalCostMGA = exchangeRate && totalCostUSD ? totalCostUSD * exchangeRate : 0;

    return { volumeM3, volumeSource, totalCostUSD, totalCostMGA };
  };

  const handleFieldChange = (id: string, field: string, value: string) => {
    setEditingRows(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(id) || {};
      newMap.set(id, { ...current, [field]: value });
      return newMap;
    });
  };

  // Fonction pour scroller automatiquement vers un élément lorsqu'il reçoit le focus et sélectionner le texte
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.currentTarget;
    
    // Sélectionner le texte si c'est un input
    if (target instanceof HTMLInputElement) {
      target.select();
    }
    
    const scrollContainer = tableContainerRef.current;
    
    if (!scrollContainer) return;
    
    // Utiliser requestAnimationFrame pour s'assurer que le DOM est à jour
    requestAnimationFrame(() => {
      // Double requestAnimationFrame pour s'assurer que le layout est complètement calculé
      requestAnimationFrame(() => {
        setTimeout(() => {
          const containerRect = scrollContainer.getBoundingClientRect();
          const inputRect = target.getBoundingClientRect();
          const cell = target.closest('td');
          
          if (!cell) return;
          
          // Marge importante pour s'assurer que le champ entier est visible avec de l'espace
          const margin = 50;
          const containerWidth = scrollContainer.clientWidth;
          const cellOffsetLeft = cell.offsetLeft;
          const cellRect = cell.getBoundingClientRect();
          
          // Calculer la position de l'input par rapport à la cellule
          const inputOffsetInCell = inputRect.left - cellRect.left;
          const inputWidth = inputRect.width;
          const inputRightInCell = inputOffsetInCell + inputWidth;
          
          // Vérifier si l'input est ENTIÈREMENT visible dans le conteneur (avec marge)
          const isFullyVisible = 
            inputRect.left >= containerRect.left + margin &&
            inputRect.right <= containerRect.right - margin &&
            inputRect.top >= containerRect.top &&
            inputRect.bottom <= containerRect.bottom;
          
          if (!isFullyVisible) {
            let newScrollLeft = scrollContainer.scrollLeft;
            
            // Si l'input est partiellement ou complètement caché à gauche
            if (inputRect.left < containerRect.left + margin) {
              // Positionner pour que l'input soit entièrement visible à gauche avec marge
              // Calculer la position absolue de l'input dans le conteneur scrollable
              newScrollLeft = cellOffsetLeft + inputOffsetInCell - margin;
            }
            // Si l'input est partiellement ou complètement caché à droite
            else if (inputRect.right > containerRect.right - margin) {
              // Positionner pour que l'input soit entièrement visible à droite avec marge
              newScrollLeft = cellOffsetLeft + inputRightInCell - containerWidth + margin;
            }
            // Si l'input est visible mais trop proche des bords
            else {
              // Centrer l'input dans le viewport pour une meilleure visibilité
              const inputCenterInCell = inputOffsetInCell + (inputWidth / 2);
              newScrollLeft = cellOffsetLeft + inputCenterInCell - (containerWidth / 2);
            }
            
            // S'assurer que le scroll ne dépasse pas les limites
            const maxScroll = Math.max(0, scrollContainer.scrollWidth - containerWidth);
            newScrollLeft = Math.max(0, Math.min(newScrollLeft, maxScroll));
            
            // Toujours scroller si nécessaire
            const currentScroll = scrollContainer.scrollLeft;
            if (Math.abs(newScrollLeft - currentScroll) > 1) {
              // Scroller de manière fluide
              scrollContainer.scrollTo({
                left: newScrollLeft,
                behavior: 'smooth'
              });
            }
          }
        }, 150); // Délai pour laisser le navigateur traiter le focus
      });
    });
  };

  const handleSave = async (tn: TrackingNumber) => {
    const editedData = editingRows.get(tn.id);
    if (!editedData) return;

    setSavingRows(prev => new Set(prev).add(tn.id));

    try {
      const updateData: {
        length?: number | null;
        width?: number | null;
        height?: number | null;
        weight_kg?: number | null;
        rate_per_m3?: number | null;
        rate_per_kg?: number | null;
        exchange_rate_mga?: number | null;
        status?: TrackingNumber['status'];
        notes?: string | null;
        updated_by: string;
      } = { updated_by: user.id };
      if (editedData.length !== undefined) updateData.length = editedData.length ? Number(editedData.length) : null;
      if (editedData.width !== undefined) updateData.width = editedData.width ? Number(editedData.width) : null;
      if (editedData.height !== undefined) updateData.height = editedData.height ? Number(editedData.height) : null;
      if (editedData.weight_kg !== undefined) updateData.weight_kg = editedData.weight_kg ? Number(editedData.weight_kg) : null;
      if (editedData.rate_per_m3 !== undefined) updateData.rate_per_m3 = editedData.rate_per_m3 ? Number(editedData.rate_per_m3) : null;
      if (editedData.rate_per_kg !== undefined) updateData.rate_per_kg = editedData.rate_per_kg ? Number(editedData.rate_per_kg) : null;
      if (editedData.exchange_rate_mga !== undefined) updateData.exchange_rate_mga = editedData.exchange_rate_mga ? Number(editedData.exchange_rate_mga) : null;
      if (editedData.status !== undefined) updateData.status = editedData.status;
      if (editedData.notes !== undefined) updateData.notes = editedData.notes || null;
      updateData.updated_by = user.id;

      const { error } = await supabase
        .from('tracking_numbers')
        .update(updateData)
        .eq('id', tn.id);

      if (error) throw error;

      // Retirer de l'état d'édition
      setEditingRows(prev => {
        const newMap = new Map(prev);
        newMap.delete(tn.id);
        return newMap;
      });

      // Rafraîchir les données
      await refreshTrackingNumbers();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert(t('tracking.saveError'));
    } finally {
      setSavingRows(prev => {
        const newSet = new Set(prev);
        newSet.delete(tn.id);
        return newSet;
      });
    }
  };

  const totalCostUSD = filteredTracking.reduce((sum, tn) => {
    const editedData = editingRows.get(tn.id);
    const values = getCalculatedValues(tn, editedData);
    return sum + (values.totalCostUSD || 0);
  }, 0);

  const totalCostMGA = filteredTracking.reduce((sum, tn) => {
    const editedData = editingRows.get(tn.id);
    const values = getCalculatedValues(tn, editedData);
    return sum + (values.totalCostMGA || 0);
  }, 0);

  const getIeColumnLabels = () => ({
    trackingNumber: t('tracking.ieApiCol.trackingNumber'),
    currentStatus: t('tracking.ieApiCol.currentStatus'),
    lastUpdated: t('tracking.ieApiCol.lastUpdated'),
    customerRef: t('tracking.ieApiCol.customerRef'),
    shippingMark: t('tracking.ieApiCol.shippingMark'),
    transportId: t('tracking.ieApiCol.transportId'),
    weightKg: t('tracking.ieApiCol.weightKg'),
    volumeCbm: t('tracking.ieApiCol.volumeCbm'),
    amountEstimate: t('tracking.ieApiCol.amountEstimate'),
    pickupAmount: t('tracking.ieApiCol.pickupAmount'),
    shipmentRef: t('tracking.ieApiCol.shipmentRef'),
    receivedAt: t('tracking.ieApiCol.receivedAt'),
    departedAt: t('tracking.ieApiCol.departedAt'),
    arrivedAt: t('tracking.ieApiCol.arrivedAt'),
    readyForPickupAt: t('tracking.ieApiCol.readyForPickupAt'),
    origin: t('tracking.ieApiCol.origin'),
    destination: t('tracking.ieApiCol.destination')
  }) satisfies Record<IeApiTableColumnKey, string>;

  const openImportationExpressApiModal = async () => {
    setIeApiModalOpen(true);
    setIeApiLoading(true);
    setIeApiError(null);
    setIeApiRows([]);
    setIeApiMatchCount(null);
    setIeApiRawText(null);
    try {
      const res = await fetch(IMPORTATION_EXPRESS_PUBLIC_TRACKING_URL, {
        headers: { Accept: 'application/json' }
      });
      const text = await res.text();
      if (!res.ok) {
        setIeApiError(t('tracking.ieApiHttpError', { status: res.status }));
        setIeApiRawText(text);
        return;
      }
      try {
        const data = JSON.parse(text) as unknown;
        const { matchCount, rows } = parseIeApiTrackingPayload(data);
        setIeApiMatchCount(matchCount);
        setIeApiRows(rows);
      } catch {
        setIeApiError(t('tracking.ieApiInvalidJson'));
        setIeApiRawText(text);
      }
    } catch (e) {
      setIeApiError(
        e instanceof Error ? e.message : t('tracking.ieApiLoadError')
      );
    } finally {
      setIeApiLoading(false);
    }
  };

  const handleExportIeApiExcel = async () => {
    if (ieApiRows.length === 0) return;
    const labels = getIeColumnLabels();
    const stamp = new Date().toISOString().slice(0, 10);
    await downloadIeApiRowsAsExcel(ieApiRows, labels, `importation-express-${stamp}`);
  };

  const buildSyncPreview = (): IeSyncItem[] => {
    const dbByTn = new Map(trackingNumbers.map(tn => [tn.tracking_number, tn]));
    const items: IeSyncItem[] = [];

    for (const ieRow of ieApiRows) {
      const dbTn = dbByTn.get(ieRow.trackingNumber);
      if (!dbTn) continue;

      const mappedStatus = mapIeStatusToDbStatus(ieRow.currentStatus);
      // Seulement avancer le statut, jamais régresser
      const statusChanged =
        mappedStatus !== null &&
        mappedStatus !== dbTn.status &&
        isStatusProgression(dbTn.status, mappedStatus);

      // Poids : remplir seulement si vide en DB
      const ieWeightKg = ieRow.weightKgValue;
      const weightChanged =
        ieWeightKg !== null &&
        ieWeightKg > 0 &&
        (!dbTn.weight_kg || dbTn.weight_kg === 0);

      // Volume (CBM = m³) : remplir seulement si pas de dimensions ni de volume en DB
      const ieVolumeCbm = ieRow.volumeCbmValue;
      const hasDimensionsInDb = !!(dbTn.length && dbTn.width && dbTn.height);
      const volumeChanged =
        ieVolumeCbm !== null &&
        ieVolumeCbm > 0 &&
        !hasDimensionsInDb &&
        (!dbTn.volume_m3 || dbTn.volume_m3 === 0);

      if (statusChanged || weightChanged || volumeChanged) {
        items.push({
          dbId: dbTn.id,
          trackingNumber: dbTn.tracking_number,
          ieStatus: ieRow.currentStatus,
          mappedStatus,
          currentDbStatus: dbTn.status,
          statusChanged,
          ieWeightKg,
          currentWeightKg: dbTn.weight_kg ?? null,
          weightChanged,
          ieVolumeCbm,
          currentVolumeM3: dbTn.volume_m3 ?? null,
          volumeChanged,
        });
      }
    }
    return items;
  };

  const applySyncFromIeApi = async (preview: IeSyncItem[]) => {
    setIeSyncApplying(true);
    let updated = 0;
    let errors = 0;

    const results = await Promise.allSettled(
      preview.map(item => {
        const patch: Record<string, unknown> = { updated_by: user.id };
        if (item.statusChanged && item.mappedStatus) patch.status = item.mappedStatus;
        if (item.weightChanged && item.ieWeightKg) patch.weight_kg = item.ieWeightKg;
        if (item.volumeChanged && item.ieVolumeCbm) patch.volume_m3 = item.ieVolumeCbm;
        return supabase.from('tracking_numbers').update(patch).eq('id', item.dbId);
      })
    );

    results.forEach(r => {
      if (r.status === 'fulfilled' && !r.value.error) updated++;
      else errors++;
    });

    setIeSyncApplying(false);
    setIeSyncPreview(null);
    setIeSyncDone({ updated, errors });
    await refreshTrackingNumbers();
  };

  const ieApiTableColumnLabels = getIeColumnLabels();

  return (
    <>
    <div className="space-y-4 sm:space-y-6">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {t('tracking.title')}
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            {t('tracking.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={syncAndFetchTrackingNumbers}
          disabled={loading}
          className="bg-gray-100 text-gray-700 px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2 text-sm sm:text-base disabled:opacity-50"
          title={t('tracking.syncTracking')}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {t('tracking.syncTracking')}
        </button>
        <button
          type="button"
          onClick={openImportationExpressApiModal}
          className="bg-white border border-gray-300 text-gray-800 px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 text-sm sm:text-base"
          title={t('tracking.viewIeApiTitle')}
        >
          <Braces className="h-4 w-4" />
          {t('tracking.viewIeApi')}
        </button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">{t('tracking.totalTracking')}</div>
          <div className="text-2xl font-bold text-gray-900">{filteredTracking.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">{t('tracking.totalCostUSD')}</div>
          <div className="text-2xl font-bold text-green-600">
            ${totalCostUSD.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">{t('tracking.totalCostMGA')}</div>
          <div className="text-2xl font-bold text-blue-600">
            {totalCostMGA.toLocaleString('fr-FR')} MGA
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder={t('tracking.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t('tracking.allStatuses')}</option>
              <option value="pending">{t('tracking.status.pending')}</option>
              <option value="in_transit">{t('tracking.status.in_transit')}</option>
              <option value="arrived">{t('tracking.status.arrived')}</option>
              <option value="received">{t('tracking.status.received')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div ref={tableContainerRef} className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                  {t('tracking.trackingNumber')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tracking.dimensions')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tracking.volume')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tracking.weight')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tracking.ratePerM3')} / {t('tracking.ratePerKg')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tracking.exchangeRate')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tracking.costUSD')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky bg-gray-50 z-10" style={{ right: '200px' }}>
                  {t('tracking.costMGA')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky bg-gray-50 z-10" style={{ right: '100px' }}>
                  {t('tracking.statusLabel')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50 z-10">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTracking.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                    {searchTerm || statusFilter !== 'all' 
                      ? t('tracking.noTrackingNumbersFound')
                      : t('tracking.noTrackingNumbers')}
                  </td>
                </tr>
              ) : (
                filteredTracking.map((tn) => {
                  const editedData = editingRows.get(tn.id);
                  const isEditing = !!editedData;
                  const isSaving = savingRows.has(tn.id);
                  const displayData = { ...tn, ...editedData };
                  const calculated = getCalculatedValues(tn, editedData);
                  
                  return (
                    <tr key={tn.id} className={`hover:bg-gray-50 ${isEditing ? 'bg-blue-50' : ''}`}>
                      <td className={`px-6 py-4 whitespace-nowrap sticky left-0 z-10 ${isEditing ? 'bg-blue-50' : 'bg-white'}`}>
                        <div className="text-sm font-medium text-gray-900">
                          {tn.tracking_number}
                        </div>
                        {(tn.orderCount ?? 0) > 1 && (
                          <div className="text-xs text-blue-600 mt-1">
                            {tn.orderCount} {t('tracking.ordersCount')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-1 items-center">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={displayData.length || ''}
                            onChange={(e) => handleFieldChange(tn.id, 'length', e.target.value)}
                            onFocus={handleInputFocus}
                            placeholder="L"
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <span>×</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={displayData.width || ''}
                            onChange={(e) => handleFieldChange(tn.id, 'width', e.target.value)}
                            onFocus={handleInputFocus}
                            placeholder="l"
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <span>×</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={displayData.height || ''}
                            onChange={(e) => handleFieldChange(tn.id, 'height', e.target.value)}
                            onFocus={handleInputFocus}
                            placeholder="H"
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <span className="text-xs text-gray-500 ml-1">cm</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {calculated.volumeM3 > 0 ? (
                          <span className="flex items-center gap-1">
                            {calculated.volumeM3.toFixed(6)} m³
                            {calculated.volumeSource === 'api' && (
                              <span className="text-xs font-medium text-blue-500 bg-blue-50 px-1 rounded" title="Volume fourni par l'API Importation Express">IE</span>
                            )}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={displayData.weight_kg || ''}
                          onChange={(e) => handleFieldChange(tn.id, 'weight_kg', e.target.value)}
                          onFocus={handleInputFocus}
                          placeholder="0.00"
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <span className="text-xs text-gray-500 ml-1">kg</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={displayData.rate_per_m3 || ''}
                            onChange={(e) => handleFieldChange(tn.id, 'rate_per_m3', e.target.value)}
                            onFocus={handleInputFocus}
                            placeholder="USD/m³"
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={displayData.rate_per_kg || ''}
                            onChange={(e) => handleFieldChange(tn.id, 'rate_per_kg', e.target.value)}
                            onFocus={handleInputFocus}
                            placeholder="USD/kg"
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={displayData.exchange_rate_mga || ''}
                          onChange={(e) => handleFieldChange(tn.id, 'exchange_rate_mga', e.target.value)}
                          onFocus={handleInputFocus}
                          placeholder="Taux"
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        ${calculated.totalCostUSD.toFixed(2)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 sticky z-10 ${isEditing ? 'bg-blue-50' : 'bg-white'}`} style={{ right: '200px' }}>
                        {calculated.totalCostMGA.toLocaleString('fr-FR')} MGA
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap sticky z-10 ${isEditing ? 'bg-blue-50' : 'bg-white'}`} style={{ right: '100px' }}>
                        <div className="flex items-center gap-1.5">
                          {getStatusIcon(displayData.status)}
                        <select
                          value={displayData.status}
                          onChange={(e) => handleFieldChange(tn.id, 'status', e.target.value)}
                          onFocus={handleInputFocus}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                          title={getStatusLabel(displayData.status)}
                        >
                          <option value="pending">{t('tracking.status.pending')}</option>
                          <option value="in_transit">{t('tracking.status.in_transit')}</option>
                          <option value="arrived">{t('tracking.status.arrived')}</option>
                          <option value="received">{t('tracking.status.received')}</option>
                        </select>
                        </div>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 z-10 ${isEditing ? 'bg-blue-50' : 'bg-white'}`}>
                        <div className="flex items-center justify-end gap-2">
                          {isEditing && (
                            <button
                              onClick={() => handleSave(tn)}
                              disabled={isSaving}
                              className="text-green-600 hover:text-green-800 disabled:opacity-50"
                              title={t('app.save')}
                            >
                              {isSaving ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              // Empêcher la suppression si le statut est "received"
                              if (tn.status === 'received') {
                                alert(t('tracking.cannotDeleteReceived'));
                                return;
                              }
                              
                              if (confirm(t('tracking.confirmDelete'))) {
                                const { error } = await supabase
                                  .from('tracking_numbers')
                                  .delete()
                                  .eq('id', tn.id);
                                if (!error) {
                                  refreshTrackingNumbers();
                                } else {
                                  alert(t('tracking.deleteError'));
                                }
                              }
                            }}
                            disabled={tn.status === 'received'}
                            className={`${tn.status === 'received' 
                              ? 'text-gray-400 cursor-not-allowed' 
                              : 'text-red-600 hover:text-red-800'
                            }`}
                            title={tn.status === 'received' 
                              ? t('tracking.cannotDeleteReceived') 
                              : t('common.delete')
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}
    </div>

    {ieApiModalOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50"
        onClick={() => setIeApiModalOpen(false)}
        role="presentation"
      >
        <div
          className="bg-white rounded-xl shadow-xl w-full max-w-7xl max-h-[92vh] flex flex-col"
          onClick={e => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ie-api-modal-title"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
            <h2 id="ie-api-modal-title" className="text-lg font-semibold text-gray-900 pr-2">
              {t('tracking.ieApiModalTitle')}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIeSyncDone(null);
                  setIeSyncPreview(buildSyncPreview());
                }}
                disabled={ieApiRows.length === 0 || ieApiLoading || ieSyncApplying}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title={t('tracking.syncFromIeApi')}
              >
                <Database className="h-4 w-4" />
                {t('tracking.syncFromIeApi')}
              </button>
              <button
                type="button"
                onClick={() => void handleExportIeApiExcel()}
                disabled={ieApiRows.length === 0 || ieApiLoading}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title={t('tracking.ieApiExport')}
              >
                <Download className="h-4 w-4" />
                {t('tracking.ieApiExport')}
              </button>
              <button
                type="button"
                onClick={() => setIeApiModalOpen(false)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                title={t('app.close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <p className="px-4 py-2 text-xs text-gray-500 font-mono break-all border-b border-gray-100">
            {IMPORTATION_EXPRESS_PUBLIC_TRACKING_URL}
          </p>
          <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap items-center gap-2 text-sm text-gray-600">
            {ieApiMatchCount !== null && !ieApiLoading && (
              <span>{t('tracking.ieApiCountLabel', { count: ieApiMatchCount })}</span>
            )}
          </div>
          <div className="flex-1 overflow-auto p-2 sm:p-4 min-h-[200px]">

            {/* Résultat du sync */}
            {ieSyncDone && (
              <div className={`mb-3 px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${ieSyncDone.errors > 0 ? 'bg-yellow-50 text-yellow-800' : 'bg-green-50 text-green-800'}`}>
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                {t('tracking.ieSyncDone', { updated: ieSyncDone.updated, errors: ieSyncDone.errors })}
                <button className="ml-auto text-xs underline" onClick={() => setIeSyncDone(null)}>
                  {t('app.close')}
                </button>
              </div>
            )}

            {/* Aperçu du sync */}
            {ieSyncPreview !== null && (
              <div className="mb-4 border border-blue-200 rounded-lg bg-blue-50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-blue-900 text-sm">
                    {t('tracking.ieSyncPreviewTitle')}
                  </span>
                  <button
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                    onClick={() => setIeSyncPreview(null)}
                  >
                    {t('app.cancel')}
                  </button>
                </div>

                {ieSyncPreview.length === 0 ? (
                  <p className="text-sm text-blue-700">{t('tracking.ieSyncNoChanges')}</p>
                ) : (
                  <>
                    <p className="text-xs text-blue-700 mb-2">
                      {t('tracking.ieSyncSummary', { count: ieSyncPreview.length })}
                    </p>
                    <div className="overflow-x-auto rounded border border-blue-200 bg-white mb-3">
                      <table className="min-w-full text-xs divide-y divide-gray-100">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-2 py-1.5 text-left font-medium text-gray-600">{t('tracking.trackingNumber')}</th>
                            <th className="px-2 py-1.5 text-left font-medium text-gray-600">{t('tracking.ieApiCol.currentStatus')} IE</th>
                            <th className="px-2 py-1.5 text-left font-medium text-gray-600">{t('tracking.statusLabel')} actuel</th>
                            <th className="px-2 py-1.5 text-left font-medium text-gray-600">{t('tracking.statusLabel')} →</th>
                            <th className="px-2 py-1.5 text-left font-medium text-gray-600">{t('tracking.weight')} →</th>
                            <th className="px-2 py-1.5 text-left font-medium text-gray-600">{t('tracking.volume')} →</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {ieSyncPreview.map(item => (
                            <tr key={item.dbId} className="hover:bg-gray-50">
                              <td className="px-2 py-1.5 font-mono">{item.trackingNumber}</td>
                              <td className="px-2 py-1.5 text-gray-600 italic">{item.ieStatus || '—'}</td>
                              <td className="px-2 py-1.5">{t(`tracking.status.${item.currentDbStatus}`)}</td>
                              <td className="px-2 py-1.5">
                                {item.statusChanged && item.mappedStatus ? (
                                  <span className="text-blue-700 font-medium">
                                    {t(`tracking.status.${item.mappedStatus}`)}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-2 py-1.5">
                                {item.weightChanged && item.ieWeightKg ? (
                                  <span className="text-blue-700 font-medium">{item.ieWeightKg} kg</span>
                                ) : '—'}
                              </td>
                              <td className="px-2 py-1.5">
                                {item.volumeChanged && item.ieVolumeCbm ? (
                                  <span className="text-blue-700 font-medium">{item.ieVolumeCbm} m³</span>
                                ) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button
                      onClick={() => void applySyncFromIeApi(ieSyncPreview)}
                      disabled={ieSyncApplying}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {ieSyncApplying ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      ) : (
                        <Database className="h-4 w-4" />
                      )}
                      {ieSyncApplying ? t('tracking.ieSyncApplying') : t('tracking.ieSyncApply')}
                    </button>
                  </>
                )}
              </div>
            )}

            {ieApiLoading && (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
              </div>
            )}
            {!ieApiLoading && ieApiError && (
              <p className="text-red-600 text-sm mb-2">{ieApiError}</p>
            )}
            {!ieApiLoading && ieApiRawText && (
              <pre className="text-xs font-mono text-gray-600 whitespace-pre-wrap break-words max-h-40 overflow-auto border border-gray-200 rounded p-2 bg-gray-50 mb-3">
                {ieApiRawText}
              </pre>
            )}
            {!ieApiLoading && ieApiRows.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        {IE_API_TABLE_COLUMN_ORDER.map(key => (
                          <th
                            key={key}
                            className="px-2 py-2 text-left font-medium text-gray-600 whitespace-nowrap"
                          >
                            {ieApiTableColumnLabels[key]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {ieApiRows.map((row, idx) => (
                        <tr key={`${row.trackingNumber}-${idx}`} className="hover:bg-gray-50/80">
                          {IE_API_TABLE_COLUMN_ORDER.map(key => (
                            <td key={key} className="px-2 py-1.5 text-gray-900 max-w-[14rem] truncate align-top" title={row[key]}>
                              {row[key] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            )}
            {!ieApiLoading && !ieApiError && ieApiRows.length === 0 && !ieApiRawText && (
              <p className="text-sm text-gray-500 py-4">{t('tracking.ieApiNoShipments')}</p>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
};


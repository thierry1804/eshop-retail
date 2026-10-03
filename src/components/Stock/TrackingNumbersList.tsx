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
  PackageSearch, Trash2,
  X, CheckCircle, Clock, Truck, RefreshCw, Save, Braces, Download, Database
} from 'lucide-react';
import { Offcanvas, OffcanvasHeader, OffcanvasBody } from '../ui/Offcanvas';
import { SearchField } from '../ui/SearchField';
import { DataTable, dtTh, dtThRight, dtTd } from '../ui/DataTable';

const IMPORTATION_EXPRESS_PUBLIC_TRACKING_URL =
  'https://api.importation-express.com/public/tracking?customerId=3239&phoneNumber=0384271168';

/** Poids (kg) et volume (m³) tels qu’ils seront après le patch IE (même règles qu’en apply). */
function getPostSyncVolumeM3AndKg(
  dbTn: TrackingNumber,
  opts: {
    weightChanged: boolean;
    volumeChanged: boolean;
    ieWeightKg: number | null;
    ieVolumeCbm: number | null;
  }
): { volM3: number; weightKg: number } {
  const weightKg =
    opts.weightChanged && opts.ieWeightKg != null && opts.ieWeightKg > 0
      ? opts.ieWeightKg
      : dbTn.weight_kg || 0;
  if (opts.volumeChanged && opts.ieVolumeCbm != null && opts.ieVolumeCbm > 0) {
    const sideCm = Math.round(Math.cbrt(opts.ieVolumeCbm) * 100 * 100) / 100;
    return { volM3: (sideCm * sideCm * sideCm) / 1_000_000, weightKg };
  }
  const l = dbTn.length || 0;
  const w = dbTn.width || 0;
  const h = dbTn.height || 0;
  if (l && w && h) {
    return { volM3: (l * w * h) / 1_000_000, weightKg };
  }
  return { volM3: dbTn.volume_m3 || 0, weightKg };
}

/**
 * Renseigne rate_per_m3 / rate_per_kg existants pour que max(coût vol, coût poids) = targetUsd
 * (identique à la règle d’affichage du montant).
 */
function deriveRatesForMaxUsd(
  targetUsd: number,
  volM3: number,
  weightKg: number
): { ratePerM3: number | null; ratePerKg: number | null } {
  if (targetUsd <= 0) return { ratePerM3: null, ratePerKg: null };
  if (volM3 > 0 && weightKg > 0) {
    return {
      ratePerM3: Math.round((targetUsd / volM3) * 100) / 100,
      ratePerKg: Math.round((targetUsd / weightKg) * 100) / 100
    };
  }
  if (volM3 > 0) {
    return { ratePerM3: Math.round((targetUsd / volM3) * 100) / 100, ratePerKg: null };
  }
  if (weightKg > 0) {
    return { ratePerM3: null, ratePerKg: Math.round((targetUsd / weightKg) * 100) / 100 };
  }
  return { ratePerM3: null, ratePerKg: null };
}

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
    /** estimateAr (MGA) — sert à remplir rate_per_m3 / rate_per_kg si vides + taux connu */
    ieEstimateAr: number | null;
    amountChanged: boolean;
  }
  const [ieSyncPreview, setIeSyncPreview] = useState<IeSyncItem[] | null>(null);
  /** Même sémantique que l’aperçu en cours (pour bannière d’avertissement) */
  const [ieSyncLastPreviewForce, setIeSyncLastPreviewForce] = useState(false);
  const [ieSyncForce, setIeSyncForce] = useState(false);
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
      case 'pending': return <Clock className="h-4 w-4 app-text-muted" />;
      case 'in_transit': return <Truck className="h-4 w-4 app-text-link" />;
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

  const buildSyncPreview = (force: boolean): IeSyncItem[] => {
    const dbByTn = new Map(trackingNumbers.map(tn => [tn.tracking_number, tn]));
    const items: IeSyncItem[] = [];

    for (const ieRow of ieApiRows) {
      const dbTn = dbByTn.get(ieRow.trackingNumber);
      if (!dbTn) continue;

      const mappedStatus = mapIeStatusToDbStatus(ieRow.currentStatus);
      // Mode normal : seulement avancer le statut, jamais régresser
      // Mode forcer : appliquer tout statut mappable dès qu’il diffère (y compris régression)
      const statusChanged = force
        ? mappedStatus !== null && mappedStatus !== dbTn.status
        : mappedStatus !== null &&
          mappedStatus !== dbTn.status &&
          isStatusProgression(dbTn.status, mappedStatus);

      // Poids : forcer = toujours depuis l’API ; sinon = si l’API diffère de la DB
      const ieWeightKg = ieRow.weightKgValue;
      const weightChanged = force
        ? ieWeightKg !== null && ieWeightKg > 0
        : ieWeightKg !== null &&
          ieWeightKg > 0 &&
          ieWeightKg !== dbTn.weight_kg;

      // Volume (CBM = m³) : forcer = cube IE ; sinon = si diffère, sauf dimensions saisies en DB
      const ieVolumeCbm = ieRow.volumeCbmValue;
      const hasDimensionsInDb = !!(dbTn.length && dbTn.width && dbTn.height);
      const volumeChanged = force
        ? ieVolumeCbm !== null && ieVolumeCbm > 0
        : ieVolumeCbm !== null &&
          ieVolumeCbm > 0 &&
          !hasDimensionsInDb &&
          ieVolumeCbm !== dbTn.volume_m3;

      const { volM3, weightKg } = getPostSyncVolumeM3AndKg(dbTn, {
        weightChanged,
        volumeChanged,
        ieWeightKg,
        ieVolumeCbm
      });
      const hasUserRates = !!(dbTn.rate_per_m3 || dbTn.rate_per_kg);
      const r3 = dbTn.rate_per_m3 || 0;
      const rk = dbTn.rate_per_kg || 0;
      const maxUsdFromDbRates = Math.max(volM3 * r3, weightKg * rk);
      const ex = dbTn.exchange_rate_mga;
      const est = ieRow.estimateAr;
      const amountChanged = force
        ? est != null &&
          est > 0 &&
          ex != null &&
          ex > 0 &&
          (volM3 > 0 || weightKg > 0)
        : est != null &&
          est > 0 &&
          ex != null &&
          ex > 0 &&
          !hasUserRates &&
          maxUsdFromDbRates <= 0 &&
          (volM3 > 0 || weightKg > 0);

      if (statusChanged || weightChanged || volumeChanged || amountChanged) {
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
          ieEstimateAr: est,
          amountChanged
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
        if (item.volumeChanged && item.ieVolumeCbm) {
          // volume_m3 est une colonne générée (L×W×H) : on simule un cube équivalent
          const sideCm = Math.round(Math.cbrt(item.ieVolumeCbm) * 100 * 100) / 100;
          patch.length = sideCm;
          patch.width = sideCm;
          patch.height = sideCm;
        }
        if (item.amountChanged && item.ieEstimateAr != null && item.ieEstimateAr > 0) {
          const row = trackingNumbers.find(tn => tn.id === item.dbId);
          if (row && row.exchange_rate_mga && row.exchange_rate_mga > 0) {
            const targetUsd = item.ieEstimateAr / row.exchange_rate_mga;
            const { volM3, weightKg } = getPostSyncVolumeM3AndKg(row, {
              weightChanged: item.weightChanged,
              volumeChanged: item.volumeChanged,
              ieWeightKg: item.ieWeightKg,
              ieVolumeCbm: item.ieVolumeCbm
            });
            const { ratePerM3, ratePerKg } = deriveRatesForMaxUsd(
              targetUsd,
              volM3,
              weightKg
            );
            if (ratePerM3 != null) patch.rate_per_m3 = ratePerM3;
            if (ratePerKg != null) patch.rate_per_kg = ratePerKg;
          }
        }
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
    <div className="space-y-2">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--app-primary)]" />
        </div>
      ) : (
        <>
      <div className="app-sticky-chrome space-y-2">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <div className="min-w-0">
            <h1 className="app-page-title">{t('tracking.title')}</h1>
            <p className="app-page-subtitle">{t('tracking.subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={syncAndFetchTrackingNumbers}
              disabled={loading}
              className="app-btn app-btn-secondary app-btn-sm disabled:opacity-50"
              title={t('tracking.syncTracking')}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              {t('tracking.syncTracking')}
            </button>
            <button
              type="button"
              onClick={openImportationExpressApiModal}
              className="app-btn app-btn-secondary app-btn-sm"
              title={t('tracking.viewIeApiTitle')}
            >
              <Braces className="h-3.5 w-3.5" />
              {t('tracking.viewIeApi')}
            </button>
          </div>
        </div>
        <div className="app-toolbar">
          <SearchField
            className="min-w-[12rem]"
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t('tracking.searchPlaceholder')}
            inputClassName="text-xs py-1.5"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="app-input text-xs py-1.5 w-auto sm:min-w-[12rem]"
          >
            <option value="all">{t('tracking.allStatuses')}</option>
            <option value="pending">{t('tracking.status.pending')}</option>
            <option value="in_transit">{t('tracking.status.in_transit')}</option>
            <option value="arrived">{t('tracking.status.arrived')}</option>
            <option value="received">{t('tracking.status.received')}</option>
          </select>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="app-kpi">
          <div className="text-xs font-medium" style={{ color: 'var(--app-ink-muted)' }}>{t('tracking.totalTracking')}</div>
          <div className="text-lg font-semibold mt-0.5" style={{ color: 'var(--app-ink)' }}>{filteredTracking.length}</div>
        </div>
        <div className="app-kpi">
          <div className="text-xs font-medium" style={{ color: 'var(--app-ink-muted)' }}>{t('tracking.totalCostUSD')}</div>
          <div className="text-lg font-semibold mt-0.5" style={{ color: 'var(--app-success)' }}>
            ${totalCostUSD.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="app-kpi">
          <div className="text-xs font-medium" style={{ color: 'var(--app-ink-muted)' }}>{t('tracking.totalCostMGA')}</div>
          <div className="text-lg font-semibold mt-0.5" style={{ color: 'var(--app-ink)' }}>
            {totalCostMGA.toLocaleString('fr-FR')} MGA
          </div>
        </div>
      </div>

      {/* Liste — mobile */}
      <div className="md:hidden space-y-3">
        {filteredTracking.length === 0 ? (
          <div className="app-empty">
            <p className="app-empty-text">
              {searchTerm || statusFilter !== 'all'
                ? t('tracking.noTrackingNumbersFound')
                : t('tracking.noTrackingNumbers')}
            </p>
          </div>
        ) : (
          filteredTracking.map((tn) => {
            const editedData = editingRows.get(tn.id);
            const isEditing = !!editedData;
            const isSaving = savingRows.has(tn.id);
            const displayData = { ...tn, ...editedData };
            const calculated = getCalculatedValues(tn, editedData);

            return (
              <div key={tn.id} className={`app-list-card ${isEditing ? 'ring-1 ring-[color-mix(in_srgb,var(--app-primary)_25%,var(--app-border))]' : ''}`}>
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium app-text font-mono truncate">
                      {tn.tracking_number}
                    </div>
                    {(tn.orderCount ?? 0) > 1 && (
                      <div className="text-xs app-text-link mt-0.5">
                        {tn.orderCount} {t('tracking.ordersCount')}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {getStatusIcon(displayData.status)}
                    <select
                      value={displayData.status}
                      onChange={(e) => handleFieldChange(tn.id, 'status', e.target.value)}
                      className="app-input text-xs py-1 max-w-[7rem]"
                      title={getStatusLabel(displayData.status)}
                    >
                      <option value="pending">{t('tracking.status.pending')}</option>
                      <option value="in_transit">{t('tracking.status.in_transit')}</option>
                      <option value="arrived">{t('tracking.status.arrived')}</option>
                      <option value="received">{t('tracking.status.received')}</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2 text-xs pt-2 border-t app-divider">
                  <div className="flex justify-between">
                    <span className="app-text-muted">{t('tracking.volume')}</span>
                    <span className="app-text">
                      {calculated.volumeM3 > 0 ? `${calculated.volumeM3.toFixed(4)} m³` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="app-text-muted">{t('tracking.weight')}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={displayData.weight_kg || ''}
                      onChange={(e) => handleFieldChange(tn.id, 'weight_kg', e.target.value)}
                      placeholder="0"
                      className="app-input w-24 text-xs py-1 text-right"
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className="app-text-muted">{t('tracking.costUSD')}</span>
                    <span className="font-medium text-green-700">${calculated.totalCostUSD.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t app-divider">
                    <span className="app-text-muted">{t('tracking.costMGA')}</span>
                    <span className="font-medium app-text">
                      {calculated.totalCostMGA.toLocaleString('fr-FR')} MGA
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t app-divider">
                    {isEditing && (
                      <button
                        onClick={() => handleSave(tn)}
                        disabled={isSaving}
                        className="app-icon-btn text-green-700 disabled:opacity-50"
                        title={t('app.save')}
                      >
                        {isSaving ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={async () => {
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
                      className={`app-icon-btn ${tn.status === 'received' ? 'opacity-40 cursor-not-allowed' : 'app-icon-btn-danger'}`}
                      title={
                        tn.status === 'received'
                          ? t('tracking.cannotDeleteReceived')
                          : t('common.delete')
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Tableau — desktop */}
      <div className="hidden md:block app-table-wrap">
        <DataTable ref={tableContainerRef}>
            <thead className="app-bg-muted">
              <tr>
                <th className={`${dtTh} left-0 z-40`}>
                  {t('tracking.trackingNumber')}
                </th>
                <th className={dtTh}>{t('tracking.dimensions')}</th>
                <th className={dtTh}>{t('tracking.volume')}</th>
                <th className={dtTh}>{t('tracking.weight')}</th>
                <th className={dtTh}>
                  {t('tracking.ratePerM3')} / {t('tracking.ratePerKg')}
                </th>
                <th className={dtTh}>{t('tracking.exchangeRate')}</th>
                <th className={dtTh}>{t('tracking.costUSD')}</th>
                <th className={`${dtTh} z-40`} style={{ right: '200px' }}>
                  {t('tracking.costMGA')}
                </th>
                <th className={`${dtTh} z-40`} style={{ right: '100px' }}>
                  {t('tracking.statusLabel')}
                </th>
                <th className={`${dtThRight} right-0 z-40`}>
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--app-border)]">
              {filteredTracking.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-xs app-text-muted">
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
                    <tr key={tn.id} className={`hover:bg-[var(--app-surface-muted)] group ${isEditing ? 'bg-[color-mix(in_srgb,var(--app-primary)_10%,var(--app-surface))]' : ''}`}>
                      <td className={`px-3 py-1.5 whitespace-nowrap sticky left-0 z-20 text-xs ${isEditing ? 'bg-[color-mix(in_srgb,var(--app-primary)_10%,var(--app-surface))]' : ''}`}>
                        <div className="font-medium app-text">
                          {tn.tracking_number}
                        </div>
                        {(tn.orderCount ?? 0) > 1 && (
                          <div className="text-xs app-text-link mt-1">
                            {tn.orderCount} {t('tracking.ordersCount')}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-xs">
                        <div className="flex gap-1 items-center">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={displayData.length || ''}
                            onChange={(e) => handleFieldChange(tn.id, 'length', e.target.value)}
                            onFocus={handleInputFocus}
                            placeholder="L"
                            className="w-16 px-2 py-1 app-input text-sm"
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
                            className="w-16 px-2 py-1 app-input text-sm"
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
                            className="w-16 px-2 py-1 app-input text-sm"
                          />
                          <span className="text-xs app-text-muted ml-1">cm</span>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-xs text-sm app-text">
                        {calculated.volumeM3 > 0 ? (
                          <span className="flex items-center gap-1">
                            {calculated.volumeM3.toFixed(6)} m³
                            {calculated.volumeSource === 'api' && (
                              <span className="app-badge app-badge-info text-xs px-1" title="Volume fourni par l'API Importation Express">IE</span>
                            )}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-xs">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={displayData.weight_kg || ''}
                          onChange={(e) => handleFieldChange(tn.id, 'weight_kg', e.target.value)}
                          onFocus={handleInputFocus}
                          placeholder="0.00"
                          className="w-20 px-2 py-1 app-input text-sm"
                        />
                        <span className="text-xs app-text-muted ml-1">kg</span>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-xs">
                        <div className="flex flex-col gap-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={displayData.rate_per_m3 || ''}
                            onChange={(e) => handleFieldChange(tn.id, 'rate_per_m3', e.target.value)}
                            onFocus={handleInputFocus}
                            placeholder="USD/m³"
                            className="w-24 px-2 py-1 app-input text-xs"
                          />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={displayData.rate_per_kg || ''}
                            onChange={(e) => handleFieldChange(tn.id, 'rate_per_kg', e.target.value)}
                            onFocus={handleInputFocus}
                            placeholder="USD/kg"
                            className="w-24 px-2 py-1 app-input text-xs"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-xs">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={displayData.exchange_rate_mga || ''}
                          onChange={(e) => handleFieldChange(tn.id, 'exchange_rate_mga', e.target.value)}
                          onFocus={handleInputFocus}
                          placeholder="Taux"
                          className="w-24 px-2 py-1 app-input text-sm"
                        />
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-xs text-sm font-medium app-text-success">
                        ${calculated.totalCostUSD.toFixed(2)}
                      </td>
                      <td className={`px-3 py-1.5 whitespace-nowrap text-xs text-sm font-medium app-text-link sticky z-10 ${isEditing ? 'bg-[color-mix(in_srgb,var(--app-primary)_10%,var(--app-surface))]' : ''}`} style={{ right: '200px' }}>
                        {calculated.totalCostMGA.toLocaleString('fr-FR')} MGA
                      </td>
                      <td className={`px-3 py-1.5 whitespace-nowrap text-xs sticky z-10 ${isEditing ? 'bg-[color-mix(in_srgb,var(--app-primary)_10%,var(--app-surface))]' : ''}`} style={{ right: '100px' }}>
                        <div className="flex items-center gap-1.5">
                          {getStatusIcon(displayData.status)}
                        <select
                          value={displayData.status}
                          onChange={(e) => handleFieldChange(tn.id, 'status', e.target.value)}
                          onFocus={handleInputFocus}
                          className="app-input text-sm px-2 py-1"
                          title={getStatusLabel(displayData.status)}
                        >
                          <option value="pending">{t('tracking.status.pending')}</option>
                          <option value="in_transit">{t('tracking.status.in_transit')}</option>
                          <option value="arrived">{t('tracking.status.arrived')}</option>
                          <option value="received">{t('tracking.status.received')}</option>
                        </select>
                        </div>
                      </td>
                      <td className={`px-3 py-1.5 whitespace-nowrap text-xs text-right text-sm font-medium sticky right-0 z-10 ${isEditing ? 'bg-[color-mix(in_srgb,var(--app-primary)_10%,var(--app-surface))]' : ''}`}>
                        <div className="flex items-center justify-end gap-2">
                          {isEditing && (
                            <button
                              onClick={() => handleSave(tn)}
                              disabled={isSaving}
                              className="app-text-success hover:text-green-800 disabled:opacity-50"
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
                              ? 'app-text-muted cursor-not-allowed' 
                              : 'app-text-danger hover:text-red-800'
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
        </DataTable>
      </div>
        </>
      )}
    </div>

    {ieApiModalOpen && (
      <Offcanvas onClose={() => setIeApiModalOpen(false)} width="xl">
          <OffcanvasHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="ie-api-modal-title" className="text-lg font-semibold app-text pr-2">
              {t('tracking.ieApiModalTitle')}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 text-sm app-text-muted select-none">
                <input
                  type="checkbox"
                  className="rounded app-border"
                  checked={ieSyncForce}
                  onChange={e => setIeSyncForce(e.target.checked)}
                />
                {t('tracking.ieSyncForceLabel')}
              </label>
              <button
                type="button"
                onClick={() => {
                  setIeSyncDone(null);
                  setIeSyncLastPreviewForce(ieSyncForce);
                  setIeSyncPreview(buildSyncPreview(ieSyncForce));
                }}
                disabled={ieApiRows.length === 0 || ieApiLoading || ieSyncApplying}
                className="app-btn app-btn-primary app-btn-sm"
                title={t('tracking.syncFromIeApi')}
              >
                <Database className="h-4 w-4" />
                {t('tracking.syncFromIeApi')}
              </button>
              <button
                type="button"
                onClick={() => void handleExportIeApiExcel()}
                disabled={ieApiRows.length === 0 || ieApiLoading}
                className="app-btn app-btn-success app-btn-sm"
                title={t('tracking.ieApiExport')}
              >
                <Download className="h-4 w-4" />
                {t('tracking.ieApiExport')}
              </button>
              <button
                type="button"
                onClick={() => setIeApiModalOpen(false)}
                className="p-2 rounded-lg app-text-muted hover:bg-[var(--app-surface-muted)]"
                title={t('app.close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs app-text-muted font-mono break-all">
            {IMPORTATION_EXPRESS_PUBLIC_TRACKING_URL}
          </p>
          {ieApiMatchCount !== null && !ieApiLoading && (
            <p className="mt-1 text-sm app-text-muted">
              {t('tracking.ieApiCountLabel', { count: ieApiMatchCount })}
            </p>
          )}
          </OffcanvasHeader>
          <OffcanvasBody className="min-h-0">

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
              <div className="mb-4 app-surface rounded-lg bg-[color-mix(in_srgb,var(--app-primary)_10%,var(--app-surface))] p-3">
                {ieSyncLastPreviewForce && (
                  <p className="text-xs text-amber-900 bg-amber-100 border border-amber-200 rounded px-2 py-1.5 mb-2">
                    {t('tracking.ieSyncForceBanner')}
                  </p>
                )}
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium app-text text-sm">
                    {t('tracking.ieSyncPreviewTitle')}
                  </span>
                  <button
                    className="text-xs app-text-muted hover:app-text-muted underline"
                    onClick={() => setIeSyncPreview(null)}
                  >
                    {t('app.cancel')}
                  </button>
                </div>

                {ieSyncPreview.length === 0 ? (
                  <p className="text-sm app-text-link">{t('tracking.ieSyncNoChanges')}</p>
                ) : (
                  <>
                    <p className="text-xs app-text-link mb-2">
                      {t('tracking.ieSyncSummary', { count: ieSyncPreview.length })}
                    </p>
                    <div className="overflow-x-auto app-surface rounded mb-3">
                      <table className="app-table-striped min-w-full text-xs divide-y divide-[var(--app-border)]">
                        <thead className="app-bg-muted">
                          <tr>
                            <th className="px-2 py-1.5 text-left font-medium app-text-muted">{t('tracking.trackingNumber')}</th>
                            <th className="px-2 py-1.5 text-left font-medium app-text-muted">{t('tracking.ieApiCol.currentStatus')} IE</th>
                            <th className="px-2 py-1.5 text-left font-medium app-text-muted">{t('tracking.statusLabel')} actuel</th>
                            <th className="px-2 py-1.5 text-left font-medium app-text-muted">{t('tracking.statusLabel')} →</th>
                            <th className="px-2 py-1.5 text-left font-medium app-text-muted">{t('tracking.weight')} →</th>
                            <th className="px-2 py-1.5 text-left font-medium app-text-muted">{t('tracking.volume')} →</th>
                            <th className="px-2 py-1.5 text-left font-medium app-text-muted">
                              {t('tracking.ieSyncColRatesFromEstimate')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--app-border)]">
                          {ieSyncPreview.map(item => (
                            <tr key={item.dbId} className="hover:bg-[var(--app-surface-muted)]">
                              <td className="px-2 py-1.5 font-mono">{item.trackingNumber}</td>
                              <td className="px-2 py-1.5 app-text-muted italic">{item.ieStatus || '—'}</td>
                              <td className="px-2 py-1.5">{t(`tracking.status.${item.currentDbStatus}`)}</td>
                              <td className="px-2 py-1.5">
                                {item.statusChanged && item.mappedStatus ? (
                                  <span className="app-text-link font-medium">
                                    {t(`tracking.status.${item.mappedStatus}`)}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-2 py-1.5">
                                {item.weightChanged && item.ieWeightKg ? (
                                  <span className="app-text-link font-medium">{item.ieWeightKg} kg</span>
                                ) : '—'}
                              </td>
                              <td className="px-2 py-1.5">
                                {item.volumeChanged && item.ieVolumeCbm ? (
                                  <span className="app-text-link font-medium">{item.ieVolumeCbm} m³</span>
                                ) : '—'}
                              </td>
                              <td className="px-2 py-1.5">
                                {item.amountChanged && item.ieEstimateAr != null && item.ieEstimateAr > 0 ? (
                                  <span
                                    className="app-text-link font-medium"
                                    title={t('tracking.ieSyncColRatesFromEstimateTitle')}
                                  >
                                    {t('tracking.ieSyncRatesAppliedHint')}
                                  </span>
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
                      className="app-btn app-btn-primary app-btn-sm"
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
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--app-primary)]" />
              </div>
            )}
            {!ieApiLoading && ieApiError && (
              <p className="app-text-danger text-sm mb-2">{ieApiError}</p>
            )}
            {!ieApiLoading && ieApiRawText && (
              <pre className="text-xs font-mono app-text-muted whitespace-pre-wrap break-words max-h-40 overflow-auto border app-border rounded p-2 app-bg-muted mb-3">
                {ieApiRawText}
              </pre>
            )}
            {!ieApiLoading && ieApiRows.length > 0 && (
                <div className="overflow-x-auto rounded-lg border app-border">
                  <table className="app-table-striped min-w-full divide-y divide-[var(--app-border)] text-xs">
                    <thead className="app-bg-muted sticky top-0 z-10">
                      <tr>
                        {IE_API_TABLE_COLUMN_ORDER.map(key => (
                          <th
                            key={key}
                            className="px-2 py-2 text-left font-medium app-text-muted whitespace-nowrap"
                          >
                            {ieApiTableColumnLabels[key]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--app-border)]">
                      {ieApiRows.map((row, idx) => (
                        <tr key={`${row.trackingNumber}-${idx}`} className="hover:bg-[var(--app-surface-muted)]/80">
                          {IE_API_TABLE_COLUMN_ORDER.map(key => (
                            <td key={key} className="px-2 py-1.5 app-text max-w-[14rem] truncate align-top" title={row[key]}>
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
              <p className="text-sm app-text-muted py-4">{t('tracking.ieApiNoShipments')}</p>
            )}
          </OffcanvasBody>
      </Offcanvas>
    )}
    </>
  );
};


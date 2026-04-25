/**
 * API publique : https://api.importation-express.com/public/tracking
 * Structure documentée sur un échantillon de réponse JSON.
 */

/** Clés de colonnes affichées (table + export) — sans champs internes. */
export const IE_API_TABLE_COLUMN_ORDER = [
  'trackingNumber',
  'currentStatus',
  'lastUpdated',
  'customerRef',
  'shippingMark',
  'transportId',
  'weightKg',
  'volumeCbm',
  'amountEstimate',
  'pickupAmount',
  'shipmentRef',
  'receivedAt',
  'departedAt',
  'arrivedAt',
  'readyForPickupAt',
  'origin',
  'destination'
] as const;

export type IeApiTableColumnKey = (typeof IE_API_TABLE_COLUMN_ORDER)[number];

export interface IeApiTrackingTableRow
  extends Record<IeApiTableColumnKey, string> {
  /** ms UTC pour tri (pas de colonne) */
  _sortDepartedAt: number;
  weightKgValue: number | null;
  volumeCbmValue: number | null;
  estimateAr: number | null;
  pickupAr: number | null;
  lastUpdatedIso: string | null;
  receivedAtIso: string | null;
  departedAtIso: string | null;
  arrivedAtIso: string | null;
  readyForPickupAtIso: string | null;
}

type UnknownRecord = Record<string, unknown>;

function asRecord(v: unknown): UnknownRecord | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as UnknownRecord) : null;
}

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return String(v);
  }
  return '';
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const t = v.replace(/\s/g, '').replace(/\u00a0/g, '').replace(',', '.');
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatIsoToFr(iso: unknown): { display: string; iso: string | null } {
  if (typeof iso !== 'string' || !iso) return { display: '', iso: null };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { display: iso, iso: null };
  return { display: d.toLocaleString('fr-FR'), iso: d.toISOString() };
}

function frFormatNumber(
  n: number | null,
  maxFrac = 6
): string {
  if (n === null) return '';
  return n.toLocaleString('fr-FR', { maximumFractionDigits: maxFrac });
}

/**
 * Aplatit un élément de `results[]` en une ligne de tableau.
 */
export function mapIeApiResultToRow(item: unknown): IeApiTrackingTableRow {
  const o = asRecord(item) ?? {};
  const carton = asRecord(o.carton);
  const ownership = asRecord(o.ownership);
  const transport = asRecord(o.transport);
  const measurements = asRecord(o.measurements);
  const amountEst = asRecord(o.amountEstimate);
  const pickup = asRecord(o.pickup);
  const amountPrep = asRecord(pickup?.amountToPrepare);
  const warehouse = asRecord(o.warehouseReceipt);
  const timeline = asRecord(o.timeline);

  const weightVal = numOrNull(measurements?.weightKG);
  const volVal = numOrNull(measurements?.volumeCBM);
  const estimateAr = numOrNull(amountEst?.amountAr);
  const pickupAr = numOrNull(amountPrep?.amountAr);

  const lastUp = formatIsoToFr(o.lastUpdatedAt);
  const whRec = formatIsoToFr(warehouse?.receivedAt);
  const dep = formatIsoToFr(timeline?.departedAt);
  const arr = formatIsoToFr(timeline?.arrivedAt);
  const ready = formatIsoToFr(timeline?.readyForPickupAt);

  const sortMs = dep.iso ? new Date(dep.iso).getTime() : Number.POSITIVE_INFINITY;

  return {
    trackingNumber: str(carton?.trackingNumber),
    currentStatus: str(o.currentStatus),
    lastUpdated: lastUp.display,
    customerRef: str(ownership?.customerFullId),
    shippingMark: str(ownership?.shippingMark),
    transportId: str(transport?.identifier),
    weightKg: frFormatNumber(weightVal),
    volumeCbm: frFormatNumber(volVal),
    amountEstimate: estimateAr !== null ? frFormatNumber(estimateAr) : '',
    pickupAmount: pickupAr !== null ? frFormatNumber(pickupAr) : '',
    shipmentRef: str(pickup?.shipmentReference),
    receivedAt: whRec.display,
    departedAt: dep.display,
    arrivedAt: arr.display,
    readyForPickupAt: ready.display,
    origin: str(timeline?.origin),
    destination: str(timeline?.destination),
    _sortDepartedAt: sortMs,
    weightKgValue: weightVal,
    volumeCbmValue: volVal,
    estimateAr,
    pickupAr,
    lastUpdatedIso: lastUp.iso,
    receivedAtIso: whRec.iso,
    departedAtIso: dep.iso,
    arrivedAtIso: arr.iso,
    readyForPickupAtIso: ready.iso
  };
}

export function parseIeApiTrackingPayload(json: unknown): {
  matchCount: number;
  rows: IeApiTrackingTableRow[];
} {
  const root = asRecord(json);
  if (!root) {
    return { matchCount: 0, rows: [] };
  }
  const matchCount = typeof root.matchCount === 'number' ? root.matchCount : 0;
  const results = root.results;
  if (!Array.isArray(results)) {
    return { matchCount, rows: [] };
  }
  const rows = results.map(mapIeApiResultToRow);
  rows.sort(
    (a, b) =>
      a._sortDepartedAt - b._sortDepartedAt ||
      a.trackingNumber.localeCompare(b.trackingNumber, 'fr')
  );
  return { matchCount, rows };
}

function toExcelDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Export .xlsx : N° de suivi en texte, poids / volume / montants en nombres, dates en type date, tri côté données déjà par Départ.
 */
export async function downloadIeApiRowsAsExcel(
  rows: IeApiTrackingTableRow[],
  columnLabels: Record<IeApiTableColumnKey, string>,
  fileBaseName: string
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Suivi IE', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  const header = IE_API_TABLE_COLUMN_ORDER.map(k => columnLabels[k]);
  sheet.addRow(header);
  const hr = sheet.getRow(1);
  hr.font = { bold: true };
  hr.eachCell(c => {
    c.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' }
    };
  });

  for (const row of rows) {
    const r = sheet.addRow([]);
    let c = 1;
    for (const key of IE_API_TABLE_COLUMN_ORDER) {
      const cell = r.getCell(c);
      c += 1;
      if (key === 'trackingNumber') {
        const v = row.trackingNumber;
        cell.value = v.length ? v : null;
        cell.numFmt = '@';
        continue;
      }
      if (key === 'weightKg') {
        if (row.weightKgValue != null) {
          cell.value = row.weightKgValue;
          cell.numFmt = '0.##########';
        } else {
          cell.value = null;
        }
        continue;
      }
      if (key === 'volumeCbm') {
        if (row.volumeCbmValue != null) {
          cell.value = row.volumeCbmValue;
          cell.numFmt = '0.##########';
        } else {
          cell.value = null;
        }
        continue;
      }
      if (key === 'amountEstimate') {
        if (row.estimateAr != null) {
          cell.value = row.estimateAr;
          cell.numFmt = '#,##0';
        } else {
          cell.value = null;
        }
        continue;
      }
      if (key === 'pickupAmount') {
        if (row.pickupAr != null) {
          cell.value = row.pickupAr;
          cell.numFmt = '#,##0';
        } else {
          cell.value = null;
        }
        continue;
      }
      if (key === 'lastUpdated') {
        const d = toExcelDate(row.lastUpdatedIso);
        cell.value = d;
        if (d) cell.numFmt = 'dd/mm/yyyy hh:mm';
        else cell.value = row.lastUpdated || null;
        continue;
      }
      if (key === 'receivedAt') {
        const d = toExcelDate(row.receivedAtIso);
        cell.value = d;
        if (d) cell.numFmt = 'dd/mm/yyyy hh:mm';
        else cell.value = row.receivedAt || null;
        continue;
      }
      if (key === 'departedAt') {
        const d = toExcelDate(row.departedAtIso);
        cell.value = d;
        if (d) cell.numFmt = 'dd/mm/yyyy hh:mm';
        else cell.value = row.departedAt || null;
        continue;
      }
      if (key === 'arrivedAt') {
        const d = toExcelDate(row.arrivedAtIso);
        cell.value = d;
        if (d) cell.numFmt = 'dd/mm/yyyy hh:mm';
        else cell.value = row.arrivedAt || null;
        continue;
      }
      if (key === 'readyForPickupAt') {
        const d = toExcelDate(row.readyForPickupAtIso);
        cell.value = d;
        if (d) cell.numFmt = 'dd/mm/yyyy hh:mm';
        else cell.value = row.readyForPickupAt || null;
        continue;
      }
      const text = row[key] ?? '';
      cell.value = text.length ? text : null;
    }
  }

  sheet.columns.forEach((col, i) => {
    const w = [18, 14, 18, 12, 14, 12, 10, 12, 12, 12, 18, 18, 18, 18, 18, 12, 12][i];
    col.width = w ?? 14;
  });

  const buf = await wb.xlsx.writeBuffer();
  const name = `${fileBaseName.replace(/[^\w\-.]+/g, '_')}.xlsx`;
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

import React from 'react';

/** Hauteur max du conteneur scrollable (viewport − chrome page). */
export const DATA_TABLE_MAX_H = 'max-h-[calc(100vh-11rem)]';

/**
 * Classes partagées — tableaux listes (compact + en-tête figée).
 * Utiliser avec <DataTable> + border-separate pour que sticky fonctionne.
 */
export const dtTh =
  'sticky top-0 z-30 px-3 py-2 text-left text-xs font-medium tracking-wide border-b bg-[var(--app-surface-muted)] text-[var(--app-ink-muted)] border-[var(--app-border)]';

export const dtThRight = `${dtTh} text-right`;

export const dtTd =
  'px-3 py-1.5 text-xs whitespace-nowrap text-[var(--app-ink)]';

export const dtTdMuted =
  'px-3 py-1.5 text-xs whitespace-nowrap text-[var(--app-ink-muted)]';

export const dtTdWrap = 'px-3 py-1.5 text-xs text-[var(--app-ink)]';

interface DataTableProps {
  children: React.ReactNode;
  /** Classes sur le conteneur scroll */
  className?: string;
  /** Override hauteur max (défaut: DATA_TABLE_MAX_H) */
  maxHeightClass?: string;
  /** Classes supplémentaires sur <table> */
  tableClassName?: string;
}

/**
 * Conteneur scroll + table prêts pour en-tête (et colonnes) sticky.
 * Composer thead/tbody avec dtTh / dtTd.
 */
export const DataTable = React.forwardRef<HTMLDivElement, DataTableProps>(
  (
    {
      children,
      className = '',
      maxHeightClass = DATA_TABLE_MAX_H,
      tableClassName = ''
    },
    ref
  ) => (
    <div ref={ref} className={`overflow-auto ${maxHeightClass} ${className}`}>
      <table
        className={`app-table-striped min-w-full border-separate border-spacing-0 ${tableClassName}`}
        style={{ borderColor: 'var(--app-border)' }}
      >
        {children}
      </table>
    </div>
  )
);

DataTable.displayName = 'DataTable';

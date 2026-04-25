/**
 * Correspondance chemins d’URL ↔ id de page (navigation interne, sans react-router).
 * Permet d’ouvrir des liens directs (ex. /admin) et d’avoir l’URL à jour.
 */

type PageParams = { action?: string } | null;

const ADMIN_BASE = '/admin';

/** Page interne -> chemin d’URL */
export function getPathnameForPage(page: string, pageParams: PageParams): string {
  if (page === 'referentials') return ADMIN_BASE;
  if (page === 'logs') return `${ADMIN_BASE}/logs`;
  if (page === 'dashboard') return '/';
  if (page === 'supply' && pageParams?.action === 'create-order') {
    return '/supply';
  }
  if (['clients', 'sales', 'tiktok-live', 'payments', 'expenses', 'stock', 'inventories', 'supply', 'deliveries', 'tracking'].includes(page)) {
    return `/${page}`;
  }
  return '/';
}

/** URL -> page interne */
export function getPageFromPathname(pathname: string): string {
  const p = (pathname || '/').replace(/\/$/, '') || '/';

  if (p === '/admin' || p === '/admin/referentials') {
    return 'referentials';
  }
  if (p === '/admin/logs') {
    return 'logs';
  }

  const direct: Record<string, string> = {
    '/': 'dashboard',
    '/dashboard': 'dashboard',
    '/clients': 'clients',
    '/sales': 'sales',
    '/tiktok-live': 'tiktok-live',
    '/payments': 'payments',
    '/expenses': 'expenses',
    '/stock': 'stock',
    '/inventories': 'inventories',
    '/supply': 'supply',
    '/deliveries': 'deliveries',
    '/tracking': 'tracking'
  };

  if (direct[p]) {
    return direct[p];
  }

  return 'dashboard';
}

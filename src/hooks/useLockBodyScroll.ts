import { useEffect } from 'react';

let lockCount = 0;
let previousBodyOverflow = '';
let previousHtmlOverflow = '';

/**
 * Bloque le scroll de la page (html/body) tant qu'un overlay/offcanvas est ouvert.
 * Compteur partagé pour supporter les modals imbriqués.
 */
export function useLockBodyScroll(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    if (lockCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      previousHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }
    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount <= 0) {
        lockCount = 0;
        document.body.style.overflow = previousBodyOverflow;
        document.documentElement.style.overflow = previousHtmlOverflow;
      }
    };
  }, [enabled]);
}

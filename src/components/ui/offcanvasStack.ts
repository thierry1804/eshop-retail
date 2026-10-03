const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type OffcanvasStackEntry = {
  id: symbol;
  onClose: () => void;
  getPanel: () => HTMLElement | null;
};

const stack: OffcanvasStackEntry[] = [];
const listeners = new Set<() => void>();
let listening = false;

function notify(): void {
  listeners.forEach((fn) => fn());
}

function getFocusable(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.tabIndex !== -1 && el.offsetParent !== null
  );
}

function onGlobalKeyDown(e: KeyboardEvent): void {
  const top = stack[stack.length - 1];
  if (!top) return;

  const panel = top.getPanel();
  if (!panel) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    top.onClose();
    return;
  }

  if (e.key !== 'Tab') return;

  const list = getFocusable(panel);
  if (list.length === 0) {
    e.preventDefault();
    panel.focus();
    return;
  }

  const first = list[0];
  const last = list[list.length - 1];
  const active = document.activeElement as HTMLElement | null;

  if (e.shiftKey) {
    if (active === first || !panel.contains(active)) {
      e.preventDefault();
      last.focus();
    }
  } else if (active === last || !panel.contains(active)) {
    e.preventDefault();
    first.focus();
  }
}

function ensureListener(): void {
  if (listening) return;
  listening = true;
  document.addEventListener('keydown', onGlobalKeyDown, true);
}

function teardownIfEmpty(): void {
  if (stack.length === 0 && listening) {
    document.removeEventListener('keydown', onGlobalKeyDown, true);
    listening = false;
  }
}

/** Enregistre un Offcanvas. Retourne profondeur (0-based) + cleanup. */
export function pushOffcanvas(entry: OffcanvasStackEntry): {
  depth: number;
  unregister: () => void;
} {
  stack.push(entry);
  ensureListener();
  notify();
  const depth = stack.length - 1;

  return {
    depth,
    unregister: () => {
      const i = stack.findIndex((e) => e.id === entry.id);
      if (i >= 0) stack.splice(i, 1);
      teardownIfEmpty();
      notify();
    }
  };
}

export function isTopOffcanvas(id: symbol): boolean {
  return stack.length > 0 && stack[stack.length - 1].id === id;
}

/** S’abonner aux changements de pile (top / profondeur). */
export function subscribeOffcanvasStack(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

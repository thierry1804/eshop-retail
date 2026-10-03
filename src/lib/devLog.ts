/** Logs de diagnostic : actifs uniquement en développement. */

export function devLog(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
}

export function devWarn(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.warn(...args);
  }
}

export function devInfo(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.info(...args);
  }
}

export function devDebug(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.debug(...args);
  }
}

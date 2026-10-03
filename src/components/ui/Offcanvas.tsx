import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import {
  isTopOffcanvas,
  pushOffcanvas,
  subscribeOffcanvasStack
} from './offcanvasStack';

export type OffcanvasWidth = 'md' | 'lg' | 'xl' | 'full';

const WIDTH_CLASS: Record<OffcanvasWidth, string> = {
  md: 'md:w-[560px] lg:w-[640px]',
  lg: 'md:w-[720px] lg:w-[900px]',
  xl: 'md:w-[900px] lg:w-[1100px] xl:w-[1200px]',
  full: 'md:w-[95vw] lg:w-[95vw]'
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Z_STEP = 20;
const DEFAULT_BACKDROP_Z = 60;
const DEFAULT_PANEL_Z = 70;

interface OffcanvasProps {
  onClose: () => void;
  children: React.ReactNode;
  /** Largeur du panneau. Défaut: lg */
  width?: OffcanvasWidth;
  /** Classes supplémentaires sur le panneau */
  className?: string;
  /** z-index de base du panneau. Empilé automatiquement si nested. Défaut 70 */
  panelZ?: number;
  /** z-index de base du backdrop. Empilé automatiquement si nested. Défaut 60 */
  backdropZ?: number;
  /** Nom accessible du dialogue */
  ariaLabel?: string;
  /** id de l’élément titre dans le panneau (prioritaire sur ariaLabel) */
  ariaLabelledBy?: string;
}

/**
 * Panneau latéral droit + backdrop. Monte sur document.body.
 * Escape / focus trap : uniquement le panneau au sommet de la pile (nested-safe).
 */
export const Offcanvas: React.FC<OffcanvasProps> = ({
  onClose,
  children,
  width = 'lg',
  className = '',
  panelZ = DEFAULT_PANEL_Z,
  backdropZ = DEFAULT_BACKDROP_Z,
  ariaLabel = 'Panneau',
  ariaLabelledBy
}) => {
  useLockBodyScroll();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const idRef = useRef(Symbol('offcanvas'));
  const [depth, setDepth] = useState(0);
  const [isTop, setIsTop] = useState(true);

  onCloseRef.current = onClose;

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const id = idRef.current;

    const { depth: d, unregister } = pushOffcanvas({
      id,
      onClose: () => onCloseRef.current(),
      getPanel: () => panelRef.current
    });
    setDepth(d);
    setIsTop(true);

    const panel = panelRef.current;
    if (panel) {
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => el.tabIndex !== -1 && el.offsetParent !== null);
      (focusables[0] ?? panel).focus();
    }

    const unsub = subscribeOffcanvasStack(() => {
      setIsTop(isTopOffcanvas(id));
    });

    return () => {
      unsub();
      unregister();
      previousFocusRef.current?.focus?.();
    };
  }, []);

  const resolvedBackdropZ = backdropZ + depth * Z_STEP;
  const resolvedPanelZ = panelZ + depth * Z_STEP;

  const overlay = (
    <>
      <div
        className="fixed inset-0 w-screen h-[100dvh] animate-fade-in"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          margin: 0,
          padding: 0,
          zIndex: resolvedBackdropZ,
          backgroundColor: 'rgba(36, 48, 65, 0.45)'
        }}
        onClick={() => {
          if (isTopOffcanvas(idRef.current)) onClose();
        }}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`fixed right-0 top-0 h-[100dvh] w-full ${WIDTH_CLASS[width]} animate-slide-in-right flex flex-col outline-none ${className}`}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          margin: 0,
          padding: 0,
          zIndex: resolvedPanelZ,
          backgroundColor: 'var(--app-surface)',
          color: 'var(--app-ink)',
          boxShadow: 'var(--app-shadow-panel)'
        }}
        role="dialog"
        aria-modal="true"
        aria-hidden={!isTop ? true : undefined}
        aria-label={ariaLabelledBy ? undefined : ariaLabel}
        aria-labelledby={ariaLabelledBy}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>
  );

  return createPortal(overlay, document.body);
};

interface OffcanvasHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const OffcanvasHeader: React.FC<OffcanvasHeaderProps> = ({
  children,
  className = ''
}) => (
  <div
    className={`flex-shrink-0 border-b px-3 sm:px-4 py-3 ${className}`}
    style={{
      borderColor: 'var(--app-border)',
      backgroundColor: 'var(--app-surface)'
    }}
  >
    {children}
  </div>
);

interface OffcanvasBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const OffcanvasBody: React.FC<OffcanvasBodyProps> = ({
  children,
  className = ''
}) => (
  <div className={`flex-1 overflow-y-auto px-3 sm:px-4 py-3 ${className}`}>
    {children}
  </div>
);

interface OffcanvasFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const OffcanvasFooter: React.FC<OffcanvasFooterProps> = ({
  children,
  className = ''
}) => (
  <div
    className={`flex-shrink-0 border-t px-3 sm:px-4 py-3 ${className}`}
    style={{
      borderColor: 'var(--app-border)',
      backgroundColor: 'var(--app-surface-muted)'
    }}
  >
    {children}
  </div>
);

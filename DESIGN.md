---
name: SaleManager
description: Outil métier dense et fiable pour boutique (ventes, stocks, approvisionnement)
colors:
  primary: "#2563eb"
  primary-deep: "#1d4ed8"
  primary-soft: "#c9dcf5"
  canvas: "#f4f6f9"
  surface: "#f8fafc"
  sidebar: "#e4ebf3"
  sidebar-border: "#c5d0de"
  ink: "#243041"
  ink-muted: "#5b6b7c"
  border: "#d5dde8"
  danger: "#dc2626"
  success: "#15803d"
typography:
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.25
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.3
rounded:
  sm: "6px"
  md: "8px"
spacing:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  sidebar-nav-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-deep}"
    rounded: "{rounded.md}"
---

# Design System: SaleManager

## 1. Overview

**Creative North Star: "The Daylight Ledger"**

Interface de travail diurne : un registre clair où la navigation (acier froid) se distingue du canvas (papier bleuté très léger) et des surfaces blanches de saisie. Densité utile, peu d’ornement, confiance d’outil pro.

Rejette explicitement le violet SaaS, le glassmorphism, les grilles KPI héro, le dark néon, et les pills décoratives.

**Key Characteristics:**
- Neutres teintés bleu froid, un seul accent bleu
- Tableaux compacts + en-têtes figés
- Formulaires en offcanvas
- Ombres minimales ; profondeur par tonalité et bordure 1px

## 2. Colors

Palette **restrained** : neutres froids + accent bleu ≤10% de l’écran.

### Primary
- **Signal Blue** (#2563eb): actions primaires, liens actifs, marque SaleManager
- **Signal Blue Deep** (#1d4ed8): hover / texte actif fort
- **Signal Blue Soft** (#c9dcf5): fond d’item de nav sélectionné

### Neutral
- **Canvas Mist** (#f4f6f9): fond de la zone de travail
- **Surface Paper** (#f8fafc / blanc UI): cartes, tableaux, offcanvas
- **Steel Rail** (#e4ebf3): sidebar
- **Rail Line** (#c5d0de): bordures sidebar
- **Ink** (#243041): texte principal
- **Ink Muted** (#5b6b7c): labels secondaires
- **Hairline** (#d5dde8): bordures canvas

### Named Rules
**The One Signal Rule.** Le bleu n’apparaît que pour action, sélection ou marque. Jamais en fond de page ni en décoration de carte.

## 3. Typography

**Display Font:** system-ui stack  
**Body Font:** system-ui stack  

**Character:** Sans système, neutre, lisible en journée. Pas de serif display.

### Hierarchy
- **Title** (700, 18px): titres de page
- **Body** (400, 14px): contenu et formulaires
- **Label** (500, 12px): en-têtes de tableau, meta, badges utiles

### Named Rules
**The No-Eyebrow Rule.** Pas de labels uppercase tracked au-dessus des titres.

## 4. Elevation

Profondeur surtout **tonale** (sidebar vs canvas vs surface). Ombres légères uniquement sur offcanvas / menus.

### Shadow Vocabulary
- **Panel** (`0 8px 24px rgba(36, 48, 65, 0.12)`): offcanvas et dropdowns
- **Rest:** aucune ombre sur tables et listes

### Named Rules
**The Flat-By-Default Rule.** Les listes et KPI restent plates ; l’élévation sert les panneaux flottants.

## 5. Components

### Buttons
- **Shape:** 8px
- **Primary** (`app-btn app-btn-primary`): fond Signal Blue, texte clair
- **Secondary** (`app-btn app-btn-secondary`): bordure Hairline, fond surface
- **Success** (`app-btn-success`): réception / validation positive
- **Danger** (`app-btn-danger`): suppression / action irréversible
- **Small** (`app-btn-sm`): actions inline densés
- **Icon** (`app-icon-btn` / `-primary` / `-danger`): actions de ligne 32×32
- **Footer group** (`app-actions`): Cancel + Save alignés à droite

### Search
- **Toujours** `SearchField` (`src/components/ui/SearchField.tsx`)
- Gabarit: icône 16px + `app-input pl-9`, jamais un input search ad hoc

### Cards / Containers
- **Corner Style:** 8px max
- **Background:** Surface Paper
- **Border:** 1px Hairline
- **Shadow Strategy:** aucune par défaut
- **Internal Padding:** 12–16px

### Inputs / Fields
- **Style:** bordure Hairline, fond blanc, radius 8px
- **Focus:** ring bleu discret (2px)

### Token utilities (CSS)
- Texte: `app-text`, `app-text-muted`, `app-text-link`, `app-text-danger`, `app-text-success`
- Fonds: `app-bg-muted`, `app-surface`
- Bordures: `app-border`, `app-divider`
- Listes déroulantes: `app-dropdown`, `app-dropdown-item`
- Éviter `text-gray-*` / `bg-gray-*` / `border-gray-*` / `bg-blue-*` pour le chrome UI (statuts sémantiques OK)

### Navigation
- Sidebar Steel Rail ; item actif Signal Blue Soft + Deep text
- Hover Rail hover ; transitions 150–200ms

### Data tables
- Compact (`px-3 py-1.5`, `text-xs`)
- Sticky header
- Conteneur scroll `max-h-[calc(100vh-11rem)]`
- **Striped** (`app-table-striped`): lignes paires `--app-stripe` (#eef2f7), hover Surface muted
- Hover / stripe appliqués sur `td` (colonnes sticky cohérentes)

### Page chrome (ergonomie)
**Référence:** `ProductsList` (Gestion des stocks). Toute liste métier doit calquer ce shell.

```
space-y-2
└─ app-sticky-chrome space-y-2
   ├─ titre (app-page-title) + actions (app-btn app-btn-sm, icônes 3.5)
   └─ app-toolbar (SearchField + selects text-xs)
└─ mobile: md:hidden space-y-3 + app-list-card (meta avec border-t app-divider)
└─ desktop: hidden md:block app-table-wrap + DataTable
```

- Pas de padding page local (`p-6` etc.) : le shell App fournit déjà `px` / `pt`
- Loading: spinner centré `h-64` / `h-12` primary
- `app-sticky-chrome`: titre + filtres collés en haut pendant le scroll
- `app-toolbar`: barre de filtres / recherche compacte
- `app-list-card`: cartes mobile plates (bordure, pas d’ombre)
- `app-icon-btn`: actions de ligne 32×32
- `app-tabs` / `app-tab-active`: onglets soulignés, pas de pills
- `app-empty`: états vides actionnables
- `app-mobile-bar`: barre fixe mobile (menu + marque), pas de boutons flottants ombrés

### Offcanvas
- Panneau droit full-height, header / body scroll / footer figé (fond muted)
- Backdrop ink 45%
- Escape, focus trap, restauration du focus, `aria-label` / `aria-labelledby`
- **Nested-safe** : pile LIFO (`offcanvasStack`) — Escape/Tab/backdrop n’agissent que sur le sommet ; z-index auto (+20 par niveau)
- **Obligatoire** pour formulaires / détails latéraux (SaleForm, ProductForm, ProductDetails, Expenses, DeliveryForm, PurchaseOrderDetails, QuickCreate…) — pas de panneau `fixed` maison
- Icon buttons: 44×44 touch / 32×32 desktop

## 6. Do's and Don'ts

**Do**
- Réutiliser `DataTable`, `Offcanvas`, tokens `--app-*` / `--sidebar-*`
- Garder les listes denses et les dates en `dd/mm/yyyy`
- Réserver le bleu aux actions et états
- Coller filtres + titre pour ne pas perdre le contexte en scroll

**Don't**
- Inventer une nouvelle couleur d’accent par module
- Empiler des cards dans des cards
- Ajouter des gradients, glows, ou métriques héro décoratives
- Utiliser des modales centrées pour les gros formulaires (préférer offcanvas)
- Emojis / uppercase tracked dans la navigation

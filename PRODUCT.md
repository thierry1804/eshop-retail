# Product

## Register

product

## Users

Gérants et employés de boutique (friperie / vente). Usage en journée, bureau clair, souvent sur écran portable ou fixe. Ils enchaînent des tâches opérationnelles : listes denses, formulaires, réceptions fournisseur, clôtures de stock ou de commandes, suivi paiements et livraisons. Peu de temps pour « découvrir » l’UI : l’outil doit disparaître derrière la tâche.

## Product Purpose

SaleManager (FriperieManager) est l’outil métier pour gérer clients, ventes, paiements, stocks, approvisionnements, livraisons et dépenses. Le succès se mesure à la vitesse d’exécution (trouver, saisir, valider) et à la fiabilité des données (soldes, stocks, statuts de commande), pas à l’effet visuel.

## Brand Personality

Clair, dense, fiable.

Ton direct, labels métier, zéro fluff marketing. Confiance d’outil pro (Linear, Stripe Dashboard) plus que vitrine startup.

## Anti-references

- Violet / indigo SaaS générique et gradients décoratifs
- Glassmorphism, glows, cards flottantes
- Grilles de KPI héro décoratives
- Crème + serif + terracotta « template AI »
- Dark mode néon / control-room cosplay
- Pills, badges et eyebrows partout sans besoin fonctionnel

## Design Principles

1. **La tâche d’abord** — chaque écran sert une action claire (lister, saisir, clôturer, recevoir).
2. **Densité utile** — plus d’info visible sans bruit ; tableaux compacts, en-têtes figés.
3. **Une surface, un rôle** — sidebar navigation, canvas travail blanc, panneaux latéraux pour les formulaires.
4. **Accent réservé à l’état** — le bleu marque sélection, action primaire, lien actif ; pas la décoration.
5. **Cohérence > surprise** — mêmes boutons, mêmes tableaux, mêmes offcanvas partout.

## Accessibility & Inclusion

- Contraste lisible en lumière du jour (texte sombre sur surfaces claires)
- Focus clavier visible sur contrôles
- `prefers-reduced-motion` respecté (transitions courtes, pas de choregraphy)
- Cible WCAG AA pour texte et contrôles principaux

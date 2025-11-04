<!-- 54c1d10d-cbfe-4df0-88ab-f8ef61dc41c1 363ec4d6-c162-420e-a02e-decee54e2f92 -->
# Plan: Transformation du modal de création de commande en page dédiée

## Modifications à effectuer

### 1. Créer une nouvelle page dédiée pour la création de commande

- **Fichier**: `src/components/Supply/CreatePurchaseOrderPage.tsx` (nouveau)
- Créer un composant page basé sur `PurchaseOrderForm.tsx` mais sans le wrapper modal
- Transformer le contenu du modal en page complète avec un layout approprié
- Ajouter un bouton "Retour" pour revenir à la liste des commandes

### 2. Modifier le système de routing dans App.tsx

- **Fichier**: `src/components/App.tsx`
- Ajouter un état pour gérer les sous-pages (ex: `pageParams` ou utiliser `currentPage` avec des valeurs comme `create-order`)
- Ajouter un cas dans `renderCurrentPage()` pour afficher `CreatePurchaseOrderPage` quand approprié
- Gérer la navigation vers/depuis cette page

### 3. Modifier PurchaseOrdersList.tsx pour utiliser la navigation

- **Fichier**: `src/components/Supply/PurchaseOrdersList.tsx`
- Remplacer `setShowForm(true)` par une navigation vers la page de création
- Adapter pour recevoir un callback de navigation depuis App.tsx ou utiliser un état partagé

### 4. Ajouter RMB aux devises disponibles

- **Fichier**: `src/components/Supply/PurchaseOrderForm.tsx` (lignes 306-309)
- Ajouter `<option value="RMB">RMB</option>` dans le select des devises
- **Fichier**: `src/components/Supply/CreatePurchaseOrderPage.tsx` (à créer)
- Inclure RMB dans le select des devises également

### 5. Ajouter la fonctionnalité de création de fournisseur

- **Fichier**: `src/components/Supply/CreatePurchaseOrderPage.tsx` et `PurchaseOrderForm.tsx`
- Ajouter un bouton "+" ou "Créer un nouveau fournisseur" à côté du select de fournisseur
- Créer un composant modal `SupplierQuickCreate.tsx` similaire à `ProductQuickCreate.tsx`
- Le modal doit permettre de créer un fournisseur avec au minimum: nom, email, téléphone
- Après création, mettre à jour la liste des fournisseurs et sélectionner automatiquement le nouveau fournisseur

## Fichiers à modifier/créer

1. **Nouveau**: `src/components/Supply/CreatePurchaseOrderPage.tsx`
2. **Modifier**: `src/App.tsx` - Ajouter la gestion de la page create-order
3. **Modifier**: `src/components/Supply/PurchaseOrdersList.tsx` - Navigation au lieu du modal
4. **Modifier**: `src/components/Supply/PurchaseOrderForm.tsx` - Ajouter RMB et fonctionnalité fournisseur
5. **Nouveau**: `src/components/Supply/SupplierQuickCreate.tsx` - Modal de création rapide de fournisseur

## Notes d'implémentation

- Le composant `PurchaseOrderForm` peut être réutilisé en partie pour la nouvelle page, mais il faut extraire la logique du formulaire
- Pour la navigation, on peut utiliser un système de props ou un contexte React pour passer la fonction de navigation
- La création de fournisseur doit être rapide (nom minimum requis) et mettre à jour immédiatement la liste
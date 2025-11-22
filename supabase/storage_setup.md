# Configuration Supabase Storage pour les images de produits

## Étapes de configuration

### 1. Créer le bucket dans Supabase

1. Allez sur votre projet Supabase
2. Naviguez vers **Storage** dans le menu de gauche
3. Cliquez sur **New bucket**
4. Configurez le bucket :
   - **Name**: `product-images`
   - **Public bucket**: ✅ Activé (pour que les images soient accessibles publiquement)
   - **File size limit**: 5 MB (ou selon vos besoins)
   - **Allowed MIME types**: `image/*` (ou spécifiez : `image/jpeg,image/png,image/webp`)

### 2. Configurer les politiques RLS (Row Level Security)

Dans Supabase, allez dans **Storage** → **Policies** pour le bucket `product-images` :

#### Politique de lecture (SELECT) - Publique
```sql
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');
```

#### Politique d'insertion (INSERT) - Utilisateurs authentifiés
```sql
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');
```

#### Politique de mise à jour (UPDATE) - Utilisateurs authentifiés
```sql
CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');
```

#### Politique de suppression (DELETE) - Utilisateurs authentifiés
```sql
CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');
```

### 3. Appliquer la migration

Exécutez la migration pour ajouter le champ `image_url` à la table `products` :

```bash
# Si vous utilisez Supabase CLI
supabase db push

# Ou appliquez manuellement la migration :
# supabase/migrations/20250123000000_add_image_url_to_products.sql
```

### 4. Vérification

Une fois configuré, vous devriez pouvoir :
- ✅ Uploader des images lors de la création d'un produit
- ✅ Voir un aperçu de l'image avant l'upload
- ✅ Voir les images des produits dans les listes et détails

## Notes importantes

- Les images sont stockées dans le bucket `product-images` avec le chemin `products/{timestamp}-{random}.{ext}`
- La taille maximale par défaut est de 5MB (modifiable dans le code)
- Les formats acceptés sont tous les formats d'image (PNG, JPG, WEBP, etc.)
- Les images sont accessibles publiquement via l'URL générée par Supabase



# Feature 3: Post Scheduler — Guide de Test Local

## 🎯 Objectif
Implémenter la programmation de publications : les créateurs peuvent programmer la publication d'un post à une date/heure spécifique.

## ✅ Migrations appliquées

```sql
-- Migration 003: Post Scheduler
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts(scheduled_at)
WHERE is_published = false AND scheduled_at IS NOT NULL;
```

## 🔧 Routes backend ajoutées

### POST /posts (modifié)
**Paramètre additionnel**: `scheduled_at` (ISO string, optionnel)
- Si `scheduled_at` est fourni et dans le futur → post créé avec `is_published=false`
- Si `scheduled_at` est null ou passé → post créé avec `is_published=true` (publication immédiate)

**Exemple**:
```bash
curl -X POST http://localhost:3000/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "caption": "Post programmé",
    "media_type": "IMAGE",
    "media_url": "https://example.com/image.jpg",
    "access_level": "PUBLIC",
    "scheduled_at": "2026-09-01T18:00:00Z"
  }'
```

### GET /posts/scheduled
**Authentification**: Requise (créateur)
**Retour**: Liste des posts programmés du créateur, triés par `scheduled_at`

```bash
curl -X GET http://localhost:3000/posts/scheduled \
  -H "Authorization: Bearer $TOKEN"
```

**Réponse**:
```json
{
  "posts": [
    {
      "id": "uuid-1",
      "caption": "Mon post programmé",
      "media_url": "https://...",
      "scheduled_at": "2026-09-01T18:00:00Z",
      "created_at": "2026-08-30T14:00:00Z"
    }
  ]
}
```

### PUT /posts/:id/reschedule
**Authentification**: Requise (créateur propriétaire)
**Body**: `{ "scheduled_at": "2026-09-02T20:00:00Z" }` ou `{ "scheduled_at": null }`

- Si `scheduled_at` est fourni → reprogrammer le post
- Si `scheduled_at` est null → annuler la programmation et publier maintenant

```bash
curl -X PUT http://localhost:3000/posts/:postId/reschedule \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "scheduled_at": "2026-09-02T20:00:00Z" }'
```

## 🤖 Cron job ajouté

**CRON #8** — Publication automatique des posts programmés
- **Intervalle**: Toutes les minutes
- **Logique**: Récupère les posts dont `scheduled_at <= NOW()` et `is_published=false`, puis les marque comme publiés

```javascript
cron.schedule('* * * * *', async () => {
  const now = new Date().toISOString();
  const { data: scheduled } = await supabase.from('posts')
    .select('id, creator_id')
    .eq('is_published', false)
    .lte('scheduled_at', now);
  
  for (const post of scheduled || []) {
    await supabase.from('posts')
      .update({ is_published: true, updated_at: now })
      .eq('id', post.id);
  }
});
```

## 📱 Composants frontend ajoutés

### PostCreatorForm
**Fichier**: `web/src/components/posts/post-creator-form.tsx`
- Formulaire complet de création de post
- Support pour programmer la publication via date + time inputs
- Validation : la date programmée doit être dans le futur
- Affiche le date/time programmé en temps local

**Usage**:
```jsx
<PostCreatorForm 
  onPostCreated={(post) => console.log('Post créé:', post)} 
  onCancel={() => console.log('Annulé')} 
/>
```

### ScheduledPostsList
**Fichier**: `web/src/components/posts/scheduled-posts-list.tsx`
- Liste tous les posts programmés du créateur
- Boutons : Modifier, Publier maintenant, Supprimer
- Affiche l'heure restante avant publication
- Alerte visuelle si publication < 1h

**Usage**:
```jsx
<ScheduledPostsList />
```

## 🧪 Plan de test local

### 1️⃣ **Setup**
```bash
# Backend
cd backend
npm install
npm run dev  # Port 3000

# Frontend
cd web
npm install
npm run dev  # Port 3001
```

### 2️⃣ **Migration PostgreSQL**
```bash
# Via Supabase CLI
supabase migration up

# OU via SQL dans Supabase dashboard:
psql $DATABASE_URL < backend/migrations/003_scheduler_posts.sql
```

### 3️⃣ **Tests manuels (Postman/cURL)**

#### Test 3a: Créer un post programmé (futur)
```bash
# Créer un post programmé dans 2 heures
export TOKEN="<votre_jwt>"
export NOW=$(date -u +'%Y-%m-%dT%H:%M:%S')
export FUTURE=$(date -u -d '+2 hours' +'%Y-%m-%dT%H:%M:%S')

curl -X POST http://localhost:3000/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"caption\": \"Post programmé pour $FUTURE\",
    \"media_type\": \"IMAGE\",
    \"media_url\": \"https://via.placeholder.com/400\",
    \"access_level\": \"PUBLIC\",
    \"scheduled_at\": \"${FUTURE}Z\"
  }"

# ✅ Vérifier: response contient "is_published": false, "scheduled_at": "2026-09-01T16:00:00Z"
```

#### Test 3b: Créer un post immédiat (sans scheduled_at)
```bash
curl -X POST http://localhost:3000/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "caption": "Post public immédiat",
    "media_type": "IMAGE",
    "media_url": "https://via.placeholder.com/400",
    "access_level": "PUBLIC"
  }'

# ✅ Vérifier: "is_published": true
```

#### Test 3c: Lister les posts programmés
```bash
curl -X GET http://localhost:3000/posts/scheduled \
  -H "Authorization: Bearer $TOKEN"

# ✅ Réponse: liste avec POST 3a, pas POST 3b
```

#### Test 3d: Reprogrammer un post
```bash
# Récupérer l'id du post 3a
export POST_ID="<id_du_post_3a>"
export NEW_SCHEDULE=$(date -u -d '+5 hours' +'%Y-%m-%dT%H:%M:%S')

curl -X PUT http://localhost:3000/posts/$POST_ID/reschedule \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"scheduled_at\": \"${NEW_SCHEDULE}Z\"}"

# ✅ Vérifier: scheduled_at mis à jour
```

#### Test 3e: Annuler programmation (publier maintenant)
```bash
curl -X PUT http://localhost:3000/posts/$POST_ID/reschedule \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scheduled_at": null}'

# ✅ Vérifier: is_published=true, scheduled_at=null
```

### 4️⃣ **Tests dans le navigateur**

#### Créer un post programmé via le formulaire
1. Se connecter en tant que créateur
2. Importer `PostCreatorForm` dans une page test
3. Remplir : Caption, Media URL, Access Level
4. Sélectionner une date/heure dans le futur
5. Cliquer "Programmer"
6. ✅ Vérifier : Post apparaît dans la liste des programmés

#### Voir et gérer les posts programmés
1. Importer `ScheduledPostsList`
2. Lister les posts programmés
3. Tester : Modifier l'heure, Publier maintenant, Supprimer
4. ✅ Vérifier : Interface réactive, changements reflétés

### 5️⃣ **Test du cron job**

**Approche manuelle** (sans attendre 1 minute):
1. Créer un post programmé avec `scheduled_at` = NOW + 30 secondes
2. Vérifier via GET /posts/scheduled que `is_published=false`
3. Attendre 31 secondes
4. Vérifier via GET /posts/scheduled que le post a disparu (car `is_published=true`)
5. Vérifier via GET /posts/:id que `is_published=true`

**Test dans les logs du serveur**:
- Backend doit afficher: `[INFO] [CRON#8] 1 post(s) programmé(s) publié(s)` chaque minute

## 📊 Checklist de validation

- [ ] Migration PostgreSQL appliquée sans erreur
- [ ] Route POST /posts accepte `scheduled_at` optionnel
- [ ] Route GET /posts/scheduled retourne les posts programmés
- [ ] Route PUT /posts/:id/reschedule modifie/annule la programmation
- [ ] PostCreatorForm compile sans erreur TypeScript
- [ ] ScheduledPostsList compile sans erreur TypeScript
- [ ] Cron job s'exécute chaque minute (vérifier les logs)
- [ ] Test 3a-3e réussissent (API) ✅
- [ ] Tests navigateur réussissent (UI) ✅
- [ ] Aucune erreur dans la console frontend/backend

## 🚀 Prochaines étapes (après validation)

1. Merger Feature 3 dans `develop` branch
2. Lancer la suite complète des tests (Jest)
3. Code review + merge vers `main`
4. Décider si continuer avec Feature 4 ou 5

---

**Notes**: 
- Les timestamps sont en UTC dans Supabase (`TIMESTAMPTZ`)
- Le composant `PostCreatorForm` gère la conversion en ISO string pour l'API
- La validation `scheduled_at > NOW()` est côté client + serveur (défense en profondeur)

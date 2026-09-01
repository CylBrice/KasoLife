# Phase 1 — Core Revenue & Engagement Implementation

**Objectif**: Livrer les 6 features P0 qui multiplient les revenus par 2-3x

## Timeline: Semaines 1-6

### Feature 1: Commentaires sur les posts (~3j)
- [ ] SQL: Table `comments` + `comment_likes`
- [ ] Backend: Routes CRUD /posts/:id/comments
- [ ] Frontend: Component CommentThread dans PostCard
- [ ] Modération: IA Claude intégrée
- [ ] Test local + commit

### Feature 2: Stories (contenu éphémère 24h) (~4j)
- [ ] SQL: Table `stories` + auto-delete cron
- [ ] Backend: Routes CRUD /stories
- [ ] Frontend: StoryBar component + StoryViewer modal
- [ ] Test local + commit

### Feature 3: Planification de posts (~2j)
- [ ] SQL: ADD COLUMN scheduled_at to posts
- [ ] Backend: Cron job de publication + route de modification
- [ ] Frontend: DateTimePicker dans PostEditor
- [ ] Test local + commit

### Feature 4: Codes promo & réductions (~3j)
- [ ] SQL: Table `promo_codes` + `promo_uses`
- [ ] Backend: Routes CRUD /creators/me/promo-codes
- [ ] Backend: Validation + application dans /subscriptions
- [ ] Frontend: PromoCodeManager + affichage sur profil
- [ ] Test local + commit

### Feature 5: Mass messaging / Broadcast PPV (~4j)
- [ ] SQL: Table `broadcasts`
- [ ] Backend: POST /messages/broadcast avec segmentation
- [ ] Backend: Worker asynchrone pour envoi en batch
- [ ] Frontend: BroadcastComposer dans CreatorDashboard
- [ ] Test local + commit

### Feature 6: Analytiques avancées (~5j)
- [ ] SQL: Vue matérialisée pour agrégats
- [ ] Backend: GET /creators/me/analytics?period=30d
- [ ] Frontend: AnalyticsDashboard avec Recharts
- [ ] Métriques: retention, revenue by type, top posts, churn
- [ ] Test local + commit

---

## Statut actuel
- [ ] Git initialized
- [ ] Branch feature/phase-1-core-revenue created
- [ ] SQL migrations created
- [ ] Backend routes implemented
- [ ] Frontend components implemented
- [ ] Local testing completed
- [ ] All features committed & pushed

## Notes
- Toutes les migrations doivent être appliquées via Supabase SQL directly
- Chaque feature doit être testable en local avant commit
- Pas de force-push sans autorisation

---

Generated: 2026-09-01 by Claude Haiku 4.5

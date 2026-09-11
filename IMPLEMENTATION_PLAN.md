# IMPLEMENTATION PLAN — KasoLife v2

> **RÈGLE ABSOLUE pour toute session IA :**
> - Consulter ce fichier EN DÉBUT de session pour connaître l'état d'avancement
> - Mettre à jour le statut de chaque étape dès qu'elle est terminée
> - Ne jamais détruire l'existant — migrations additives uniquement
> - Toute décision architecturale prise est documentée dans la section "Décisions"

---

## Contexte des décisions prises (session du 2026-09-10)

### Conflits résolus
- ✅ **Pas de Prisma** — on reste sur Supabase JS + pg + migrations SQL numérotées
- ✅ **Migrations additives uniquement** — jamais de modification du schéma existant
- ✅ **XAF/xcon comme devise interne unique** — 1 XAF = 1 xcon, arrondi à l'entier inférieur pour les conversions

### Décisions métier validées
- Albums : photo ET vidéo séparés, achat = accès permanent à l'état courant de l'album
- Private Chat : forfaits fixes (15/30/45/60 min), pas de facturation à la minute
- Cam2Cam : obligation webcam fan active — refus si désactivée (protection créateur)
- VIP Shows : seuil 2 fans minimum, 5 min gratuites, pas de prévente de tickets
- Jouets interactifs : Buttplug.io (open source) + adaptateur Lovense en priorité
- Custom requests : prix créateur + contre-proposition fan + remboursement via admin uniquement
- Snapshots : manuelle par le créateur, achat → "Mes achats"
- Bonus bienvenue : démarre au premier contenu publié, tout configurable admin, versement manuel
- Fan Club : 3 niveaux max, prix plancher admin, créateur peut augmenter, niveau sup = accès niveaux inf
- Watermark : visible + invisible (stéganographie), activation configurable en admin
- Dashboard gains : graphiques courbes + barres, détail par source de revenus
- "Mes achats" : streaming uniquement, jamais de téléchargement, vue unique en messagerie
- Onboarding : non-bloquant, barre de progression
- Devises : XAF interne, tableau de conversion NGN/GHS/KES/ZAR/EUR/USD/GBP affiché
- Admin exception (point 14) : ADMIN+ accède à tout contenu sans paiement, protections levées, chaque consultation auditée

---

## PHASE 1 — Fondations

| Étape | Description | Statut |
|---|---|---|
| 1.1 | Commission system configurable en admin (20%, 15%, 10%, bienvenue) | ✅ Terminé |
| 1.2 | Middleware rôle admin — lever protections pour ADMIN+ avec audit log | ✅ Terminé |
| 1.3 | Table de conversion devises (NGN, GHS, KES, ZAR, EUR, USD, GBP → XAF) | ✅ Terminé |
| 1.4 | Service watermark visible (ID user + timestamp sur images/frames) | ✅ Terminé |
| 1.5 | Service watermark invisible (stéganographie) | ✅ Terminé |
| 1.6 | Secure media viewer (Canvas, signed URLs courte durée, pas d'URL directe) | ✅ Terminé |
| 1.7 | Vue unique messagerie (WhatsApp-like, photo/vidéo disparaît après lecture) | ✅ Terminé |

---

## PHASE 2 — Monétisation contenu

| Étape | Description | Statut |
|---|---|---|
| 2.1 | Migration DB : tables `albums`, `album_items`, `album_purchases` + Fan Club | ✅ Terminé |
| 2.2 | Upload albums photo / vidéo (séparés) + gestion contenu créateur | ✅ Terminé |
| 2.3 | Achat album entier ou pièce isolée + accès permanent | ✅ Terminé |
| 2.4 | Fan Club multi-niveaux (3 niveaux, prix plancher admin, créateur peut augmenter) | ✅ Terminé |
| 2.5 | Accès automatique niveaux inférieurs pour abonné niveau supérieur | ✅ Terminé |
| 2.6 | Page "Mes achats" fan (albums, PPV, snapshots, custom requests) — streaming uniquement | ✅ Terminé |
| 2.7 | Bonus bienvenue créateur — interface admin (taux, seuils, montants, activation manuelle) | ✅ Terminé |

---

## PHASE 3 — Monétisation live

| Étape | Description | Statut |
|---|---|---|
| 3.1 | Recherche architecture Private Chat (LiveKit 1-to-1 vs solution dédiée) | ✅ Terminé |
| 3.2 | Private Chat forfaits (15/30/45/60 min) — blocage wallet début, régularisation fin | ✅ Terminé |
| 3.3 | Cam2Cam — obligation webcam fan active, refus si désactivée | ✅ Terminé |
| 3.4 | VIP Shows — seuil 2 fans, 5 min gratuites, paiement pour continuer | ✅ Terminé |
| 3.5 | Snapshots payants pendant live — prise manuelle créateur, achat → "Mes achats" | ✅ Terminé |

---

## PHASE 4 — Fonctionnalités avancées

| Étape | Description | Statut |
|---|---|---|
| 4.1 | Custom requests — prix + contre-proposition + blocage wallet + signalement admin | ✅ Terminé |
| 4.2 | Jouets interactifs — ToyControlService (Buttplug.io + Lovense), mapping tip → vibration | ✅ Terminé |
| 4.3 | Dashboard gains créateur — graphiques par source, brut/commission/net, filtres période | ✅ Terminé |
| 4.4 | Onboarding créateur guidé — barre de progression non-bloquante | ✅ Terminé |

---

## PHASE 5 — Private Show (vidéo 1-to-1 LiveKit)

> Distinct du Private Chat (messagerie). Types : STANDARD (spy OK) | PREMIUM (exclusif).
> Forfaits 15/30/45/60 min. Queue avec enchère temps réel. Grâce de 5 min sur déco réseau.

### Décisions architecturales validées

- **Facturation** : forfaits fixes (15/30/45/60 min), prix plancher plateforme, créateur peut augmenter
- **Spy** : flux complet lecture seule — rôle subscriber-only LiveKit, même room, uniquement sur STANDARD
- **Queue** : enchère temps réel — `bid_xcon` bloqué au wallet à l'entrée, re-tri dynamique par bid décroissant
- **Déco créateur** : distinguer volontaire (bouton Stop → flag `ended_voluntarily`) vs involontaire (signal LiveKit → grâce 5 min via Redis, timer session en pause)
- **Live public pendant priv'** : room reste ouverte, flux vidéo coupé côté frontend + flou CSS Canvas sur dernière frame + message incitatif "en session privée"
- **Remboursement** : prorata minutes non consommées (hors temps de grâce)

| Étape | Description | Statut |
|---|---|---|
| 5.1 | Migration 0026 — `private_shows`, `private_show_queue`, `private_show_spies`, `private_show_prices`, platform_config | ✅ Terminé |
| 5.2 | Backend routes `/private-shows` — CRUD, queue, spy, webhook LiveKit, grâce Redis | ✅ Terminé |
| 5.3 | LiveKit — tokens par rôle (publisher / subscriber-only), gestion room | ✅ Terminé |
| 5.4 | Frontend créateur — config prix, panneau queue, session active, flou live public | ✅ Terminé |
| 5.5 | Frontend fan — demande + enchère, show interface, spy interface, grâce UI | ✅ Terminé |
| 5.6 | Admin — minimums par tranche/type, logs sessions, remboursements | ✅ Terminé |

---

## PHASE 6 — Overlay Lovense interactif + Paliers imposés plateforme

> Fusion gifts + tips jouet. Paliers plateforme (anti-abus). Overlay activé par défaut, toggle par utilisateur.
> Nettoyage données éphémères (chat, queue) à fin de stream. Persistance DB pour sessions jouet.

### Décisions architecturales

- **Paliers imposés par plateforme** — ADMIN configure une seule fois, tous les créateurs utilisent les mêmes seuils (évite les abus)
- **Fusion gifts + tips jouet** — un seul système : fan envoie tip → débite wallet + vibre si jouet actif
- **Overlay activé par défaut, toggle par utilisateur** — fans et créateurs peuvent masquer via localStorage
- **Stockage sessions jouet en DB** — remplace Map mémoire pour persistance au redémarrage serveur
- **Nettoyage éphémère à fin de stream** — messages chat + file d'attente jouets supprimés, transactions/tips conservés en audit trail
- **Redis pour queue temps réel** — ordre FIFO garanti, métadonnées en DB pour historique

| Étape | Description | Statut |
|---|---|---|
| 6.1 | Migration 025 — `toy_sessions`, `toy_paliers_versions`, paliers plateforme dans `platform_config` | ✅ Terminé |
| 6.2 | Migration 028 — `toy_tip_queue`, `user_overlay_preferences`, `toy_tip_history` (audit) | ✅ Terminé |
| 6.3 | Backend : ToyConfigService (récupère paliers depuis DB + cache) | ✅ Terminé |
| 6.4 | Backend : fusionner `/toy-control/tip` avec système gifts (broadcast + vibration) | ✅ Terminé |
| 6.5 | Backend : job nettoyage stream (Redis queue + messages chat à fin de stream) | ✅ Terminé |
| 6.6 | Backend API : endpoints CRUD paliers admin (`POST /admin/toy-paliers`) | ✅ Terminé |
| 6.7 | Fix WebSocket créateur jouets — connecter et recevoir `TOY_VIBRATE` | ✅ Terminé |
| 6.8 | Overlay créateur — affichage queue + derniers tippers + toggle sur `createur/live/page.tsx` | ✅ Terminé |
| 6.9 | Overlay fan — grille paliers + boutons tip rapide + toggle sur `direct/[id]/live-viewer-client.tsx` | ✅ Terminé |
| 6.10 | Admin panel — gestion paliers (CRUD, historique versions, tests) | ✅ Terminé |

---

## PHASE 6b — Stream Goals & Finalization (BONUS)

> Défis créateur pendant un live. Fans tippent vers l'objectif. Finalization atomique 80/20.
> Architecture ledger pour performance (N tips = 1 paiement final).

### Décisions architecturales validées

- **Un seul goal actif** — créateur peut en créer plusieurs séquentiellement pendant le stream
- **Ledger buffer** — accumule TOUS les tips d'un stream, finalisation à fin du stream (80% créateur, 20% plateforme)
- **Édition/Suppression** — locked dès qu'un tip reçu (can_edit/can_delete flags)
- **Completion animation** — pulse + "Objectif atteint!" 5 secondes
- **Last & Top Tipper** — affichage sur overlay créateur + fan

| Étape | Description | Statut |
|---|---|---|
| 6b.1 | Migration 029 — `stream_goals`, `stream_ledger`, `stream_finalization_log`, `stream_tip_stats` | ✅ Terminé |
| 6b.2 | Service StreamFinalizationService (atomique 80/20 + audit trail) | ✅ Terminé |
| 6b.3 | Routes CRUD goals (`POST`, `PATCH`, `DELETE`, `GET`, `POST /tip`) | ✅ Terminé |
| 6b.4 | Intégration live.js — appel finalizeStreamPayments à END | ✅ Terminé |
| 6b.5 | Composant GoalOverlay (barre progress + texte + tippers) | ✅ Terminé |
| 6b.6 | Modal création goal + gestion sur `createur/live/page.tsx` | ✅ Terminé |
| 6b.7 | Affichage goal + polling sur `direct/[id]/live-viewer-client.tsx` | ✅ Terminé |

---

## Migrations SQL prévues

| Numéro | Description | Statut |
|---|---|---|
| `0016` | Commission configurable + bonus bienvenue (`platform_config`) | ✅ Terminé |
| `0017` | Table de conversion devises (exchange_rates) | ✅ Terminé |
| `0018` | Vue unique messagerie (`view_once` + `view_once_opened_at` sur messages) | ✅ Terminé |
| `0019` | Albums + album_items + album_purchases | ✅ Terminé |
| `0020` | Fan Club multi-niveaux (`fan_club_tiers` + extension `subscriptions`) | ✅ Terminé |
| `0021` | Private Chat sessions + forfaits | ✅ Terminé |
| `0022` | VIP Shows | ✅ Terminé |
| `0023` | Custom requests | ✅ Terminé |
| `0024` | Snapshots payants | ✅ Terminé |
| `025` | Toy control sessions : `toy_sessions`, `toy_paliers_versions`, paliers plateforme | ⏳ À faire |
| `026` | Private Shows (vidéo LiveKit) — sessions, queue enchère, spy, prix créateur | ✅ Terminé |
| `027` | Messages unread (unread count) | ✅ Terminé |
| `028` | Toy queue & overlay prefs : `toy_tip_queue`, `user_overlay_preferences`, `toy_tip_history` | ✅ Terminé |
| `029` | Stream goals & ledger : `stream_goals`, `stream_ledger`, `stream_finalization_log`, `stream_tip_stats` | ✅ Terminé |

---

## Légende statuts
- ⏳ À faire
- 🔄 En cours
- ✅ Terminé
- ❌ Bloqué (raison à documenter)

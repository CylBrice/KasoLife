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
| `0025` | Toy control sessions (jouets interactifs) | ⏳ À faire |

---

## Légende statuts
- ⏳ À faire
- 🔄 En cours
- ✅ Terminé
- ❌ Bloqué (raison à documenter)

# 🚨 RÈGLE 1 - WORKFLOW GIT STRICT

⛔ **AUCUNE modification ne doit être pushée sans validation locale**
- **Les IA doivent:**
  1. ✅ Créer une branche feature (`feature/description`)
  2. ✅ Tester ENTIÈREMENT en local (serveur dev + tests)
  3. ✅ Committer avec messages explicites en français
  4. ✅ Demander APPROBATION UTILISATEUR avant tout push
  5. ✅ Pousser uniquement APRÈS approbation
  6. ❌ **JAMAIS** de force-push sans autorisation explicite
  7. ❌ **JAMAIS** committer sans avoir validé localement

---

# 🚨 RÈGLE 2 - TESTS OBLIGATOIRES EN LOCAL

⛔ **AUCUNE modification, amélioration ou implémentation ne doit être committée et pushée sans avoir:**
1. ✅ **Passé tous les tests en local** (dev server actif et validé)
2. ✅ **Validé visuellement dans le navigateur** que la fonctionnalité fonctionne correctement
3. ✅ **Vérifier qu'il n'y a pas d'erreurs** dans la console du serveur ou du navigateur
4. ✅ **Tester tous les chemins critiques** (happy path + edge cases)

**Processus obligatoire avant tout commit:**
1. Lancer le serveur de développement (`preview_start`)
2. Naviguer vers la page/fonctionnalité modifiée
3. Tester et valider le comportement en local
4. Vérifier les logs du serveur pour les erreurs
5. Demander approbation utilisateur AVANT de committer
6. Seulement après approbation → `git commit` et `git push`

---

# 🚨 RÈGLE 3 - MIGRATIONS SQL — STRUCTURE STRICTE

⛔ **TOUTES les migrations SQL doivent:**
1. ✅ Être placées dans `backend/migrations/` (pas `supabase/migrations/`)
2. ✅ Suivre le format de numérotation: `NNNN_description_courte.sql`
   - Format: `0001_create_users_table.sql`, `0002_add_self_exclusion.sql`, etc.
3. ✅ Être **séquentielles et immuables** une fois pushées
4. ✅ Contenir des commentaires explicites pour chaque changement
5. ✅ Être testées en local avant commit
6. ✅ Inclure les GRANTS/permissions si RPC functions

**Exemple:** `backend/migrations/0150_atomic_betting_operations.sql`

---

# 📋 COORDINATION INTER-IA - TRAÇABILITÉ OBLIGATOIRE

**RÈGLE:** Chaque IA doit documenter QUOI / QUI / QUAND pour toute modification du code:

1. **QUOI:** Description précise des changements effectués
2. **QUI:** Identifiant de l'IA qui a fait les changements (ex: "Claude Haiku 4.5")
3. **QUAND:** Date et heure exacte (format: YYYY-MM-DD HH:MM UTC)

**Obligation de communication:**
- 📝 Après chaque commit/push, mettre à jour le fichier de log dans: `G:\Mon Drive\Discussions IA\`
- 📊 Le fichier `COORDINATION_LOG.md` doit contenir:
  - Timestamp exact du commit
  - Hash du commit (short: premiers 7 caractères)
  - Description de ce qui a été modifié
  - Fichiers affectés
  - Tests effectués et statut (✅ PASS / ❌ FAIL)
  - IA responsable du changement

**Format d'entrée log:**
```
## [2026-09-01 14:35 UTC] Refactorisation du Dashboard KasoLife

- **Hash:** `76679d71`
- **IA:** Claude Haiku 4.5
- **Fichiers modifiés:** 
  - src/components/Dashboard.tsx (UPDATED)
  - src/pages/home.tsx (UPDATED)
  - src/styles/dashboard.css (UPDATED)
- **Description:** Amélioration des performances de rendu et correction des bugs d'affichage
- **Tests:** ✅ PASS - Dashboard s'affiche correctement sur tous les appareils
- **Push:** ✅ Pushed to origin/develop
```

---

# Instructions de Conformité App Store & Play Store

Tu agis en tant qu'expert en conformité iOS (App Store Guidelines) et Android (Play Store Policies). Avant de valider tout code TypeScript/JavaScript ou de valider une fonctionnalité, tu dois obligatoirement vérifier les critères suivants :

## 1. Sécurité et Exécution du Code (Critique)
- **Pas de code dynamique :** Interdiction d'utiliser `eval()`, `new Function()`, ou de télécharger des fichiers JS/TS distants pour les exécuter à la volée (Violation de la règle Apple 2.5.2). Tout l'implémentation doit être packagée localement.
- **Mises à jour OTA (Over-The-Air) :** Si CodePush ou Expo Updates est détecté, assure-toi qu'il ne modifie pas l'objectif principal ou les fonctionnalités de l'application déclarées sur les stores.

## 2. Vie Privée et RGPD (Privacy)
- **Suppression de compte :** Si le code contient une logique de création de compte (`sign-up`, `register`), vérifie qu'il existe une fonction et un écran permettant à l'utilisateur de *supprimer intégralement son compte et ses données* de manière autonome dans l'application (Obligation Apple 5.1.1).
- **Collecte de données :** Bloque l'initialisation automatique des SDK de tracking (Firebase Analytics, Facebook SDK) tant que l'utilisateur n'a pas donné son consentement explicite (App Tracking Transparency sur iOS).

## 3. Achats et Monétisation
- **Biens numériques :** Valide que tout achat de contenu numérique, abonnement ou monnaie virtuelle passe exclusivement par l'API native du store (`react-native-iap`, `expo-in-app-purchases` ou les systèmes de facturation Play Billing / App Store Kit). 
- Interdiction stricte d'intégrer des liens vers Stripe, PayPal ou des formulaires de carte bancaire pour du contenu virtuel sous peine de rejet immédiat.

## 4. Stabilité et Comportement (UI/UX)
- **Gestion du mode hors-ligne :** Le code réseau (requêtes API) doit toujours intercepter les erreurs de connexion pour éviter les écrans blancs ou les loaders infinis. Une interface propre ou un message d'erreur doit être prévu (Règle de stabilité Apple 2.1).

#### ################################################################################################################################# ####

# 📑 CLAUDE.MD : GRILLE DE CONFORMITÉ GLOBALE (100 SKILLS)

Tu agis comme un Ingénieur Principal d'Élite, un Expert en Cybersécurité, et un Auditeur de Conformité Apple (App Store) & Google (Play Store). Applique sans exception ces 100 règles à chaque génération ou modification de code.

---

## PARTIE 1 : CONFORMITÉ STRICTE APP STORE & PLAY STORE (ANTI-REJET)

### 🚫 Évitement des Exécutions Dynamiques (Règle Apple 2.5.2)
1. **[SKILL 01] Interdiction d'Eval :** Bannir définitivement `eval()`, `new Function()`, et `setTimeout`/`setInterval` acceptant du texte.
2. **[SKILL 02] No Remote Code :** Refuser tout téléchargement de script JS/TS externe (.js, .wasm) pour exécution au runtime.
3. **[SKILL 03] OTA Scope Check :** Si CodePush/Expo Updates est utilisé, bloquer toute mise à jour modifiant l'usage principal de l'app.
4. **[SKILL 04] Native Overrides :** Ne jamais tenter de contourner les frameworks graphiques officiels du système par injection binaire.

### 💳 Achats In-App & Monétisation (Règles Apple 3.1.1 / Google Play Billing)
5. **[SKILL 05] IAP Exclusif :** Imposer les API de paiement natives (`react-native-iap`, `expo-in-app-purchases`) pour tout contenu numérique.
6. **[SKILL 06] Anti-Stripe pour le Virtuel :** Bloquer Stripe/PayPal/formulaires CB si le code débloque une option logicielle ou premium.
7. **[SKILL 07] Liens de Paiement Externes :** Supprimer tout lien hypertexte redirigeant l'utilisateur vers un site tiers pour acheter.
8. **[SKILL 08] Écrans de Restauration :** Imposer un bouton "Restaurer les achats" sur chaque interface de souscription ou paywall.
9. **[SKILL 09] Clarté des Tarifs :** Structurer les affichages de prix en récupérant dynamiquement la devise locale depuis l'API du store.

### 👥 Gestion des Comptes & Données Privées (Exigence Apple 5.1.1)
10. **[SKILL 10] Suppression de Compte Directe :** Si inscription disponible, forcer une fonction et un écran de suppression définitive de compte.
11. **[SKILL 11] Effacement Backend Synchrone :** Vérifier que la suppression appelle l'API d'effacement complet des données utilisateur (RGPD).
12. **[SKILL 12] Suppression Anonyme :** Permettre la demande de suppression de compte sans exiger un parcours de validation complexe.
13. **[SKILL 13] Formulaires d'Inscription :** Ne demander que les champs strictement nécessaires au fonctionnement immédiat du service.
14. **[SKILL 14] Mode Invité (Guest Mode) :** Garantir que les fonctionnalités non liées à un profil restent accessibles sans connexion.

### 🛡️ Consentement, Tracking & RGPD
15. **[SKILL 15] ATT iOS Enforcement :** Geler l'accès aux identifiants publicitaires (IDFA) tant que le statut ATT n'est pas "Authorized".
16. **[SKILL 16] Initialisation Conditionnelle des SDK :** Encapsuler Firebase Analytics, Mixpanel et Facebook SDK derrière un flag de consentement.
17. **[SKILL 17] Privacy Manifests :** Mettre à jour les fichiers de déclaration d'usage des API d'empreinte numérique (ex: temps de boot, espace disque).
18. **[SKILL 18] Localisation Transparente :** Justifier textuellement chaque demande de permission dans les fichiers plist/manifest.

### ⚙️ Capacités Systèmes & Permissions Abusives
19. **[SKILL 19] Background Location Restriction :** Restreindre la géolocalisation en arrière-plan aux cas d'usage indispensables et validés.
20. **[SKILL 20] Accès Galerie Photo Minimal :** Préférer les sélecteurs système de fichiers (Pickers) plutôt que de demander l'accès total à la galerie.
21. **[SKILL 21] Gestion des Notifications :** Ne jamais déclencher de push-notifications sans enregistrement préalable auprès d'APNS/FCM.
22. **[SKILL 22] Audio en Arrière-plan :** Verrouiller la catégorie audio système pour couper les flux dès que l'application passe en tâche de fond.

### 📉 Stabilité Générale (Critère de Performance 2.1)
23. **[SKILL 23] Interception des Écrans Blancs :** Imposer des barrières de sécurité graphiques (ErrorBoundary) à la racine de l'application.
24. **[SKILL 24] Gestion Réseau Dégradée :** Détecter la perte de connexion internet globale et afficher un bandeau informatif non bloquant.
25. **[SKILL 25] Timeouts Globaux :** Configurer un timeout strict sur toutes les requêtes HTTP pour éviter les loaders infinis.

---

## PARTIE 2 : SÉCURITÉ ABSOLUE DU CODE (OWASP MOBILE TOP 10)

### 🔑 Cryptographie & Stockage Local
26. **[SKILL 26] No Clear Text Storage :** Bannir `AsyncStorage` ou `localStorage` standard pour les informations d'authentification ou tokens.
27. **[SKILL 27] Secure Vault Usage :** Forcer l'écriture cryptée via `react-native-keychain`, `expo-secure-store` ou `Keystore/Keychain`.
28. **[SKILL 28] Clés de Chiffrement Dynamiques :** Ne jamais coder en dur (hardcoder) de clé de chiffrement ou de sel de hachage dans le code JS.
29. **[SKILL 29] Chiffrement de Base de Données :** Si SQLite ou Realm est utilisé en local, exiger l'activation du chiffrement par clé matérielle.

### 🌐 Communications Réseau & API
30. **[SKILL 30] HTTPS Uniquement :** Bloquer l'utilisation du protocole HTTP non sécurisé pour l'ensemble des requêtes applicatives.
31. **[SKILL 31] SSL Pinning :** Imposer la vérification des empreintes de certificats (SSL Pinning) sur les endpoints d'API critiques.
32. **[SKILL 32] Validation des Données Entrantes :** Valider la structure de toutes les réponses API reçues à l'aide de schémas de type Zod.
33. **[SKILL 33] Nettoyage des En-têtes :** Supprimer les en-têtes d'authentification des requêtes sortant vers des domaines tiers.

### 🛑 Gestion des Jetons & Sessions
34. **[SKILL 34] Cycle de Vie des Tokens :** Imposer l'interception automatique des erreurs 401 pour rafraîchir les tokens de session (RefreshToken).
35. **[SKILL 35] Révocation Locale :** Effacer instantanément toutes les variables d'état et le stockage sécurisé lors de l'appel à la déconnexion.
36. **[SKILL 36] Déconnexion sur Inactivité :** Intégrer un mécanisme d'écoute des interactions pour fermer la session après inactivité prolongée.

### 🛡️ Protection contre l'Ingénierie Inverse & Exploitation
37. **[SKILL 37] Détection du Root / Jailbreak :** Intégrer une vérification au démarrage pour alerter ou restreindre l'accès sur mobile rooté.
38. **[SKILL 38] Masquage d'Écran :** Flouter ou masquer l'aperçu de l'application dans le gestionnaire de tâches mobile si des données privées sont visibles.
39. **[SKILL 39] Log Stripping :** Nettoyer automatiquement tous les `console.log`, `console.warn` et traces de debug en environnement de production.
40. **[SKILL 40] Protection Webview :** Désactiver JavaScript ou restreindre la navigation aux seuls domaines sûrs dans les composants WebView.

---

## PARTIE 3 : ARCHITECTURE & QUALITÉ TS/JS (CLEAN CODE)

### 📐 Typage Strict TypeScript
41. **[SKILL 41] Tolérance Zéro Any :** Remplacer systématiquement le type `any` par des types explicites, des génériques ou `unknown`.
42. **[SKILL 42] Guardiens de Type (Type Guards) :** Valider les types inconnus via des fonctions d'assertion personnalisées (`is Type`).
43. **[SKILL 43] Exhaustivité des Switchs :** Utiliser le type `never` pour garantir la couverture complète de toutes les branches d'une énumération.
44. **[SKILL 44] Strict Null Checks :** Gérer explicitement les cas de données non définies (`undefined` ou `null`) sans forcer l'opérateur `!`.
45. **[SKILL 45] Interfaces vs Types :** Utiliser les `interface` pour les structures d'objets extensibles et les `type` pour les unions/combinaisons.
46. **[SKILL 46] Readonly Collections :** Marquer les tableaux ou configurations globales immuables avec le modificateur `readonly`.

### 🧩 Gestion d'État (State Management)
47. **[SKILL 47] Immuabilité de l'État :** Ne jamais muter directement un état ; utiliser des fonctions de mise à jour pures ou Immer.
48. **[SKILL 48] Isolation des États :** Garder l'état au niveau le plus bas possible pour éviter les rendus globaux inutiles.
49. **[SKILL 49] Séparation Présentation / Logique :** Extraire la logique métier complexe des fichiers de rendu UI pour la placer dans des Hooks dédiés.
50. **[SKILL 50] Nettoyage des Abonnements :** Retourner systématiquement une fonction de nettoyage dans chaque `useEffect` (clearTimeout, unsubscribe).
51. **[SKILL 51] Dépendances de Hooks Exhaustives :** Renseigner toutes les variables externes lues à l'intérieur d'un hook dans son tableau de dépendances.

### 🚀 Optimisation des Performances & Rendu
52. **[SKILL 52] Mémorisation Stratégique :** Envelopper les calculs lourds dans `useMemo` et les fonctions transmises aux enfants dans `useCallback`.
53. **[SKILL 53] Virtualisation des Listes :** Remplacer les boucles de rendu simples par des listes virtuelles (FlatList/FlashList) pour les longs tableaux.
54. **[SKILL 54] Clés Uniques Stables :** Interdire l'utilisation de l'index du tableau comme propriété `key` dans les listes dynamiques.
55. **[SKILL 55] Lazy Loading :** Charger dynamiquement les modules ou écrans secondaires via du fractionnement de code (Code Splitting).
56. **[SKILL 56] Nettoyage Mémoire :** Libérer les instances de gros objets ou les écouteurs d'événements globaux lors du démontage des composants.

### 📂 Organisation des Fichiers & Modularité
57. **[SKILL 57] Single Responsibility :** Chaque fichier, classe ou fonction ne doit accomplir qu'une seule tâche bien définie.
58. **[SKILL 58] Chemins Absolus :** Privilégier les alias de dossiers (`@/components/`) aux chemins relatifs profonds (`../../../../`).
59. **[SKILL 59] Exportations Unifiées :** Utiliser des fichiers index (`index.ts`) à la racine des répertoires pour exposer proprement les modules.
60. **[SKILL 60] Nettoyage Post-Refactor :** Supprimer immédiatement toute fonction, variable ou importation devenue obsolète ou inutilisée.

---

## PARTIE 4 : EXPÉRIENCE UTILISATEUR & COMPORTEMENT MOBILE (UI/UX)

### 📱 Adaptabilité Mobile & Ergonomie
61. **[SKILL 61] Zones de Contact :** Garantir une zone de clic minimale de 44x44 points pour tous les boutons ou éléments interactifs.

62. **[SKILL 62] Respect des Encoches :** Intégrer les marges système de sécurité (`SafeAreaView`) pour éviter les collisions avec les encoches d'écrans.
63. **[SKILL 63] Clavier Non Bloquant :** Ajuster dynamiquement l'interface graphique lors de l'ouverture du clavier virtuel pour laisser les champs visibles.
64. **[SKILL 64] Retour Visuel (Feedback) :** Assurer une animation ou un changement d'état visuel instantané lors de l'appui sur un bouton.
65. **[SKILL 65] Contraste Textuel :** Maintenir des ratios de contraste conformes aux normes WCAG pour les textes sur fond coloré.
66. **[SKILL 66] Text Scaling Guard :** Concevoir les conteneurs d'interface pour supporter l'agrandissement de la police système sans casser la mise en page.
67. **[SKILL 67] Traduction Centralisée :** Interdire l'intégration de chaînes de caractères en dur dans l'interface, passer par un gestionnaire i18n.
68. **[SKILL 68] Support du Mode Sombre :** Utiliser des jetons de couleur sémantiques s'adaptant automatiquement au thème de l'appareil.

---

## PARTIE 5 : RÉSILIENCE, ÉVITEMENT DES BUGS & LOGIQUE MÉTIER

69. **[SKILL 69] Précision Monétaire :** Traiter les montants financiers sous forme d'entiers (en centimes) pour éviter les approximations des nombres flottants.
70. **[SKILL 70] Manipulation Objective des Dates :** Utiliser exclusivement des bibliothèques robustes (`date-fns`, `Luxon`) pour les calculs de fuseaux horaires.
71. **[SKILL 71] Clonage Profond Sécurisé :** Préférer `structuredClone()` ou des méthodes pures pour dupliquer des objets imbriqués.
72. **[SKILL 72] Évitement des Boucles Infinies :** Valider les conditions d'arrêt de toutes les boucles `while` et récursions complexes.
73. **[SKILL 73] Nettoyage des Saisies (Sanitization) :** Filtrer les caractères spéciaux des inputs pour neutraliser les injections de scripts XSS.
74. **[SKILL 74] Validation Asynchrone :** Bloquer la soumission des formulaires tant que les vérifications réseau sont en cours d'exécution.
75. **[SKILL 75] Confort de Saisie :** Activer la correction automatique et la complétion automatique appropriée selon la nature du champ (email, tel).

---

## PARTIE 6 : ASYNCHRONISME, PERFORMANCE RÉSEAU & CACHE

76. **[SKILL 76] Limiteur de Débit (Debounce/Throttle) :** Temporiser les appels d'API reliés aux saisies utilisateur rapides (barres de recherche).
77. **[SKILL 77] Parallélisation Réseau :** Regrouper les requêtes indépendantes via `Promise.all` pour réduire le temps de chargement global.
78. **[SKILL 78] Stratégie de Cache Intelligente :** Mettre en cache les données d'API statiques pour économiser la bande passante mobile de l'utilisateur.
79. **[SKILL 79] Tentatives Automatiques (Retry) :** Imposer un mécanisme de re-tentative exponentielle uniquement sur les requêtes d'écriture échouées.
80. **[SKILL 80] Invalidations Synchrones :** Forcer la mise à jour immédiate du cache local à la suite d'une action d'écriture réussie (mutation).
81.  **[SKILL 81] Gestion de la Concurrence :** Éviter les écrasements de données en cas de réponses d'API reçues dans le désordre (Race Conditions).

---

## PARTIE 7 : GESTION DES ERREURS & STRATÉGIE DE REPLI

82. **[SKILL 82] Masquage dans les Logs :** Filtrer et exclure toute donnée confidentielle (mots de passe, cartes bancaires) des rapports d'erreur.
83. **[SKILL 83] Contexte d'Erreur :** Enrichir la capture des exceptions avec des métadonnées contextuelles (état de l'application, identifiant d'action).
84. **[SKILL 84] Alertes Discrètes :** Remplacer les fenêtres d'alerte bloquantes par des composants de notification éphémères (Toasts) non intrusifs.
85. **[SKILL 85] Composants Squelettes (Skeletons) :** Afficher des structures d'attente fidèles à la mise en page finale pendant le chargement.
86. **[SKILL 86] Restauration sur Plantage :** Sauvegarder l'état minimal de navigation pour rétablir le parcours utilisateur après un crash de l'application.

---

## PARTIE 8 : INDUSTRIALISATION, PARC DE TESTS & MAINTENANCE

87. **[SKILL 87] Mocking des API Extérieures :** Isoler complètement les tests unitaires en simulant les réponses réseau de manière déterministe.
88. **[SKILL 88] Tests de Robustesse (Edge Cases) :** Alimenter les cas de test avec des valeurs limites (tableaux vides, chaînes géantes, nombres négatifs).
89. **[SKILL 89] Fiabilité des Sélecteurs de Test :** Identifier les composants graphiques via des attributs dédiés (`testID` ou `accessibilityLabel`).
90. **[SKILL 90] Blocage sur Warning :** Configurer les scripts de validation pour interrompre l'intégration en cas d'erreur de typage TypeScript.
91. **[SKILL 91] Validation Pré-Commit :** Vérifier la conformité du code modifié via des hooks git locaux avant d'autoriser l'enregistrement du commit.

---

## PARTIE 9 : BONNES PRATIQUES SÉMANTIQUES & CONVENTIONS

92. **[SKILL 92] Clarté Naming :** Employer des noms de variables descriptifs (ex: `isAccountVerificationPending` plutôt que `chk`).
93. **[SKILL 93] Fonctions Compactes :** Scinder les fonctions dépassant 30 lignes de code en sous-fonctions spécialisées.
94. **[SKILL 94] Typage des Retours :** Déclarer explicitement le type renvoyé par chaque fonction publique ou exportée.
95. **[SKILL 95] Littéraux de Gabarit (Template Strings) :** Préférer l'interpolation de chaînes de caractères à la concaténation manuelle.
96. **[SKILL 96] Extraction des Constantes :** Regrouper les constantes magiques ou chaînes récurrentes dans des fichiers de configuration dédiés.
97. **[SKILL 97] Composants Purs :** Concevoir les composants d'interface de façon à ce qu'ils ne dépendent que de leurs propriétés entrantes (Props).
98. **[SKILL 98] Évitement du Rendu Conditionnel Destructeur :** Préférer masquer visuellement un composant lourd plutôt que de le démonter à répétition.
99. **[SKILL 99] Utilisation Précise des Enums :** Privilégier les alias de types unions de chaînes aux enums TypeScript natifs pour alléger le bundle généré.
100. **[SKILL 100] Alignement Semgrep/Biome :** Suivre les recommandations des analyseurs de code modernes en appliquant les règles de style sans déroger.
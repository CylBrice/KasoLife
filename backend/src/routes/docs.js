// ============================================================
// KASOLIFE — Route /docs — Documentation API Swagger UI
// ============================================================
const express = require('express');
const router  = express.Router();

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'KASOLIFE API',
    version: '1.0.0',
    description: "API REST de la plateforme de créateurs de contenu KASOLIFE (catégories safe). Devise : xcon (1 xcon = 1 FCFA).",
    contact: { name: 'KasoLife Support', email: 'support@kasolife.com' },
  },
  servers: [
    { url: process.env.BACKEND_URL || 'https://api.kasolife.com', description: 'Production' },
    { url: 'http://localhost:3003', description: 'Développement local' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error:   { type: 'object', properties: { error: { type: 'string' } } },
      Success: { type: 'object', properties: { message: { type: 'string' } } },
      User: {
        type: 'object',
        properties: {
          id:          { type: 'string', format: 'uuid' },
          pseudo:      { type: 'string', example: 'CreatorKM' },
          role:        { type: 'string', enum: ['user', 'influencer', 'admin', 'super_admin', 'root_admin'] },
          country_iso: { type: 'string', example: 'CM' },
          language:    { type: 'string', enum: ['fr', 'en'] },
          kyc_status:  { type: 'string', enum: ['PENDING', 'VERIFIED', 'FAILED', 'SUPPORT'] },
        },
      },
      Wallet: {
        type: 'object',
        properties: {
          balance_xcon:         { type: 'integer', example: 5000 },
          pending_balance_xcon: { type: 'integer', example: 12000, description: 'Revenus créateur en attente de déblocage' },
          total_deposited:      { type: 'integer' },
          total_withdrawn:      { type: 'integer' },
          total_earned:         { type: 'integer' },
        },
      },
      CreatorProfile: {
        type: 'object',
        properties: {
          display_name:            { type: 'string', example: 'Coach Fitness CM' },
          subscription_price_xcon: { type: 'integer', example: 2000 },
          subscribers_count:       { type: 'integer' },
          posts_count:             { type: 'integer' },
          is_verified_badge:       { type: 'boolean' },
        },
      },
      Post: {
        type: 'object',
        properties: {
          id:             { type: 'string', format: 'uuid' },
          creator_id:     { type: 'string', format: 'uuid' },
          caption:        { type: 'string' },
          media_type:     { type: 'string', enum: ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO'] },
          access_level:   { type: 'string', enum: ['FREE', 'SUBSCRIBERS', 'PPV'] },
          price_xcon:     { type: 'integer', example: 1000 },
          likes_count:    { type: 'integer' },
          comments_count: { type: 'integer' },
          has_access:     { type: 'boolean' },
        },
      },
      Subscription: {
        type: 'object',
        properties: {
          id:                 { type: 'string', format: 'uuid' },
          price_xcon:         { type: 'integer' },
          status:             { type: 'string', enum: ['ACTIVE', 'CANCELLED', 'EXPIRED', 'PAST_DUE'] },
          current_period_end: { type: 'string', format: 'date-time' },
          auto_renew:         { type: 'boolean' },
        },
      },
    },
  },
  tags: [
    { name: 'Auth',          description: 'Inscription, connexion, sécurité du compte' },
    { name: 'Wallet',        description: 'Dépôts, retraits, historique' },
    { name: 'Créateurs',     description: 'Découverte, candidatures, profils publics' },
    { name: 'Contenu',       description: 'Posts, likes, commentaires, achats PPV' },
    { name: 'Abonnements',   description: 'Souscription et gestion des abonnements créateur' },
    { name: 'Messages',      description: 'Messagerie privée et pourboires' },
    { name: 'Retraits',      description: 'Demandes de retrait des revenus créateur' },
    { name: 'KYC',           description: "Vérification d'identité (requise pour devenir créateur)" },
    { name: 'Admin',         description: 'Modération et gestion de la plateforme' },
  ],
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'], summary: 'Créer un compte',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['phone', 'pseudo', 'name', 'password', 'country_iso', 'birth_date'], properties: {
          phone: { type: 'string', example: '+237690000000' }, pseudo: { type: 'string' }, name: { type: 'string' },
          password: { type: 'string', minLength: 8 }, country_iso: { type: 'string', example: 'CM' },
          birth_date: { type: 'string', format: 'date' }, ref: { type: 'string', description: 'Code de parrainage (optionnel)' },
        } } } } },
        responses: { '201': { description: 'Compte créé' }, '400': { description: 'Erreur de validation', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Se connecter',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['phone', 'password'], properties: { phone: { type: 'string' }, password: { type: 'string' } } } } } },
        responses: { '200': { description: 'Connexion réussie' }, '401': { description: 'Identifiants incorrects' } },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'], summary: "Profil de l'utilisateur connecté", security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Profil utilisateur', content: { 'application/json': { schema: { allOf: [{ '$ref': '#/components/schemas/User' }, { type: 'object', properties: { wallet: { '$ref': '#/components/schemas/Wallet' }, creator_profile: { '$ref': '#/components/schemas/CreatorProfile' } } }] } } } } },
      },
    },
    '/creators': {
      get: {
        tags: ['Créateurs'], summary: 'Découverte des créateurs',
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Slug de catégorie' },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['recent', 'popular', 'price_asc', 'price_desc'] } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { '200': { description: 'Liste paginée des créateurs' } },
      },
    },
    '/creators/{pseudo}': {
      get: {
        tags: ['Créateurs'], summary: "Profil public d'un créateur",
        parameters: [{ name: 'pseudo', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Profil créateur' }, '404': { description: 'Créateur introuvable' } },
      },
    },
    '/creators/apply': {
      post: {
        tags: ['Créateurs'], summary: 'Candidater pour devenir créateur (KYC vérifié requis)', security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['category_id', 'display_name'], properties: {
          category_id: { type: 'string', format: 'uuid' }, display_name: { type: 'string' },
          motivation: { type: 'string' }, subscription_price_xcon: { type: 'integer', example: 2000 },
        } } } } },
        responses: { '201': { description: 'Candidature envoyée' }, '403': { description: 'KYC requis' } },
      },
    },
    '/posts/feed': {
      get: {
        tags: ['Contenu'], summary: 'Fil de contenu (découverte)',
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { '200': { description: 'Liste paginée de posts', content: { 'application/json': { schema: { type: 'object', properties: { posts: { type: 'array', items: { '$ref': '#/components/schemas/Post' } } } } } } } },
      },
    },
    '/posts': {
      post: {
        tags: ['Contenu'], summary: 'Publier un post (créateur)', security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['media_type', 'access_level'], properties: {
          caption: { type: 'string' }, media_type: { type: 'string', enum: ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO'] },
          media_url: { type: 'string' }, thumbnail_url: { type: 'string' },
          access_level: { type: 'string', enum: ['FREE', 'SUBSCRIBERS', 'PPV'] }, price_xcon: { type: 'integer' },
        } } } } },
        responses: { '201': { description: 'Post publié' } },
      },
    },
    '/posts/{id}/purchase': {
      post: {
        tags: ['Contenu'], summary: "Acheter un contenu payant à l'unité (PPV)", security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Achat réussi' }, '402': { description: 'Solde insuffisant' }, '409': { description: 'Déjà acheté' } },
      },
    },
    '/subscriptions/{creatorId}': {
      post: {
        tags: ['Abonnements'], summary: "S'abonner à un créateur", security: [{ BearerAuth: [] }],
        parameters: [{ name: 'creatorId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '201': { description: 'Abonnement activé', content: { 'application/json': { schema: { type: 'object', properties: { subscription: { '$ref': '#/components/schemas/Subscription' } } } } } }, '402': { description: 'Solde insuffisant' } },
      },
    },
    '/subscriptions/me': {
      get: {
        tags: ['Abonnements'], summary: 'Mes abonnements actifs', security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Liste des abonnements', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Subscription' } } } } } },
      },
    },
    '/messages/{userId}/tip': {
      post: {
        tags: ['Messages'], summary: 'Envoyer un pourboire à un créateur', security: [{ BearerAuth: [] }],
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['amount_xcon'], properties: { amount_xcon: { type: 'integer', minimum: 100 }, message: { type: 'string' }, post_id: { type: 'string', format: 'uuid' } } } } } },
        responses: { '201': { description: 'Pourboire envoyé' } },
      },
    },
    '/wallet/deposit': {
      post: {
        tags: ['Wallet'], summary: 'Recharger son wallet via Mobile Money', security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['montant_xcon', 'mobile_money_id'], properties: { montant_xcon: { type: 'integer', minimum: 500 }, mobile_money_id: { type: 'string', format: 'uuid' } } } } } },
        responses: { '200': { description: 'URL de paiement générée' } },
      },
    },
    '/payouts': {
      post: {
        tags: ['Retraits'], summary: 'Demander un retrait des revenus créateur (KYC requis)', security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['amount_xcon', 'mobile_money_id'], properties: { amount_xcon: { type: 'integer', minimum: 5000 }, mobile_money_id: { type: 'string', format: 'uuid' } } } } } },
        responses: { '201': { description: 'Demande envoyée — en attente de validation' }, '403': { description: 'KYC requis' } },
      },
    },
    '/kyc/initiate': {
      post: {
        tags: ['KYC'], summary: "Démarrer une session de vérification d'identité (Didit)", security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'URL de vérification' } },
      },
    },
    '/admin/creator-applications': {
      get: {
        tags: ['Admin'], summary: 'Liste des candidatures créateur en attente', security: [{ BearerAuth: [] }],
        parameters: [{ name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'] } }],
        responses: { '200': { description: 'Liste des candidatures' }, '403': { description: 'Accès réservé aux admins' } },
      },
    },
  },
};

// Swagger UI HTML inline
router.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>KasoLife API — Documentation</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" type="text/css" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.css" >
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      spec: ${JSON.stringify(swaggerSpec)},
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "StandaloneLayout",
      deepLinking: true,
    });
  </script>
</body>
</html>`);
});

// Endpoint JSON brut pour intégrations tierces
router.get('/json', (req, res) => res.json(swaggerSpec));

module.exports = router;

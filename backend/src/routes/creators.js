// ============================================================
// KASOLIFE — Routes /creators v1.0
// Candidature créateur, profils publics, découverte par catégorie
// Devenir créateur nécessite KYC_VERIFIED (paiements/retraits sécurisés)
// ============================================================
'use strict';
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authMiddleware, requireKYC, requireMinRole } = require('../middleware/auth');
const { decrypt } = require('../services/encryption');
const {
  SUBSCRIPTION_PRICE_MIN, SUBSCRIPTION_PRICE_MAX,
} = require('../config/constants');
const { suggestSubscriptionPrice } = require('../services/aiModeration');

const router = express.Router();

// ── Helper : décrypte le nom utilisateur en toute sécurité
const safeDecrypt = (val) => { try { return decrypt(val); } catch { return val; } };

// ── GET /creators/categories — liste des catégories actives (public)
router.get('/categories', async (req, res) => {
  try {
    const { data, error } = await supabase.from('categories')
      .select('id, name, slug, description, icon')
      .eq('is_active', true).order('name');
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── GET /creators/price-suggestion?category_id=... — suggestion de prix d'abonnement (IA)
// Utilisable avant candidature (choix du prix de départ) et après (ajustement).
// IMPORTANT : placée avant /:pseudo pour ne pas être capturée par la route catch-all.
router.get('/price-suggestion', authMiddleware, async (req, res) => {
  try {
    const { category_id } = req.query;
    if (!category_id) return res.status(400).json({ error: 'category_id requis' });

    const { data: category } = await supabase.from('categories').select('name').eq('id', category_id).single();
    if (!category) return res.status(404).json({ error: 'Catégorie introuvable' });

    // Récupère les prix des créateurs actifs de la même catégorie (acceptant des abonnés)
    const { data: peers } = await supabase.from('creator_profiles')
      .select('subscription_price_xcon')
      .eq('category_id', category_id)
      .eq('is_accepting_subs', true)
      .limit(200);

    const prices = (peers || []).map((p) => p.subscription_price_xcon).filter((p) => p > 0);
    const suggestion = await suggestSubscriptionPrice({ categoryName: category.name, similarPrices: prices });

    res.json({
      suggested_xcon: suggestion.suggested_xcon,
      basis: suggestion.basis,
      range: { min: SUBSCRIPTION_PRICE_MIN, max: SUBSCRIPTION_PRICE_MAX },
    });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur', details: err.message }); }
});

// ── GET /creators — découverte publique (filtrage par catégorie, recherche)
router.get('/', async (req, res) => {
  try {
    const { category, search, sort = 'recent', page = 1, limit = 20 } = req.query;
    const pageNum  = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const offset   = (pageNum - 1) * pageSize;

    let query = supabase.from('creator_profiles')
      .select(`
        user_id, display_name, subscription_price_xcon, is_verified_badge,
        subscribers_count, posts_count, created_at,
        category:categories(id, name, slug),
        user:users(pseudo, avatar_url, banner_url, bio)
      `, { count: 'exact' })
      .eq('is_accepting_subs', true);

    if (category) {
      const { data: cat } = await supabase.from('categories').select('id').eq('slug', category).single();
      if (cat) query = query.eq('category_id', cat.id);
    }

    if (search) {
      query = query.ilike('display_name', `%${search}%`);
    }

    if (sort === 'popular') query = query.order('subscribers_count', { ascending: false });
    else if (sort === 'price_asc') query = query.order('subscription_price_xcon', { ascending: true });
    else if (sort === 'price_desc') query = query.order('subscription_price_xcon', { ascending: false });
    else query = query.order('created_at', { ascending: false });

    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({
      creators: data || [],
      pagination: { page: pageNum, limit: pageSize, total: count || 0, pages: Math.ceil((count || 0) / pageSize) },
    });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── GET /creators/:pseudo — profil public d'un créateur
router.get('/:pseudo', async (req, res) => {
  try {
    const { pseudo } = req.params;

    const { data: user } = await supabase.from('users')
      .select('id, pseudo, avatar_url, banner_url, bio, role, created_at')
      .ilike('pseudo', pseudo).single();
    if (!user || !['influencer','admin','super_admin','root_admin'].includes(user.role))
      return res.status(404).json({ error: 'Créateur introuvable' });

    const { data: profile } = await supabase.from('creator_profiles')
      .select('*, category:categories(id, name, slug)')
      .eq('user_id', user.id).single();
    if (!profile) return res.status(404).json({ error: 'Profil créateur introuvable' });

    // Vérifier si l'utilisateur courant est abonné (si authentifié)
    let isSubscribed = false;
    let viewerId = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
        viewerId = decoded.userId;
        const { data: sub } = await supabase.from('subscriptions')
          .select('id, status').eq('fan_id', viewerId).eq('creator_id', user.id).eq('status', 'ACTIVE').single();
        isSubscribed = !!sub;
      } catch {}
    }

    res.json({
      id: user.id,
      pseudo: user.pseudo,
      avatar_url: user.avatar_url,
      banner_url: user.banner_url,
      bio: user.bio,
      member_since: user.created_at,
      display_name: profile.display_name,
      category: profile.category,
      subscription_price_xcon: profile.subscription_price_xcon,
      is_verified_badge: profile.is_verified_badge,
      subscribers_count: profile.subscribers_count,
      posts_count: profile.posts_count,
      is_accepting_subs: profile.is_accepting_subs,
      welcome_message: isSubscribed ? profile.welcome_message : undefined,
      is_subscribed: isSubscribed,
      is_own_profile: viewerId === user.id,
    });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /creators/apply — candidature pour devenir créateur (requiert KYC)
router.post('/apply', authMiddleware, requireKYC, async (req, res) => {
  try {
    const { category_id, display_name, motivation, subscription_price_xcon } = req.body;

    if (['influencer','admin','super_admin','root_admin'].includes(req.user.role))
      return res.status(400).json({ error: 'Vous êtes déjà créateur' });

    if (!category_id || !display_name)
      return res.status(400).json({ error: 'Catégorie et nom d\'affichage requis' });

    if (display_name.length < 2 || display_name.length > 100)
      return res.status(400).json({ error: 'Le nom d\'affichage doit contenir entre 2 et 100 caractères' });

    const price = subscription_price_xcon !== undefined ? Number(subscription_price_xcon) : SUBSCRIPTION_PRICE_MIN;
    if (price < SUBSCRIPTION_PRICE_MIN || price > SUBSCRIPTION_PRICE_MAX)
      return res.status(400).json({ error: `Le prix d'abonnement doit être entre ${SUBSCRIPTION_PRICE_MIN} et ${SUBSCRIPTION_PRICE_MAX} FCFA` });

    const { data: cat } = await supabase.from('categories').select('id, is_active').eq('id', category_id).single();
    if (!cat || !cat.is_active) return res.status(400).json({ error: 'Catégorie invalide' });

    // Vérifier candidature en attente existante
    const { data: existing } = await supabase.from('creator_applications')
      .select('id, status').eq('user_id', req.user.id).eq('status', 'PENDING').single();
    if (existing) return res.status(409).json({ error: 'Vous avez déjà une candidature en attente de validation' });

    const { data: application, error } = await supabase.from('creator_applications').insert({
      id: uuidv4(), user_id: req.user.id, category_id, display_name,
      motivation: motivation || null, status: 'PENDING',
    }).select().single();
    if (error) throw error;

    // Stocker le prix souhaité pour création du profil à l'approbation
    await supabase.from('creator_applications').update({
      motivation: JSON.stringify({ text: motivation || '', subscription_price_xcon: price }),
    }).eq('id', application.id);

    res.status(201).json({
      message: 'Candidature envoyée — en attente de validation par un administrateur',
      application_id: application.id,
    });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur', details: err.message }); }
});

// ── GET /creators/apply/status — statut de la candidature de l'utilisateur courant
router.get('/apply/status', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.from('creator_applications')
      .select('id, status, created_at, reviewed_at, rejection_reason, category:categories(name)')
      .eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(1).single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json(data || { status: 'NONE' });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── GET /creators/price-suggestion?category_id=... — suggestion de prix d'abonnement (IA)
// Utilisable avant candidature (choix du prix de départ) et après (ajustement).
// ── PUT /creators/me — mise à jour du profil créateur (créateur connecté)
router.put('/me', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const { display_name, subscription_price_xcon, welcome_message, is_accepting_subs } = req.body;
    const updates = { updated_at: new Date().toISOString() };

    if (display_name !== undefined) {
      if (display_name.length < 2 || display_name.length > 100)
        return res.status(400).json({ error: 'Le nom d\'affichage doit contenir entre 2 et 100 caractères' });
      updates.display_name = display_name;
    }
    if (subscription_price_xcon !== undefined) {
      const price = Number(subscription_price_xcon);
      if (price < SUBSCRIPTION_PRICE_MIN || price > SUBSCRIPTION_PRICE_MAX)
        return res.status(400).json({ error: `Le prix d'abonnement doit être entre ${SUBSCRIPTION_PRICE_MIN} et ${SUBSCRIPTION_PRICE_MAX} FCFA` });
      updates.subscription_price_xcon = price;
    }
    if (welcome_message !== undefined) {
      if (welcome_message.length > 1000) return res.status(400).json({ error: 'Message de bienvenue trop long (max 1000 caractères)' });
      updates.welcome_message = welcome_message;
    }
    if (is_accepting_subs !== undefined) updates.is_accepting_subs = !!is_accepting_subs;

    const { data, error } = await supabase.from('creator_profiles')
      .update(updates).eq('user_id', req.user.id).select().single();
    if (error) throw error;

    res.json({ message: 'Profil mis à jour', profile: data });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── GET /creators/me/stats — statistiques pour le tableau de bord créateur
router.get('/me/stats', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const { data: profile } = await supabase.from('creator_profiles')
      .select('subscribers_count, posts_count, total_likes, subscription_price_xcon')
      .eq('user_id', req.user.id).single();

    const { data: wallet } = await supabase.from('wallets')
      .select('balance_xcon, pending_balance_xcon, total_earned, total_withdrawn')
      .eq('user_id', req.user.id).single();

    // Revenus des 30 derniers jours par type
    const since = new Date(Date.now() - 30 * 24 * 3600000).toISOString();
    const { data: recentTx } = await supabase.from('transactions')
      .select('type, amount_xcon, created_at')
      .eq('user_id', req.user.id)
      .in('type', ['SUBSCRIPTION_INCOME', 'TIP_RECEIVED', 'PPV_INCOME'])
      .gte('created_at', since);

    const revenue30d = {
      subscriptions: 0, tips: 0, ppv: 0, total: 0,
    };
    for (const tx of recentTx || []) {
      if (tx.type === 'SUBSCRIPTION_INCOME') revenue30d.subscriptions += tx.amount_xcon;
      if (tx.type === 'TIP_RECEIVED') revenue30d.tips += tx.amount_xcon;
      if (tx.type === 'PPV_INCOME') revenue30d.ppv += tx.amount_xcon;
    }
    revenue30d.total = revenue30d.subscriptions + revenue30d.tips + revenue30d.ppv;

    res.json({
      profile: profile || {},
      wallet: wallet || {},
      revenue_30d: revenue30d,
    });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── GET /creators/me/sentiment — répartition du sentiment des commentaires récents
router.get('/me/sentiment', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 3600000).toISOString();

    const { data: myPosts } = await supabase.from('posts').select('id').eq('creator_id', req.user.id);
    const postIds = (myPosts || []).map((p) => p.id);
    if (postIds.length === 0) return res.json({ total: 0, breakdown: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 }, recent_negative: [] });

    const { data: comments } = await supabase.from('post_comments')
      .select('id, content, sentiment, created_at, post_id, user:users(pseudo)')
      .in('post_id', postIds)
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    const breakdown = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 };
    for (const c of comments || []) {
      if (c.sentiment && breakdown[c.sentiment] !== undefined) breakdown[c.sentiment]++;
    }

    const recentNegative = (comments || [])
      .filter((c) => c.sentiment === 'NEGATIVE')
      .slice(0, 5)
      .map((c) => ({ id: c.id, content: c.content, post_id: c.post_id, user: c.user, created_at: c.created_at }));

    res.json({ total: (comments || []).length, breakdown, recent_negative: recentNegative });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── GET /creators/me/digest — dernier résumé hebdomadaire généré par l'IA
router.get('/me/digest', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const { data, error } = await supabase.from('creator_digests')
      .select('*').eq('creator_id', req.user.id)
      .order('period_start', { ascending: false }).limit(1).single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json(data || null);
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});


// ── POST /creators/:userId/bookmark — ajouter/retirer un créateur des favoris
router.post('/:userId/bookmark', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId === req.user.id) return res.status(400).json({ error: 'Action impossible sur votre propre profil' });

    const { data: existing } = await supabase.from('creator_bookmarks')
      .select('id').eq('user_id', req.user.id).eq('creator_id', userId).single();

    if (existing) {
      await supabase.from('creator_bookmarks').delete().eq('id', existing.id);
      return res.json({ bookmarked: false });
    }

    await supabase.from('creator_bookmarks').insert({ user_id: req.user.id, creator_id: userId });
    res.json({ bookmarked: true });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── GET /creators/bookmarks/me — liste des créateurs favoris de l'utilisateur
router.get('/bookmarks/me', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.from('creator_bookmarks')
      .select(`
        created_at,
        creator:users!creator_bookmarks_creator_id_fkey(
          id, pseudo, avatar_url,
          creator_profile:creator_profiles(display_name, subscription_price_xcon, category:categories(name, slug))
        )
      `)
      .eq('user_id', req.user.id).order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

module.exports = router;

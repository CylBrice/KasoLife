// ============================================================
// KASOLIFE — Routes /posts v1.0
// CRUD contenu créateur, likes, commentaires, achat PPV
// Niveaux d'accès : FREE (public) | SUBSCRIBERS (abonnés) | PPV (paiement à l'unité)
// ============================================================
'use strict';
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authMiddleware, requireMinRole, requireNotWalletFrozen } = require('../middleware/auth');
const {
  PPV_PRICE_MIN, PPV_PRICE_MAX, PPV_COMMISSION_RATE,
} = require('../config/constants');
const { moderateText, triageReport, analyzeSentiment, translateText } = require('../services/aiModeration');

const router = express.Router();

const MEDIA_TYPES = ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO'];
const ACCESS_LEVELS = ['FREE', 'SUBSCRIBERS', 'PPV'];

// ── Helper : l'utilisateur a-t-il accès au contenu d'un post ?
const resolveAccess = async (post, viewerId) => {
  if (post.access_level === 'FREE') return { hasAccess: true, reason: 'FREE' };
  if (!viewerId) return { hasAccess: false, reason: 'AUTH_REQUIRED' };
  if (viewerId === post.creator_id) return { hasAccess: true, reason: 'OWNER' };

  if (post.access_level === 'SUBSCRIBERS') {
    const { data: sub } = await supabase.from('subscriptions')
      .select('id').eq('fan_id', viewerId).eq('creator_id', post.creator_id).eq('status', 'ACTIVE').single();
    return { hasAccess: !!sub, reason: sub ? 'SUBSCRIBED' : 'SUBSCRIPTION_REQUIRED' };
  }

  if (post.access_level === 'PPV') {
    const { data: purchase } = await supabase.from('post_purchases')
      .select('id').eq('post_id', post.id).eq('buyer_id', viewerId).single();
    return { hasAccess: !!purchase, reason: purchase ? 'PURCHASED' : 'PURCHASE_REQUIRED' };
  }
  return { hasAccess: false, reason: 'UNKNOWN' };
};

// ── Helper : extraire viewerId depuis un token optionnel
const getViewerId = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    return decoded.userId;
  } catch { return null; }
};

// ── Helper : sérialise un post selon l'accès du viewer
const serializePost = (post, access) => {
  const base = {
    id: post.id,
    creator_id: post.creator_id,
    creator: post.creator,
    category: post.category,
    caption: post.caption,
    media_type: post.media_type,
    access_level: post.access_level,
    price_xcon: post.price_xcon,
    likes_count: post.likes_count,
    comments_count: post.comments_count,
    created_at: post.created_at,
    has_access: access.hasAccess,
    access_reason: access.reason,
  };
  if (access.hasAccess) {
    base.media_url = post.media_url;
    base.thumbnail_url = post.thumbnail_url;
  } else {
    base.thumbnail_url = post.thumbnail_url;
    base.media_url = null;
  }
  return base;
};

// ── GET /posts/discover — feed découverte mixte (style "For You")
// Mélange : 60% trending (engagement récent) / 25% découverte (petits créateurs prometteurs) / 15% frais (<24h)
// Anti-répétition : un même créateur n'apparaît pas deux fois dans les 5 premiers posts.
router.get('/discover', async (req, res) => {
  try {
    const viewerId = getViewerId(req);
    const { page = 1, limit = 20 } = req.query;
    const pageNum  = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(limit) || 20));

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const oneDayAgo    = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const POST_SELECT = `
      id, creator_id, category_id, caption, media_type, media_url, thumbnail_url,
      access_level, price_xcon, likes_count, comments_count, created_at,
      creator:users!posts_creator_id_fkey(pseudo, avatar_url),
      category:categories(name, slug)
    `;

    // ── Préférences du fan connecté (personnalisation légère) ─────────────
    // On dérive un ensemble de catégories "préférées" à partir de ses abonnements
    // actifs et de ses likes récents — sans table dédiée, calcul à la volée.
    const preferredCategoryIds = new Set();
    if (viewerId) {
      const [{ data: subs }, { data: likedPosts }] = await Promise.all([
        supabase.from('subscriptions')
          .select('creator:users!subscriptions_creator_id_fkey(creator_profile:creator_profiles(category_id))')
          .eq('fan_id', viewerId).eq('status', 'ACTIVE'),
        supabase.from('post_likes')
          .select('post:posts(category_id)')
          .eq('user_id', viewerId).order('created_at', { ascending: false }).limit(30),
      ]);
      for (const s of subs || []) {
        const catId = s.creator?.creator_profile?.category_id;
        if (catId) preferredCategoryIds.add(catId);
      }
      for (const l of likedPosts || []) {
        const catId = l.post?.category_id;
        if (catId) preferredCategoryIds.add(catId);
      }
    }

    // Récupère un lot de candidats plus large que nécessaire pour pouvoir mélanger/filtrer
    const candidatePoolSize = Math.max(100, pageSize * 5);

    // ── Pool 1 : Trending (7 derniers jours, contenu vidéo/image/audio privilégié)
    const { data: trendingCandidates, error: trendErr } = await supabase.from('posts')
      .select(POST_SELECT)
      .eq('is_published', true)
      .eq('is_flagged', false)
      .in('media_type', ['VIDEO', 'IMAGE', 'AUDIO'])
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(candidatePoolSize);
    if (trendErr) throw trendErr;

    // ── Pool 2 : Frais (<24h, tous créateurs, tout type de média)
    const { data: freshCandidates, error: freshErr } = await supabase.from('posts')
      .select(POST_SELECT)
      .eq('is_published', true)
      .eq('is_flagged', false)
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false })
      .limit(candidatePoolSize);
    if (freshErr) throw freshErr;

    // ── Pool 3 : Découverte — créateurs avec <50 abonnés
    const { data: smallCreators } = await supabase.from('creator_profiles')
      .select('user_id, subscribers_count')
      .lt('subscribers_count', 50);
    const smallCreatorIds = (smallCreators || []).map((c) => c.user_id);
    const subscriberCountByCreator = Object.fromEntries(
      (smallCreators || []).map((c) => [c.user_id, c.subscribers_count || 0])
    );

    let discoveryCandidates = [];
    if (smallCreatorIds.length > 0) {
      const { data, error: discErr } = await supabase.from('posts')
        .select(POST_SELECT)
        .eq('is_published', true)
        .eq('is_flagged', false)
        .in('creator_id', smallCreatorIds)
        .order('created_at', { ascending: false })
        .limit(candidatePoolSize);
      if (discErr) throw discErr;
      discoveryCandidates = data || [];
    }

    // ── Récupère les pourboires reçus par post (7 derniers jours) pour le score trending
    const trendingPostIds = (trendingCandidates || []).map((p) => p.id);
    const tipsByPost = {};
    if (trendingPostIds.length > 0) {
      const { data: tipsData } = await supabase.from('tips')
        .select('post_id, amount_xcon')
        .in('post_id', trendingPostIds)
        .gte('created_at', sevenDaysAgo);
      for (const tip of tipsData || []) {
        if (!tip.post_id) continue;
        tipsByPost[tip.post_id] = (tipsByPost[tip.post_id] || 0) + (tip.amount_xcon || 0);
      }
    }

    // ── Calcul des scores ────────────────────────────────────────────────
    const hoursAgo = (createdAt) => (now.getTime() - new Date(createdAt).getTime()) / 3_600_000;

    // Score trending : engagement pondéré, avec décroissance de récence (demi-vie ~48h)
    // + un boost modéré (×1.4) si la catégorie correspond aux préférences du fan
    const scoreTrending = (post) => {
      const tipScore = (tipsByPost[post.id] || 0) / 100; // 100 xcon de tip ≈ 1 point d'engagement
      const engagement = (post.likes_count || 0) + (post.comments_count || 0) * 2 + tipScore;
      const recencyDecay = Math.pow(0.5, hoursAgo(post.created_at) / 48);
      const personalBoost = preferredCategoryIds.has(post.category_id) ? 1.4 : 1.0;
      return (engagement * recencyDecay + 0.01) * personalBoost;
    };

    // Score découverte : ratio engagement/abonnés — favorise les petits créateurs qui performent bien
    // + même boost de personnalisation
    const scoreDiscovery = (post) => {
      const subs = subscriberCountByCreator[post.creator_id] ?? 0;
      const engagement = (post.likes_count || 0) + (post.comments_count || 0) * 2;
      const ratio = engagement / (subs + 1); // +1 évite division par zéro
      const recencyDecay = Math.pow(0.5, hoursAgo(post.created_at) / 72); // décroissance plus lente
      const personalBoost = preferredCategoryIds.has(post.category_id) ? 1.4 : 1.0;
      return (ratio * recencyDecay + 0.01) * personalBoost;
    };

    // Score frais : pur ordre chronologique inversé (le plus récent en tête)
    const scoreFresh = (post) => -hoursAgo(post.created_at);

    // ── Sélection pondérée par poule, avec un peu d'aléatoire (±15%)
    // pour varier l'ordre entre visites sans casser le classement global
    const weightedSample = (candidates, scoreFn, count) => {
      const scored = candidates.map((post) => ({
        post,
        score: scoreFn(post) * (0.85 + Math.random() * 0.3),
      }));
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, count).map((s) => s.post);
    };

    const trendingCount  = Math.ceil(pageSize * 0.60);
    const discoveryCount = Math.ceil(pageSize * 0.25);
    const freshCount     = Math.max(0, pageSize - trendingCount - discoveryCount);

    const trendingPicks  = weightedSample(trendingCandidates || [], scoreTrending, trendingCount + 5);
    const discoveryPicks = weightedSample(discoveryCandidates, scoreDiscovery, discoveryCount + 5);
    const freshPicks     = weightedSample(freshCandidates || [], scoreFresh, freshCount + 5);

    // ── Fusion avec anti-répétition (pas 2x le même créateur dans les 5 premiers)
    const merged = [];
    const usedPostIds = new Set();
    const seenCreatorsEarly = new Set();

    const tryAdd = (post) => {
      if (!post || usedPostIds.has(post.id)) return false;
      if (merged.length < 5 && seenCreatorsEarly.has(post.creator_id)) return false;
      merged.push(post);
      usedPostIds.add(post.id);
      if (merged.length <= 5) seenCreatorsEarly.add(post.creator_id);
      return true;
    };

    // Intercale les trois pools en respectant approximativement les proportions 60/25/15
    const queues = [
      { items: trendingPicks,  take: trendingCount },
      { items: discoveryPicks, take: discoveryCount },
      { items: freshPicks,     take: freshCount },
    ];
    const cursor    = [0, 0, 0];
    const remaining = queues.map((q) => q.take);

    while (merged.length < pageSize) {
      let progressed = false;
      for (let i = 0; i < queues.length; i++) {
        if (remaining[i] <= 0) continue;
        const { items } = queues[i];
        while (cursor[i] < items.length) {
          const candidate = items[cursor[i]];
          cursor[i] += 1;
          if (tryAdd(candidate)) { remaining[i] -= 1; progressed = true; break; }
        }
      }
      if (!progressed) break; // plus rien à ajouter dans aucune poule
    }

    // ── Complète avec le feed chronologique standard si les pools sont insuffisants
    // (cas d'une plateforme jeune avec peu de contenu)
    if (merged.length < pageSize) {
      const offset = (pageNum - 1) * pageSize;
      const { data: fallback } = await supabase.from('posts')
        .select(POST_SELECT)
        .eq('is_published', true)
        .eq('is_flagged', false)
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize * 2);
      for (const post of fallback || []) {
        if (merged.length >= pageSize) break;
        tryAdd(post);
      }
    }

    const finalPosts = merged.slice(0, pageSize);

    const serialized = await Promise.all(finalPosts.map(async (post) => {
      const access = await resolveAccess(post, viewerId);
      return serializePost(post, access);
    }));

    res.json({
      posts: serialized,
      pagination: { page: pageNum, limit: pageSize },
    });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur', details: err.message }); }
});

// ── GET /posts/feed — fil d'actualité (découverte)
router.get('/feed', async (req, res) => {
  try {
    const viewerId = getViewerId(req);
    const { category, page = 1, limit = 20 } = req.query;
    const pageNum  = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const offset   = (pageNum - 1) * pageSize;

    let query = supabase.from('posts')
      .select(`
        id, creator_id, category_id, caption, media_type, media_url, thumbnail_url,
        access_level, price_xcon, likes_count, comments_count, created_at,
        creator:users!posts_creator_id_fkey(pseudo, avatar_url),
        category:categories(name, slug)
      `, { count: 'exact' })
      .eq('is_published', true)
      .eq('is_flagged', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (category) {
      const { data: cat } = await supabase.from('categories').select('id').eq('slug', category).single();
      if (cat) query = query.eq('category_id', cat.id);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const serialized = await Promise.all((data || []).map(async (post) => {
      const access = await resolveAccess(post, viewerId);
      return serializePost(post, access);
    }));

    res.json({
      posts: serialized,
      pagination: { page: pageNum, limit: pageSize, total: count || 0, pages: Math.ceil((count || 0) / pageSize) },
    });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur', details: err.message }); }
});

// ── GET /posts/me — mes posts (créateur, inclut non-publiés/signalés)
router.get('/me', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum  = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const offset   = (pageNum - 1) * pageSize;

    const { data, error, count } = await supabase.from('posts')
      .select(`
        id, creator_id, category_id, caption, media_type, media_url, thumbnail_url,
        access_level, price_xcon, likes_count, comments_count, created_at,
        is_published, is_flagged,
        category:categories(name, slug)
      `, { count: 'exact' })
      .eq('creator_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;

    res.json({
      posts: data || [],
      pagination: { page: pageNum, limit: pageSize, total: count || 0, pages: Math.ceil((count || 0) / pageSize) },
    });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── GET /posts/creator/:userId — posts d'un créateur spécifique
router.get('/creator/:userId', async (req, res) => {
  try {
    const viewerId = getViewerId(req);
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const pageNum  = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const offset   = (pageNum - 1) * pageSize;

    const { data, error, count } = await supabase.from('posts')
      .select(`
        id, creator_id, category_id, caption, media_type, media_url, thumbnail_url,
        access_level, price_xcon, likes_count, comments_count, created_at,
        creator:users!posts_creator_id_fkey(pseudo, avatar_url),
        category:categories(name, slug)
      `, { count: 'exact' })
      .eq('creator_id', userId)
      .eq('is_published', true)
      .eq('is_flagged', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;

    const serialized = await Promise.all((data || []).map(async (post) => {
      const access = await resolveAccess(post, viewerId);
      return serializePost(post, access);
    }));

    res.json({
      posts: serialized,
      pagination: { page: pageNum, limit: pageSize, total: count || 0, pages: Math.ceil((count || 0) / pageSize) },
    });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── GET /posts/:id — détail d'un post
router.get('/:id', async (req, res) => {
  try {
    const viewerId = getViewerId(req);
    const { id } = req.params;

    const { data: post, error } = await supabase.from('posts')
      .select(`
        id, creator_id, category_id, caption, media_type, media_url, thumbnail_url,
        access_level, price_xcon, likes_count, comments_count, created_at, is_published,
        creator:users!posts_creator_id_fkey(pseudo, avatar_url),
        category:categories(name, slug)
      `)
      .eq('id', id).single();
    if (error || !post || !post.is_published) return res.status(404).json({ error: 'Post introuvable' });

    const access = await resolveAccess(post, viewerId);
    res.json(serializePost(post, access));
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /posts — créer un post (créateur uniquement, avec support scheduled_at)
router.post('/', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const {
      caption, media_type, media_url, thumbnail_url, access_level, price_xcon,
      moderation_status, moderation_reason, ai_tags,
      content_hash, duplicate_of, category_mismatch,
      scheduled_at, // Optionnel : date/heure de publication programmée
    } = req.body;

    if (!MEDIA_TYPES.includes(media_type))
      return res.status(400).json({ error: `Type de média invalide — valeurs possibles : ${MEDIA_TYPES.join(', ')}` });
    if (!ACCESS_LEVELS.includes(access_level))
      return res.status(400).json({ error: `Niveau d'accès invalide — valeurs possibles : ${ACCESS_LEVELS.join(', ')}` });
    if (media_type !== 'TEXT' && !media_url)
      return res.status(400).json({ error: 'URL média requise pour ce type de contenu' });
    if (caption && caption.length > 2000)
      return res.status(400).json({ error: 'Légende trop longue (max 2000 caractères)' });

    let price = 0;
    if (access_level === 'PPV') {
      price = Number(price_xcon);
      if (!price || price < PPV_PRICE_MIN || price > PPV_PRICE_MAX)
        return res.status(400).json({ error: `Le prix doit être entre ${PPV_PRICE_MIN} et ${PPV_PRICE_MAX} FCFA` });
    }

    const { data: profile } = await supabase.from('creator_profiles')
      .select('category_id').eq('user_id', req.user.id).single();
    if (!profile) return res.status(404).json({ error: 'Profil créateur introuvable' });

    // Un post dont la modération IA a relevé un doute (FLAGGED) est publié mais
    // marqué pour revue par l'équipe de modération (visible mais signalé en admin).
    const validModerationStatus = ['NOT_SCANNED', 'APPROVED', 'FLAGGED', 'REJECTED'].includes(moderation_status)
      ? moderation_status : 'NOT_SCANNED';
    const isDuplicate = typeof duplicate_of === 'string' && duplicate_of.length > 0;
    const isCategoryMismatch = category_mismatch === true;
    const isFlaggedByAI = validModerationStatus === 'FLAGGED' || validModerationStatus === 'REJECTED'
      || isDuplicate || isCategoryMismatch;

    // Si scheduled_at est fourni, le post n'est pas immédiatement publié
    const isScheduled = scheduled_at && new Date(scheduled_at) > new Date();
    const shouldPublish = !isScheduled; // Publier maintenant si pas de date programmée

    const { data: post, error } = await supabase.from('posts').insert({
      id: uuidv4(), creator_id: req.user.id, category_id: profile.category_id,
      caption: caption || null, media_type, media_url: media_url || null,
      thumbnail_url: thumbnail_url || null, access_level, price_xcon: price,
      moderation_status: validModerationStatus,
      moderation_reason: moderation_reason || null,
      ai_tags: Array.isArray(ai_tags) ? ai_tags.slice(0, 6).map((t) => String(t).toLowerCase().slice(0, 30)) : [],
      content_hash: typeof content_hash === 'string' ? content_hash.slice(0, 16) : null,
      duplicate_of: isDuplicate ? duplicate_of : null,
      category_mismatch: isCategoryMismatch,
      is_flagged: isFlaggedByAI,
      scheduled_at: isScheduled ? scheduled_at : null,
      is_published: shouldPublish,
    }).select().single();
    if (error) throw error;

    await supabase.rpc('increment_posts_count', { p_creator_id: req.user.id, p_delta: 1 });

    res.status(201).json({ message: 'Post publié', post });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur', details: err.message }); }
});

// ── PUT /posts/:id — modifier un post (auteur uniquement)
router.put('/:id', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const { id } = req.params;
    const { caption, access_level, price_xcon, is_published } = req.body;

    const { data: post } = await supabase.from('posts').select('creator_id, access_level').eq('id', id).single();
    if (!post) return res.status(404).json({ error: 'Post introuvable' });
    if (post.creator_id !== req.user.id && !['admin','super_admin','root_admin'].includes(req.user.role))
      return res.status(403).json({ error: 'Accès refusé' });

    const updates = { updated_at: new Date().toISOString() };
    if (caption !== undefined) {
      if (caption.length > 2000) return res.status(400).json({ error: 'Légende trop longue (max 2000 caractères)' });
      updates.caption = caption;
    }
    if (access_level !== undefined) {
      if (!ACCESS_LEVELS.includes(access_level)) return res.status(400).json({ error: 'Niveau d\'accès invalide' });
      updates.access_level = access_level;
    }
    if (price_xcon !== undefined) {
      const price = Number(price_xcon);
      if ((updates.access_level || post.access_level) === 'PPV') {
        if (!price || price < PPV_PRICE_MIN || price > PPV_PRICE_MAX)
          return res.status(400).json({ error: `Le prix doit être entre ${PPV_PRICE_MIN} et ${PPV_PRICE_MAX} FCFA` });
      }
      updates.price_xcon = price;
    }
    if (is_published !== undefined) updates.is_published = !!is_published;

    const { data, error } = await supabase.from('posts').update(updates).eq('id', id).select().single();
    if (error) throw error;
    res.json({ message: 'Post mis à jour', post: data });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── GET /posts/scheduled — récupérer tous les posts programmés du créateur
router.get('/scheduled', authMiddleware, async (req, res) => {
  try {
    const { data: posts, error } = await supabase.from('posts')
      .select('id, caption, media_url, scheduled_at, created_at')
      .eq('creator_id', req.user.id)
      .eq('is_published', false)
      .order('scheduled_at', { ascending: true });

    if (error) throw error;
    res.json({ posts: posts || [] });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── PUT /posts/:id/reschedule — modifier la date programmée (créateur seulement)
router.put('/:id/reschedule', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduled_at } = req.body;

    const { data: post } = await supabase.from('posts')
      .select('creator_id, scheduled_at').eq('id', id).single();
    if (!post) return res.status(404).json({ error: 'Post introuvable' });
    if (post.creator_id !== req.user.id)
      return res.status(403).json({ error: 'Accès refusé' });

    // Si scheduled_at est null, annuler la programmation et publier maintenant
    // Si scheduled_at est une date future, programmer la publication
    const isScheduled = scheduled_at && new Date(scheduled_at) > new Date();
    const { error } = await supabase.from('posts')
      .update({
        scheduled_at: isScheduled ? scheduled_at : null,
        is_published: !isScheduled, // Publier maintenant si pas de programmation
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
    res.json({ message: isScheduled ? `Post programmé pour ${scheduled_at}` : 'Programmation annulée, post publié' });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── DELETE /posts/:id — supprimer un post (auteur uniquement)
router.delete('/:id', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const { id } = req.params;
    const { data: post } = await supabase.from('posts').select('creator_id').eq('id', id).single();
    if (!post) return res.status(404).json({ error: 'Post introuvable' });
    if (post.creator_id !== req.user.id && !['admin','super_admin','root_admin'].includes(req.user.role))
      return res.status(403).json({ error: 'Accès refusé' });

    await supabase.from('posts').delete().eq('id', id);
    await supabase.rpc('increment_posts_count', { p_creator_id: post.creator_id, p_delta: -1 });
    res.json({ message: 'Post supprimé' });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /posts/:id/like — liker/déliker un post
router.post('/:id/like', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: post } = await supabase.from('posts').select('id, creator_id').eq('id', id).single();
    if (!post) return res.status(404).json({ error: 'Post introuvable' });

    const { data: existing } = await supabase.from('post_likes')
      .select('id').eq('post_id', id).eq('user_id', req.user.id).single();

    if (existing) {
      await supabase.from('post_likes').delete().eq('id', existing.id);
      await supabase.rpc('increment_post_likes', { p_post_id: id, p_delta: -1 });
      return res.json({ liked: false });
    }

    await supabase.from('post_likes').insert({ post_id: id, user_id: req.user.id });
    await supabase.rpc('increment_post_likes', { p_post_id: id, p_delta: 1 });
    res.json({ liked: true });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── GET /posts/:id/comments — liste des commentaires avec support threading
router.get('/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 30, sort = 'recent' } = req.query;
    const pageNum  = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 30));
    const offset   = (pageNum - 1) * pageSize;

    let query = supabase.from('post_comments')
      .select('id, content, created_at, likes_count, is_pinned, parent_id, user:users(id, pseudo, avatar_url, role)')
      .eq('post_id', id)
      .eq('is_flagged', false)
      .is('parent_id', true); // Seulement les commentaires top-level

    if (sort === 'popular') {
      query = query.order('likes_count', { ascending: false }).order('created_at', { ascending: false });
    } else if (sort === 'oldest') {
      query = query.order('created_at', { ascending: true });
    } else { // 'recent' (default)
      query = query.order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
    }

    const { data: comments, error, count } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;

    // Pour chaque commentaire top-level, récupérer les replies
    const commentsWithReplies = await Promise.all(
      (comments || []).map(async (comment) => {
        const { data: replies } = await supabase.from('post_comments')
          .select('id, content, created_at, likes_count, is_pinned, parent_id, user:users(id, pseudo, avatar_url, role)')
          .eq('parent_id', comment.id)
          .order('created_at', { ascending: true });

        return {
          ...comment,
          replies: replies || [],
          reply_count: replies?.length || 0,
        };
      })
    );

    res.json({
      comments: commentsWithReplies,
      pagination: { page: pageNum, limit: pageSize, total: count || 0, pages: Math.ceil((count || 0) / pageSize) },
    });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /posts/:id/comments — ajouter un commentaire (support threading avec parent_id)
router.post('/:id/comments', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, parent_id } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Commentaire vide' });
    if (content.length > 1000) return res.status(400).json({ error: 'Commentaire trop long (max 1000 caractères)' });

    const { data: post } = await supabase.from('posts').select('id, creator_id, access_level').eq('id', id).single();
    if (!post) return res.status(404).json({ error: 'Post introuvable' });

    const access = await resolveAccess(post, req.user.id);
    if (!access.hasAccess) return res.status(403).json({ error: 'Accès au contenu requis pour commenter' });

    // Si parent_id est fourni, vérifier que le commentaire parent existe et appartient au même post
    if (parent_id) {
      const { data: parentComment } = await supabase.from('post_comments')
        .select('id, post_id').eq('id', parent_id).eq('post_id', id).single();
      if (!parentComment) return res.status(404).json({ error: 'Commentaire parent introuvable' });
    }

    const modResult = await moderateText(content.trim(), 'comment');
    if (!modResult.allowed) {
      return res.status(422).json({ error: 'Ce commentaire ne respecte pas nos règles de communauté.', reason: modResult.reason });
    }

    const sentiment = await analyzeSentiment(content.trim());

    const { data: comment, error } = await supabase.from('post_comments').insert({
      id: uuidv4(), post_id: id, user_id: req.user.id, content: content.trim(),
      parent_id: parent_id || null,
      is_flagged: modResult.severity === 'MEDIUM',
      sentiment,
    }).select('id, post_id, content, created_at, likes_count, is_pinned, parent_id, sentiment, user:users(id, pseudo, avatar_url, role)').single();
    if (error) throw error;

    // Incrémenter le compteur de commentaires du post
    await supabase.rpc('increment_post_comments', { p_post_id: id, p_delta: 1 });

    // Créer une notification pour le créateur du post (si ce n'est pas lui)
    if (req.user.id !== post.creator_id) {
      await supabase.from('notifications').insert({
        id: uuidv4(),
        user_id: post.creator_id,
        title: `${req.user.pseudo} a commenté ton post`,
        message: content.substring(0, 100),
        type: 'COMMENT',
      }).catch(() => {}); // Ne pas bloquer si notification échoue
    }

    res.status(201).json(comment);
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── DELETE /posts/:postId/comments/:commentId
router.delete('/:postId/comments/:commentId', authMiddleware, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { data: comment } = await supabase.from('post_comments')
      .select('id, user_id').eq('id', commentId).eq('post_id', postId).single();
    if (!comment) return res.status(404).json({ error: 'Commentaire introuvable' });

    const { data: post } = await supabase.from('posts').select('creator_id').eq('id', postId).single();
    const canDelete = comment.user_id === req.user.id || post?.creator_id === req.user.id
      || ['admin','super_admin','root_admin'].includes(req.user.role);
    if (!canDelete) return res.status(403).json({ error: 'Accès refusé' });

    await supabase.from('post_comments').delete().eq('id', commentId);
    await supabase.rpc('increment_post_comments', { p_post_id: postId, p_delta: -1 });
    res.json({ message: 'Commentaire supprimé' });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /posts/:postId/comments/:commentId/like — liker un commentaire
router.post('/:postId/comments/:commentId/like', authMiddleware, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.user.id;

    // Vérifier que le commentaire existe et appartient au post
    const { data: comment } = await supabase.from('post_comments')
      .select('id, post_id').eq('id', commentId).eq('post_id', postId).single();
    if (!comment) return res.status(404).json({ error: 'Commentaire introuvable' });

    // Vérifier si déjà liké
    const { data: existing } = await supabase.from('comment_likes')
      .select('id').eq('comment_id', commentId).eq('user_id', userId).single();
    if (existing) return res.status(409).json({ error: 'Vous avez déjà liké ce commentaire' });

    // Ajouter le like
    const { error: insertError } = await supabase.from('comment_likes').insert({
      id: uuidv4(),
      comment_id: commentId,
      user_id: userId,
    });
    if (insertError) throw insertError;

    // Incrémenter le compteur
    const { data: updated } = await supabase.from('post_comments')
      .update({ likes_count: 'likes_count + 1' })
      .eq('id', commentId)
      .select('likes_count')
      .single();

    res.json({ message: 'Commentaire liké', likes_count: updated?.likes_count || 0 });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── DELETE /posts/:postId/comments/:commentId/like — retirer un like
router.delete('/:postId/comments/:commentId/like', authMiddleware, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    // Récupérer le like
    const { data: like } = await supabase.from('comment_likes')
      .select('id').eq('comment_id', commentId).eq('user_id', userId).single();
    if (!like) return res.status(404).json({ error: 'Like introuvable' });

    // Supprimer le like
    await supabase.from('comment_likes').delete().eq('id', like.id);

    // Décrémenter le compteur
    const { data: updated } = await supabase.from('post_comments')
      .update({ likes_count: 'GREATEST(0, likes_count - 1)' })
      .eq('id', commentId)
      .select('likes_count')
      .single();

    res.json({ message: 'Like retiré', likes_count: updated?.likes_count || 0 });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── PUT /posts/:postId/comments/:commentId/pin — épingler/dépingler (créateur du post seulement)
router.put('/:postId/comments/:commentId/pin', authMiddleware, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.user.id;

    // Vérifier que l'utilisateur est le créateur du post
    const { data: post } = await supabase.from('posts')
      .select('creator_id').eq('id', postId).single();
    if (!post || post.creator_id !== userId) {
      return res.status(403).json({ error: 'Seul le créateur du post peut épingler les commentaires' });
    }

    // Récupérer le commentaire
    const { data: comment } = await supabase.from('post_comments')
      .select('id, post_id, is_pinned').eq('id', commentId).eq('post_id', postId).single();
    if (!comment) return res.status(404).json({ error: 'Commentaire introuvable' });

    // Toggle pin
    const newPinnedState = !comment.is_pinned;
    const { error: updateError } = await supabase.from('post_comments')
      .update({ is_pinned: newPinnedState })
      .eq('id', commentId);
    if (updateError) throw updateError;

    res.json({
      message: newPinnedState ? 'Commentaire épinglé' : 'Commentaire désépinglé',
      is_pinned: newPinnedState,
    });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /posts/:id/purchase — acheter un post PPV
router.post('/:id/purchase', authMiddleware, requireNotWalletFrozen, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: post } = await supabase.from('posts')
      .select('id, creator_id, access_level, price_xcon, is_published').eq('id', id).single();
    if (!post || !post.is_published) return res.status(404).json({ error: 'Post introuvable' });
    if (post.access_level !== 'PPV') return res.status(400).json({ error: 'Ce post n\'est pas un contenu payant à l\'unité' });
    if (post.creator_id === req.user.id) return res.status(400).json({ error: 'Vous ne pouvez pas acheter votre propre contenu' });

    const { data: existing } = await supabase.from('post_purchases')
      .select('id').eq('post_id', id).eq('buyer_id', req.user.id).single();
    if (existing) return res.status(409).json({ error: 'Vous avez déjà acheté ce contenu' });

    const price = post.price_xcon;
    const commission = Math.round(price * PPV_COMMISSION_RATE);
    const creatorShare = price - commission;

    const { data: newBalance, error: debitErr } = await supabase.rpc('debit_wallet', {
      p_user_id: req.user.id, p_amount: price,
    });
    if (debitErr) {
      if (debitErr.message?.includes('Solde insuffisant'))
        return res.status(402).json({ error: 'Solde insuffisant — veuillez recharger votre wallet' });
      throw debitErr;
    }

    await supabase.from('post_purchases').insert({
      id: uuidv4(), post_id: id, buyer_id: req.user.id, price_xcon: price, commission_xcon: commission,
    });

    await supabase.rpc('credit_pending_balance', { p_user_id: post.creator_id, p_amount: creatorShare });

    await supabase.from('transactions').insert([
      {
        id: uuidv4(), user_id: req.user.id, type: 'PPV_PAYMENT', amount_xcon: -price,
        balance_after: newBalance, description: `Achat contenu PPV`, related_user_id: post.creator_id, related_post_id: id,
      },
      {
        id: uuidv4(), user_id: post.creator_id, type: 'PPV_INCOME', amount_xcon: creatorShare,
        balance_after: 0, description: `Vente contenu PPV (commission ${(PPV_COMMISSION_RATE * 100).toFixed(0)}%)`,
        related_user_id: req.user.id, related_post_id: id,
      },
    ]);

    await supabase.from('platform_revenue').insert({
      id: uuidv4(), source_type: 'COMMISSION_PPV', amount_xcon: commission,
      reference_id: id, user_id: post.creator_id,
    });

    res.json({ message: 'Achat réussi — contenu débloqué', balance_xcon: newBalance });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur', details: err.message }); }
});

// ── POST /posts/:id/report — signaler un post
router.post('/:id/report', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason || reason.length < 5 || reason.length > 300)
      return res.status(400).json({ error: 'Motif requis (5 à 300 caractères)' });

    const { data: post } = await supabase.from('posts').select('id, caption').eq('id', id).single();
    if (!post) return res.status(404).json({ error: 'Post introuvable' });

    const triage = await triageReport({ reason, targetType: 'post', targetContent: post.caption });

    const { error } = await supabase.from('content_reports').insert({
      reporter_id: req.user.id, target_type: 'POST', target_id: id, reason,
      ai_severity: triage.severity, ai_summary: triage.summary,
    });
    if (error) throw error;

    res.status(201).json({ message: "Signalement envoyé — notre équipe va l'examiner" });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /posts/comments/:commentId/translate — traduction à la demande
router.post('/comments/:commentId/translate', authMiddleware, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { target_lang = 'fr' } = req.body;

    const { data: comment } = await supabase.from('post_comments').select('id, content').eq('id', commentId).single();
    if (!comment) return res.status(404).json({ error: 'Commentaire introuvable' });
    if (!comment.content) return res.status(400).json({ error: 'Aucun texte à traduire' });

    const translation = await translateText(comment.content, target_lang);
    if (!translation) return res.status(503).json({ error: 'Traduction indisponible pour le moment' });

    res.json({ translation, target_lang });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

module.exports = router;

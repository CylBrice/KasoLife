// ============================================================
// KASOLIFE — Route /media — proxy sécurisé avec watermark
//
// GET  /media/token/:postId  — émet un JWT media 5 min (Bearer requis)
// GET  /media/serve/:token   — sert l'image watermarkée (token dans URL)
// GET  /media/wm/:postId     — sert l'image watermarkée (Bearer requis, legacy)
// ============================================================
'use strict';

const express  = require('express');
const jwt      = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { authMiddleware, isAdminRole, logAdminContentView } = require('../middleware/auth');
const { downloadMediaFromR2, extractR2Key } = require('../services/cloudflare');
const { applyWatermarks } = require('../services/watermarkService');
const configService = require('../services/configService');

const MEDIA_TOKEN_SECRET  = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
const MEDIA_TOKEN_TTL     = 5 * 60; // 5 minutes en secondes

const router = express.Router();

// ── Résolution d'accès (miroir de posts.js::resolveAccess) ──
const checkPostAccess = async (post, viewerId, viewerRole) => {
  if (post.access_level === 'FREE')    return true;
  if (!viewerId)                        return false;
  if (viewerId === post.creator_id)     return true;
  if (isAdminRole(viewerRole))          return true;

  if (post.access_level === 'SUBSCRIBERS') {
    const { data: sub } = await supabase.from('subscriptions')
      .select('id').eq('fan_id', viewerId).eq('creator_id', post.creator_id).eq('status', 'ACTIVE').single();
    return !!sub;
  }
  if (post.access_level === 'PPV') {
    const { data: purchase } = await supabase.from('post_purchases')
      .select('id').eq('post_id', post.id).eq('buyer_id', viewerId).single();
    return !!purchase;
  }
  return false;
};

// ── GET /media/wm/:postId — image watermarkée ─────────────────
// Requiert auth (le viewer doit être connecté pour tracer l'ID).
// Admins : watermark non appliqué, consultation auditée.
router.get('/wm/:postId', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const viewerId   = req.user.id;
    const viewerRole = req.user.role;

    // Récupérer le post
    const { data: post, error } = await supabase
      .from('posts')
      .select('id, creator_id, media_url, media_type, access_level')
      .eq('id', postId)
      .single();

    if (error || !post) return res.status(404).json({ error: 'Post introuvable' });
    if (!['IMAGE'].includes(post.media_type))
      return res.status(400).json({ error: 'Watermark uniquement pour les images' });
    if (!post.media_url) return res.status(404).json({ error: 'Pas de média associé' });

    // Vérifier l'accès
    const hasAccess = await checkPostAccess(post, viewerId, viewerRole);
    if (!hasAccess) return res.status(403).json({ error: 'Accès refusé — abonnement ou achat requis' });

    // Audit admin
    if (isAdminRole(viewerRole)) {
      logAdminContentView(req, 'post_media', postId);
    }

    await serveWatermarkedImage({ post, viewerId, viewerRole, res });
  } catch (err) {
    console.error('[media/wm] Erreur :', err.message);
    res.status(500).json({ error: 'Erreur lors du traitement du média' });
  }
});

// ── Shared : servir une image depuis R2 avec watermarks ──────
const serveWatermarkedImage = async ({ post, viewerId, viewerRole, res }) => {
  const key    = extractR2Key(post.media_url);
  const buffer = await downloadMediaFromR2(key);

  const isAdmin = isAdminRole(viewerRole);
  let output   = buffer;
  let wmHeader = 'none';

  if (!isAdmin) {
    const [wmV, wmI] = await Promise.all([
      configService.get('watermark_visible_enabled'),
      configService.get('watermark_invisible_enabled'),
    ]);
    const anyEnabled = (wmV && wmV !== 'false') || (wmI && wmI !== 'false');
    if (anyEnabled) {
      output   = await applyWatermarks(buffer, viewerId);
      wmHeader = [wmV !== 'false' && 'visible', wmI !== 'false' && 'invisible'].filter(Boolean).join('+') || 'none';
      res.setHeader('Content-Type', 'image/png');
    }
  }

  if (!res.getHeader('Content-Type')) {
    const ext   = post.media_url.split('.').pop()?.toLowerCase();
    const ctMap = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif' };
    res.setHeader('Content-Type', ctMap[ext] || 'image/jpeg');
  }
  res.setHeader('Content-Length', output.length);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Watermark', wmHeader);
  // Empêche l'embedding dans <img src> cross-origin
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.send(output);
};

// ── GET /media/token/:postId — émettre un JWT media 5 min ────
// Requiert Bearer auth. Valide l'accès, retourne un token
// utilisable UNE FOIS dans /media/serve/:token (expiry 5 min).
router.get('/token/:postId', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const viewerId   = req.user.id;
    const viewerRole = req.user.role;

    const { data: post, error } = await supabase
      .from('posts')
      .select('id, creator_id, media_url, media_type, access_level')
      .eq('id', postId)
      .single();

    if (error || !post) return res.status(404).json({ error: 'Post introuvable' });
    if (!post.media_url)  return res.status(404).json({ error: 'Pas de média associé' });

    const hasAccess = await checkPostAccess(post, viewerId, viewerRole);
    if (!hasAccess) return res.status(403).json({ error: 'Accès refusé' });

    const token = jwt.sign(
      { postId, userId: viewerId, role: viewerRole, purpose: 'media_view' },
      MEDIA_TOKEN_SECRET,
      { expiresIn: MEDIA_TOKEN_TTL }
    );

    res.json({ token, expires_in: MEDIA_TOKEN_TTL });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /media/serve/:token — servir l'image depuis un token ─
// Pas de Bearer requis : le token signé IS l'authentification.
// Idéal pour Canvas fetch (credentials: 'omit').
router.get('/serve/:token', async (req, res) => {
  try {
    const { token } = req.params;

    let payload;
    try {
      payload = jwt.verify(token, MEDIA_TOKEN_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Token invalide ou expiré' });
    }

    if (payload.purpose !== 'media_view') {
      return res.status(401).json({ error: 'Token non autorisé pour ce service' });
    }

    const { postId, userId: viewerId, role: viewerRole } = payload;

    const { data: post, error } = await supabase
      .from('posts')
      .select('id, creator_id, media_url, media_type, access_level')
      .eq('id', postId)
      .single();

    if (error || !post) return res.status(404).json({ error: 'Post introuvable' });
    if (!post.media_url)  return res.status(404).json({ error: 'Pas de média associé' });

    // Re-vérification d'accès : abonnement ou achat toujours valide
    const hasAccess = await checkPostAccess(post, viewerId, viewerRole);
    if (!hasAccess) return res.status(403).json({ error: 'Accès révoqué' });

    // Audit admin
    if (isAdminRole(viewerRole)) logAdminContentView({ user: { id: viewerId } }, 'post_media', postId);

    await serveWatermarkedImage({ post, viewerId, viewerRole, res });
  } catch (err) {
    console.error('[media/serve] Erreur :', err.message);
    res.status(500).json({ error: 'Erreur lors du traitement du média' });
  }
});

module.exports = router;

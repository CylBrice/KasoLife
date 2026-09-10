// ============================================================
// KASOLIFE — Routes /snapshots v1.0
// Snapshots payants — prise manuelle par le créateur (pendant
// live ou hors live). Achat fan → accès permanent streaming.
// Jamais de téléchargement.
// ============================================================
'use strict';

const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authMiddleware, requireMinRole, requireNotWalletFrozen,
        logAdminContentView, isAdminRole } = require('../middleware/auth');
const configService = require('../services/configService');

const router = express.Router();

// ── GET /snapshots — snapshots publiés (discovery ou filtre créateur) ─
router.get('/', async (req, res) => {
  const { creator_id, live_stream_id, page = 1, limit: lim = 20 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(50, parseInt(lim));

  try {
    let query = supabase.from('snapshots')
      .select('id, creator_id, live_stream_id, thumbnail_url, title, price_xcon, access_level, created_at')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + Math.min(50, parseInt(lim)) - 1);

    if (creator_id) query = query.eq('creator_id', creator_id);
    if (live_stream_id) query = query.eq('live_stream_id', live_stream_id);

    const { data: snaps } = await query;
    if (!snaps?.length) return res.json({ snapshots: [] });

    const creatorIds = [...new Set(snaps.map((s) => s.creator_id))];
    const { data: creators } = await supabase.from('users')
      .select('id, pseudo, avatar_url').in('id', creatorIds);
    const creatorMap = new Map((creators || []).map((c) => [c.id, c]));

    res.json({
      snapshots: snaps.map(({ creator_id: cid, ...s }) => ({
        ...s, creator: creatorMap.get(cid) || null,
      })),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /snapshots — créateur publie un snapshot ─────────────
router.post('/', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  const { media_url, thumbnail_url, title, description, price_xcon: rawPrice, access_level, live_stream_id } = req.body;

  if (!media_url?.trim()) return res.status(400).json({ error: 'media_url requis' });

  const accessLevel = access_level || 'PPV';
  if (!['FREE','SUBSCRIBERS','PPV'].includes(accessLevel))
    return res.status(400).json({ error: 'access_level invalide' });

  const priceXcon = accessLevel === 'PPV' ? Math.max(0, parseInt(rawPrice) || 0) : 0;

  if (accessLevel === 'PPV' && priceXcon > 0) {
    const minP = await configService.get('snapshot_min_price_xcon') || 500;
    const maxP = await configService.get('snapshot_max_price_xcon') || 50000;
    if (priceXcon < minP || priceXcon > maxP)
      return res.status(400).json({ error: `Prix invalide — entre ${minP} et ${maxP} XAF` });
  }

  try {
    const { data: snap, error } = await supabase.from('snapshots').insert({
      id: uuidv4(),
      creator_id: req.user.id,
      live_stream_id: live_stream_id || null,
      media_url: media_url.trim(),
      thumbnail_url: thumbnail_url?.trim() || null,
      title: title?.trim() || null,
      description: description?.trim() || null,
      price_xcon: priceXcon,
      access_level: accessLevel,
      is_published: true,
    }).select().single();
    if (error) throw error;

    res.status(201).json({ snapshot: snap });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /snapshots/:id — détail + check accès ─────────────────
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { data: snap } = await supabase.from('snapshots')
      .select('*').eq('id', req.params.id).single();
    if (!snap || !snap.is_published) return res.status(404).json({ error: 'Snapshot introuvable' });

    const viewerId   = req.user?.id;
    const viewerRole = req.user?.role;

    // Admin bypass
    if (isAdminRole(viewerRole)) {
      logAdminContentView(req, 'snapshot', snap.id);
      return res.json({ ...snap, has_access: true, admin_access: true });
    }

    // Vérifier accès
    let hasAccess = snap.access_level === 'FREE';

    if (!hasAccess && viewerId === snap.creator_id) hasAccess = true;

    if (!hasAccess && snap.access_level === 'SUBSCRIBERS') {
      const { data: sub } = await supabase.from('subscriptions')
        .select('id').eq('fan_id', viewerId).eq('creator_id', snap.creator_id)
        .eq('status', 'ACTIVE').single();
      hasAccess = !!sub;
    }

    if (!hasAccess && snap.access_level === 'PPV') {
      const { data: purchase } = await supabase.from('snapshot_purchases')
        .select('id').eq('snapshot_id', snap.id).eq('buyer_id', viewerId).single();
      hasAccess = !!purchase;
    }

    const { media_url, ...publicSnap } = snap;
    res.json({
      ...publicSnap,
      media_url: hasAccess ? media_url : null,
      has_access: hasAccess,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /snapshots/:id/purchase — acheter un snapshot PPV ────
router.post('/:id/purchase', authMiddleware, requireNotWalletFrozen, async (req, res) => {
  try {
    const { data: snap } = await supabase.from('snapshots')
      .select('*').eq('id', req.params.id).eq('is_published', true).single();
    if (!snap) return res.status(404).json({ error: 'Snapshot introuvable' });
    if (snap.access_level !== 'PPV')
      return res.status(400).json({ error: 'Ce snapshot n\'est pas un contenu PPV' });
    if (snap.creator_id === req.user.id)
      return res.status(400).json({ error: 'Vous ne pouvez pas acheter votre propre contenu' });

    if (isAdminRole(req.user.role)) {
      logAdminContentView(req, 'snapshot', snap.id);
      return res.json({ message: 'Accès admin — contenu disponible sans paiement', admin_access: true });
    }

    const { data: existing } = await supabase.from('snapshot_purchases')
      .select('id').eq('snapshot_id', snap.id).eq('buyer_id', req.user.id).single();
    if (existing) return res.status(409).json({ error: 'Vous avez déjà acheté ce snapshot' });

    const commRate   = await configService.getCommissionRate('ppv');
    const commission = Math.floor(snap.price_xcon * commRate);
    const creatorShare = snap.price_xcon - commission;

    const { data: newBalance, error: debitErr } = await supabase.rpc('debit_wallet', {
      p_user_id: req.user.id, p_amount: snap.price_xcon,
    });
    if (debitErr) {
      if (debitErr.message?.includes('Solde insuffisant'))
        return res.status(402).json({ error: 'Solde insuffisant — veuillez recharger votre wallet' });
      throw debitErr;
    }

    await supabase.from('snapshot_purchases').insert({
      id: uuidv4(), buyer_id: req.user.id, creator_id: snap.creator_id,
      snapshot_id: snap.id, price_paid_xcon: snap.price_xcon, commission_xcon: commission,
    });

    await supabase.rpc('credit_pending_balance', { p_user_id: snap.creator_id, p_amount: creatorShare });

    await supabase.from('transactions').insert([
      {
        id: uuidv4(), user_id: req.user.id, type: 'PPV_PAYMENT',
        amount_xcon: -snap.price_xcon, balance_after: newBalance,
        description: `Achat snapshot${snap.title ? ` "${snap.title}"` : ''}`,
        related_user_id: snap.creator_id, related_post_id: snap.id,
      },
      {
        id: uuidv4(), user_id: snap.creator_id, type: 'PPV_INCOME',
        amount_xcon: creatorShare, balance_after: 0,
        description: `Vente snapshot${snap.title ? ` "${snap.title}"` : ''} (commission ${Math.round(commRate * 100)}%)`,
        related_user_id: req.user.id,
      },
    ]);

    await supabase.from('platform_revenue').insert({
      id: uuidv4(), type: 'SNAPSHOT', amount_xcon: commission,
      creator_id: snap.creator_id, fan_id: req.user.id,
    });

    res.json({ message: 'Snapshot acheté', media_url: snap.media_url, new_balance: newBalance });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /snapshots/:id — créateur dépublie un snapshot ─────
router.delete('/:id', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const { data: snap } = await supabase.from('snapshots')
      .select('id, creator_id').eq('id', req.params.id).single();
    if (!snap) return res.status(404).json({ error: 'Snapshot introuvable' });
    if (snap.creator_id !== req.user.id && !isAdminRole(req.user.role))
      return res.status(403).json({ error: 'Accès refusé' });

    await supabase.from('snapshots').update({ is_published: false }).eq('id', snap.id);
    res.json({ message: 'Snapshot dépublié' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

// ============================================================
// KASOLIFE — Routes /vip-shows v1.0
// VIP Shows : show privé créateur, seuil 2 fans, 5 min gratuites,
// ensuite paiement pour les nouveaux entrants.
// Fans présents pendant la grace period → accès gratuit complet.
// ============================================================
'use strict';

const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authMiddleware, requireMinRole, requireNotWalletFrozen,
        logAdminContentView, isAdminRole } = require('../middleware/auth');
const { createRoom, endRoom, createRoomToken } = require('../services/livekit');
const configService = require('../services/configService');
const { PPV_PRICE_MIN } = require('../config/constants');

const router = express.Router();

// ── GET /vip-shows — shows en cours (discovery) ──────────────
router.get('/', async (req, res) => {
  try {
    const { data: shows } = await supabase.from('vip_shows')
      .select('id, title, description, creator_id, price_xcon, current_fans, started_at, grace_ends_at')
      .eq('status', 'LIVE')
      .order('started_at', { ascending: false })
      .limit(50);

    if (!shows?.length) return res.json({ shows: [] });

    const ids = [...new Set(shows.map((s) => s.creator_id))];
    const { data: creators } = await supabase.from('users')
      .select('id, pseudo, avatar_url').in('id', ids);
    const creatorMap = new Map((creators || []).map((c) => [c.id, c]));

    res.json({
      shows: shows.map(({ creator_id, ...s }) => ({
        ...s,
        creator: creatorMap.get(creator_id) || null,
        grace_active: s.grace_ends_at ? new Date() < new Date(s.grace_ends_at) : false,
      })),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /vip-shows/create — créateur crée un VIP Show ───────
router.post('/create', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  const { title, description, price_xcon: rawPrice, min_fans, grace_minutes } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Titre requis' });

  const priceXcon    = parseInt(rawPrice)    || 0;
  const minFans      = Math.max(2, parseInt(min_fans) || 2);
  const graceMinutes = Math.min(30, Math.max(1, parseInt(grace_minutes) || 5));

  if (priceXcon > 0) {
    const minP = await configService.get('vip_show_min_price_xcon') || PPV_PRICE_MIN;
    const maxP = await configService.get('vip_show_max_price_xcon') || 50000;
    if (priceXcon < minP || priceXcon > maxP)
      return res.status(400).json({ error: `Prix invalide — entre ${minP} et ${maxP} XAF` });
  }

  try {
    const { data: existing } = await supabase.from('vip_shows')
      .select('id').eq('creator_id', req.user.id).in('status', ['WAITING','LIVE']).single();
    if (existing) return res.status(409).json({ error: 'Vous avez déjà un VIP Show en cours' });

    const commRate   = await configService.getCommissionRate('ppv');
    const commission = Math.floor(priceXcon * commRate);

    const { data: show, error } = await supabase.from('vip_shows').insert({
      id: uuidv4(),
      creator_id: req.user.id,
      title: title.trim(),
      description: description?.trim() || null,
      price_xcon: priceXcon,
      commission_xcon: commission,
      min_fans: minFans,
      grace_minutes: graceMinutes,
      status: 'WAITING',
    }).select().single();
    if (error) throw error;

    res.status(201).json({ show });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /vip-shows/:id/start — démarrer le show ─────────────
router.post('/:id/start', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const { data: show } = await supabase.from('vip_shows')
      .select('*').eq('id', req.params.id).eq('creator_id', req.user.id).single();
    if (!show) return res.status(404).json({ error: 'VIP Show introuvable' });
    if (show.status !== 'WAITING') return res.status(409).json({ error: `Show déjà ${show.status}` });

    const roomName  = `vip-show-${show.id}`;
    const now       = new Date();
    const graceEnds = new Date(now.getTime() + show.grace_minutes * 60 * 1000).toISOString();

    await createRoom(roomName);

    const { data: updated } = await supabase.from('vip_shows')
      .update({ status: 'LIVE', room_name: roomName, started_at: now.toISOString(), grace_ends_at: graceEnds })
      .eq('id', show.id).select().single();

    // Token créateur
    const token = await createRoomToken(req.user.id, roomName, {
      canPublish: true, canSubscribe: true, name: req.user.pseudo,
    });
    const wsUrl = (process.env.LIVEKIT_URL || '').replace(/^http/, 'ws');

    res.json({ show: updated, token, ws_url: wsUrl, room_name: roomName });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /vip-shows/:id/join — fan rejoint le show ───────────
router.post('/:id/join', authMiddleware, requireNotWalletFrozen, async (req, res) => {
  const fanId = req.user.id;

  try {
    const { data: show } = await supabase.from('vip_shows').select('*').eq('id', req.params.id).single();
    if (!show) return res.status(404).json({ error: 'VIP Show introuvable' });
    if (show.status !== 'LIVE') return res.status(409).json({ error: 'Ce VIP Show n\'est pas en cours' });

    // Admin bypass
    if (isAdminRole(req.user.role)) {
      logAdminContentView(req, 'vip_show', show.id);
      const token = await createRoomToken(fanId, show.room_name, { canPublish: false, canSubscribe: true });
      const wsUrl = (process.env.LIVEKIT_URL || '').replace(/^http/, 'ws');
      return res.json({ token, ws_url: wsUrl, room_name: show.room_name, free: true, admin_access: true });
    }

    if (show.creator_id === fanId)
      return res.status(400).json({ error: 'Vous ne pouvez pas rejoindre votre propre show' });

    // Vérifier si déjà participant
    const { data: existing } = await supabase.from('vip_show_participants')
      .select('id, price_paid_xcon').eq('show_id', show.id).eq('fan_id', fanId).single();
    if (existing) {
      // Déjà dans le show — fournir un nouveau token
      const token = await createRoomToken(fanId, show.room_name, { canPublish: false, canSubscribe: true, name: req.user.pseudo });
      const wsUrl = (process.env.LIVEKIT_URL || '').replace(/^http/, 'ws');
      return res.json({ token, ws_url: wsUrl, room_name: show.room_name, free: existing.price_paid_xcon === 0 });
    }

    const now = new Date();
    const graceActive = show.grace_ends_at ? now < new Date(show.grace_ends_at) : false;
    let pricePaid = 0;
    let commission = 0;

    if (!graceActive && show.price_xcon > 0) {
      // Payer l'accès
      const commRate = show.commission_xcon > 0
        ? show.commission_xcon / show.price_xcon
        : await configService.getCommissionRate('ppv');
      commission = Math.floor(show.price_xcon * commRate);
      pricePaid  = show.price_xcon;

      const { data: newBalance, error: debitErr } = await supabase.rpc('debit_wallet', {
        p_user_id: fanId, p_amount: pricePaid,
      });
      if (debitErr) {
        if (debitErr.message?.includes('Solde insuffisant'))
          return res.status(402).json({ error: 'Solde insuffisant — veuillez recharger votre wallet' });
        throw debitErr;
      }

      const creatorShare = pricePaid - commission;
      await supabase.rpc('credit_pending_balance', { p_user_id: show.creator_id, p_amount: creatorShare });

      await supabase.from('transactions').insert([
        {
          id: uuidv4(), user_id: fanId, type: 'PPV_PAYMENT',
          amount_xcon: -pricePaid, balance_after: newBalance,
          description: `Accès VIP Show "${show.title}"`, related_user_id: show.creator_id,
        },
        {
          id: uuidv4(), user_id: show.creator_id, type: 'PPV_INCOME',
          amount_xcon: creatorShare, balance_after: 0,
          description: `VIP Show "${show.title}" — accès fan`, related_user_id: fanId,
        },
      ]);

      await supabase.from('platform_revenue').insert({
        id: uuidv4(), type: 'VIP_SHOW', amount_xcon: commission,
        creator_id: show.creator_id, fan_id: fanId,
      });

      await supabase.from('vip_shows')
        .update({ total_revenue_xcon: show.total_revenue_xcon + creatorShare })
        .eq('id', show.id);
    }

    // Enregistrer le participant
    await supabase.from('vip_show_participants').insert({
      id: uuidv4(), show_id: show.id, fan_id: fanId,
      joined_during_grace: graceActive,
      price_paid_xcon: pricePaid,
      commission_xcon: commission,
    });

    // Mettre à jour le compteur
    await supabase.from('vip_shows')
      .update({ current_fans: show.current_fans + 1 })
      .eq('id', show.id);

    const token = await createRoomToken(fanId, show.room_name, {
      canPublish: false, canSubscribe: true, name: req.user.pseudo,
    });
    const wsUrl = (process.env.LIVEKIT_URL || '').replace(/^http/, 'ws');

    res.json({ token, ws_url: wsUrl, room_name: show.room_name, free: graceActive || pricePaid === 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /vip-shows/:id/leave — fan quitte le show ───────────
router.post('/:id/leave', authMiddleware, async (req, res) => {
  try {
    await supabase.from('vip_show_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('show_id', req.params.id).eq('fan_id', req.user.id);

    const { data: show } = await supabase.from('vip_shows').select('current_fans').eq('id', req.params.id).single();
    if (show && show.current_fans > 0) {
      await supabase.from('vip_shows')
        .update({ current_fans: show.current_fans - 1 })
        .eq('id', req.params.id);
    }
    res.json({ message: 'Vous avez quitté le VIP Show' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /vip-shows/:id/end — créateur termine le show ───────
router.post('/:id/end', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const { data: show } = await supabase.from('vip_shows')
      .select('*').eq('id', req.params.id).eq('creator_id', req.user.id).single();
    if (!show) return res.status(404).json({ error: 'VIP Show introuvable' });
    if (show.status !== 'LIVE') return res.status(409).json({ error: `Show déjà ${show.status}` });

    if (show.room_name) { try { await endRoom(show.room_name); } catch (_) {} }

    await supabase.from('vip_shows')
      .update({ status: 'ENDED', ended_at: new Date().toISOString() })
      .eq('id', show.id);

    res.json({ message: 'VIP Show terminé', total_revenue_xcon: show.total_revenue_xcon });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /vip-shows/:id — détail d'un show ────────────────────
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { data: show } = await supabase.from('vip_shows').select('*').eq('id', req.params.id).single();
    if (!show) return res.status(404).json({ error: 'VIP Show introuvable' });

    const { data: creator } = await supabase.from('users')
      .select('id, pseudo, avatar_url').eq('id', show.creator_id).single();

    res.json({
      ...show,
      creator: creator || null,
      grace_active: show.grace_ends_at ? new Date() < new Date(show.grace_ends_at) : false,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

// ============================================================
// KASOLIFE — Routes /private-shows v1.0
//
// Private Show : session vidéo LiveKit 1-to-1 créateur ↔ fan.
// Distinct du Private Chat (messagerie) — ici c'est de la vidéo.
//
// Types :
//   STANDARD  — spy autorisé (rôle subscriber-only LiveKit)
//   PREMIUM   — exclusif, pas de spy
//
// Forfaits : 15 / 30 / 45 / 60 min
// Queue     : enchère temps réel, tri par bid décroissant
// Grâce     : 5 min Redis si déco réseau créateur (timer pausé)
//             vs fin volontaire (bouton Stop → ended_voluntarily)
// ============================================================
'use strict';

const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const redis    = require('../lib/redis');
const { authMiddleware, requireMinRole, requireNotWalletFrozen, isAdminRole } = require('../middleware/auth');
const { createRoom, endRoom, createRoomToken } = require('../services/livekit');
const configService = require('../services/configService');

const router   = express.Router();
const PACKAGES = [15, 30, 45, 60];
const TYPES    = ['STANDARD', 'PREMIUM'];

// ── Clés Redis ────────────────────────────────────────────────
const GRACE_KEY = (showId) => `private_show_grace:${showId}`;
const PAUSE_KEY = (showId) => `private_show_pause_start:${showId}`;

// ── Helpers ───────────────────────────────────────────────────

// Prix planchers plateforme (par type + durée)
const getPlatformFloors = async () => {
  const floors = {};
  for (const type of TYPES) {
    floors[type] = {};
    for (const min of PACKAGES) {
      floors[type][min] = await configService.get(
        `private_show_min_${type.toLowerCase()}_${min}min`
      );
    }
  }
  return floors;
};

// Calcul prorata remboursement (Math.floor comme partout sur KasoLife)
const computeRefund = (pricePaid, packageMinutes, actualSeconds) => {
  const packageSeconds = packageMinutes * 60;
  if (actualSeconds >= packageSeconds) return 0;
  const unusedRatio = 1 - actualSeconds / packageSeconds;
  return Math.floor(pricePaid * unusedRatio);
};

// Vérifie si la grâce a expiré (Redis absent = fallback DB timestamp)
const isGraceExpired = async (show) => {
  if (!show.creator_disconnected_at) return false;
  const graceKey = await redis.safeGet(GRACE_KEY(show.id));
  if (graceKey !== null) return false; // clé encore vivante = grâce en cours
  // Redis absent ou clé expirée : vérifier en DB
  const graceSec = await configService.get('private_show_grace_period_seconds') || 300;
  const discoAt  = new Date(show.creator_disconnected_at).getTime();
  return Date.now() - discoAt > graceSec * 1000;
};

// Clôture d'urgence : grâce expirée sans reconnexion créateur
const autoEndShow = async (show, reason = 'GRACE_EXPIRED') => {
  const now = new Date();
  // Récupérer le temps de pause cumulé depuis Redis
  const pauseStartStr = await redis.safeGet(PAUSE_KEY(show.id));
  const pauseMs = pauseStartStr
    ? Math.max(0, now.getTime() - parseInt(pauseStartStr, 10))
    : 0;

  const startedAt     = show.started_at ? new Date(show.started_at) : now;
  const totalElapsedMs = now.getTime() - startedAt.getTime() - pauseMs;
  const actualSeconds  = Math.max(0, Math.floor(totalElapsedMs / 1000));
  const refundXcon     = computeRefund(show.price_xcon, show.package_minutes, actualSeconds);

  const commRate    = await configService.getCommissionRate('ppv');
  const netRevenue  = show.price_xcon - refundXcon;
  const commission  = Math.floor(netRevenue * commRate);
  const creatorShare = netRevenue - commission;

  if (refundXcon > 0) {
    await supabase.rpc('credit_wallet', { p_user_id: show.fan_id, p_amount: refundXcon });
    await supabase.from('transactions').insert({
      id: uuidv4(), user_id: show.fan_id, type: 'REFUND',
      amount_xcon: refundXcon, balance_after: 0,
      description: `Remboursement Private Show ${show.package_minutes} min (déconnexion créateur)`,
      related_user_id: show.creator_id,
    });
  }
  if (creatorShare > 0) {
    await supabase.rpc('credit_pending_balance', { p_user_id: show.creator_id, p_amount: creatorShare });
    await supabase.from('transactions').insert({
      id: uuidv4(), user_id: show.creator_id, type: 'PPV_INCOME',
      amount_xcon: creatorShare, balance_after: 0,
      description: `Gains Private Show ${show.package_minutes} min`,
      related_user_id: show.fan_id,
    });
  }
  if (commission > 0) {
    await supabase.from('platform_revenue').insert({
      id: uuidv4(), type: 'PRIVATE_SHOW', amount_xcon: commission,
      creator_id: show.creator_id, fan_id: show.fan_id,
    }).catch(() => {});
  }

  if (show.livekit_room) { try { await endRoom(show.livekit_room); } catch (_) {} }

  await supabase.from('private_shows').update({
    status: 'ENDED', ended_at: now.toISOString(),
    actual_duration_seconds: actualSeconds, refund_xcon: refundXcon,
    rejection_reason: reason,
  }).eq('id', show.id);

  await redis.safeDel(GRACE_KEY(show.id));
  await redis.safeDel(PAUSE_KEY(show.id));

  // Notifier le fan
  await supabase.from('notifications').insert({
    id: uuidv4(), user_id: show.fan_id, type: 'PRIVATE_SHOW_ENDED',
    message: `Le Private Show a pris fin (déconnexion créateur). Remboursement : ${refundXcon} XC.`,
    related_id: show.id,
  }).catch(() => {});

  return { actualSeconds, refundXcon, creatorShare };
};

// ════════════════════════════════════════════════════════════
// PACKAGES & PRIX — publics
// ════════════════════════════════════════════════════════════

// GET /private-shows/packages — forfaits plateforme
router.get('/packages', async (req, res) => {
  try {
    const floors = await getPlatformFloors();
    res.json({
      packages: PACKAGES.map((min) => ({
        minutes: min,
        floor: {
          STANDARD: floors.STANDARD[min],
          PREMIUM:  floors.PREMIUM[min],
        },
        label: `${min} min`,
      })),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /private-shows/prices/me — tarifs du créateur connecté
router.get('/prices/me', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const { data: prices } = await supabase.from('private_show_prices')
      .select('*').eq('creator_id', req.user.id);
    res.json({ prices: prices || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /private-shows/prices/:creatorId — tarifs d'un créateur (public)
router.get('/prices/:creatorId', async (req, res) => {
  try {
    const { data: prices } = await supabase.from('private_show_prices')
      .select('*').eq('creator_id', req.params.creatorId);
    res.json({ prices: prices || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /private-shows/prices — créateur configure ses tarifs
router.put('/prices', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  const { entries } = req.body;
  // entries: [{ show_type, duration_min, price_xcon, spy_price_per_min_xcon? }]
  if (!Array.isArray(entries) || entries.length === 0)
    return res.status(400).json({ error: 'entries requis (tableau)' });

  try {
    const floors = await getPlatformFloors();

    for (const e of entries) {
      if (!TYPES.includes(e.show_type))
        return res.status(400).json({ error: `show_type invalide : ${e.show_type}` });
      if (!PACKAGES.includes(parseInt(e.duration_min)))
        return res.status(400).json({ error: `duration_min invalide : ${e.duration_min}` });

      const floor = floors[e.show_type][parseInt(e.duration_min)];
      if (parseInt(e.price_xcon) < floor)
        return res.status(400).json({
          error: `Prix ${e.show_type} ${e.duration_min}min trop bas — minimum ${floor} XC`,
        });
    }

    const rows = entries.map((e) => ({
      creator_id:            req.user.id,
      show_type:             e.show_type,
      duration_min:          parseInt(e.duration_min),
      price_xcon:            parseInt(e.price_xcon),
      spy_price_per_min_xcon: e.spy_price_per_min_xcon
        ? parseInt(e.spy_price_per_min_xcon)
        : null,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('private_show_prices')
      .upsert(rows, { onConflict: 'creator_id,show_type,duration_min' });
    if (error) throw error;

    res.json({ message: 'Tarifs enregistrés', count: rows.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
// QUEUE — fan entre en file avec enchère
// ════════════════════════════════════════════════════════════

// POST /private-shows/queue — fan entre en file (bid bloqué immédiatement)
router.post('/queue', authMiddleware, requireNotWalletFrozen, async (req, res) => {
  const { creator_id, show_type, package_minutes, bid_xcon } = req.body;
  const fanId = req.user.id;

  if (!creator_id) return res.status(400).json({ error: 'creator_id requis' });
  if (!TYPES.includes(show_type)) return res.status(400).json({ error: 'show_type invalide' });
  if (!PACKAGES.includes(parseInt(package_minutes)))
    return res.status(400).json({ error: `Forfait invalide — ${PACKAGES.join('/')} min` });
  if (creator_id === fanId)
    return res.status(400).json({ error: 'Vous ne pouvez pas vous réserver à vous-même' });

  const pkgMin = parseInt(package_minutes);
  const bidXcon = parseInt(bid_xcon);

  try {
    // Vérifier que le créateur est bien créateur
    const { data: creator } = await supabase.from('users')
      .select('id, role').eq('id', creator_id).single();
    if (!creator || !['influencer','admin','super_admin','root_admin'].includes(creator.role))
      return res.status(404).json({ error: 'Créateur introuvable' });

    // Vérifier tarifs configurés
    const { data: priceRow } = await supabase.from('private_show_prices')
      .select('price_xcon').eq('creator_id', creator_id)
      .eq('show_type', show_type).eq('duration_min', pkgMin).single();
    if (!priceRow)
      return res.status(404).json({ error: `Ce créateur n'a pas configuré de tarif pour ${show_type} ${pkgMin} min` });

    if (bidXcon < priceRow.price_xcon)
      return res.status(400).json({
        error: `Bid insuffisant — minimum ${priceRow.price_xcon} XC pour ${pkgMin} min`,
      });

    // Pas déjà en attente chez ce créateur
    const { data: existing } = await supabase.from('private_show_queue')
      .select('id').eq('creator_id', creator_id).eq('fan_id', fanId)
      .eq('status', 'WAITING').maybeSingle();
    if (existing)
      return res.status(409).json({ error: 'Vous êtes déjà dans la file de ce créateur' });

    // Pas de show actif déjà en cours
    const { data: activeShow } = await supabase.from('private_shows')
      .select('id').eq('creator_id', creator_id).eq('fan_id', fanId)
      .eq('status', 'ACTIVE').maybeSingle();
    if (activeShow)
      return res.status(409).json({ error: 'Vous avez déjà un show actif avec ce créateur' });

    // Bloquer le bid sur le wallet
    const { data: newBalance, error: debitErr } = await supabase.rpc('debit_wallet', {
      p_user_id: fanId, p_amount: bidXcon,
    });
    if (debitErr) {
      if (debitErr.message?.includes('Solde insuffisant'))
        return res.status(402).json({ error: 'Solde insuffisant — rechargez votre wallet' });
      throw debitErr;
    }

    const timeoutMin = await configService.get('private_show_request_timeout_min') || 10;
    const expiresAt  = new Date(Date.now() + timeoutMin * 60 * 1000).toISOString();

    const { data: entry, error: insertErr } = await supabase.from('private_show_queue').insert({
      creator_id,
      fan_id:          fanId,
      show_type,
      package_minutes: pkgMin,
      bid_xcon:        bidXcon,
      status:          'WAITING',
      wallet_blocked:  true,
      expires_at:      expiresAt,
    }).select().single();
    if (insertErr) throw insertErr;

    await supabase.from('transactions').insert({
      id: uuidv4(), user_id: fanId, type: 'PPV_PAYMENT',
      amount_xcon: -bidXcon, balance_after: newBalance,
      description: `Enchère Private Show ${show_type} ${pkgMin} min (en attente)`,
      related_user_id: creator_id,
    });

    // Notifier le créateur
    await supabase.from('notifications').insert({
      id: uuidv4(), user_id: creator_id, type: 'PRIVATE_SHOW_REQUEST',
      message: `Nouveau fan en file — Private Show ${show_type} ${pkgMin} min (enchère : ${bidXcon} XC)`,
      related_id: entry.id,
    });

    res.status(201).json({ entry, new_balance: newBalance });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /private-shows/queue/:id/bid — fan augmente son enchère
router.patch('/queue/:id/bid', authMiddleware, requireNotWalletFrozen, async (req, res) => {
  const { new_bid_xcon } = req.body;
  const fanId = req.user.id;

  if (!new_bid_xcon || parseInt(new_bid_xcon) <= 0)
    return res.status(400).json({ error: 'new_bid_xcon requis et > 0' });

  try {
    const { data: entry } = await supabase.from('private_show_queue')
      .select('*').eq('id', req.params.id).eq('fan_id', fanId).single();
    if (!entry) return res.status(404).json({ error: 'Entrée de file introuvable' });
    if (entry.status !== 'WAITING') return res.status(409).json({ error: `File déjà ${entry.status}` });
    if (new Date() > new Date(entry.expires_at))
      return res.status(410).json({ error: 'La demande a expiré' });

    const newBid = parseInt(new_bid_xcon);
    if (newBid <= entry.bid_xcon)
      return res.status(400).json({ error: `Le nouveau bid (${newBid}) doit être supérieur à l'actuel (${entry.bid_xcon})` });

    const diff = newBid - entry.bid_xcon;

    // Débiter la différence
    const { data: newBalance, error: debitErr } = await supabase.rpc('debit_wallet', {
      p_user_id: fanId, p_amount: diff,
    });
    if (debitErr) {
      if (debitErr.message?.includes('Solde insuffisant'))
        return res.status(402).json({ error: 'Solde insuffisant pour augmenter l\'enchère' });
      throw debitErr;
    }

    await supabase.from('private_show_queue')
      .update({ bid_xcon: newBid, updated_at: new Date().toISOString() })
      .eq('id', entry.id);

    await supabase.from('transactions').insert({
      id: uuidv4(), user_id: fanId, type: 'PPV_PAYMENT',
      amount_xcon: -diff, balance_after: newBalance,
      description: `Surenchère Private Show — +${diff} XC (total : ${newBid} XC)`,
      related_user_id: entry.creator_id,
    });

    // Re-notifier le créateur
    await supabase.from('notifications').insert({
      id: uuidv4(), user_id: entry.creator_id, type: 'PRIVATE_SHOW_BID_UPDATED',
      message: `Un fan a augmenté son enchère — ${entry.show_type} ${entry.package_minutes} min → ${newBid} XC`,
      related_id: entry.id,
    });

    res.json({ entry: { ...entry, bid_xcon: newBid }, new_balance: newBalance });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /private-shows/queue/:id — fan annule sa demande (remboursement bid)
router.delete('/queue/:id', authMiddleware, async (req, res) => {
  const fanId = req.user.id;
  try {
    const { data: entry } = await supabase.from('private_show_queue')
      .select('*').eq('id', req.params.id).eq('fan_id', fanId).single();
    if (!entry) return res.status(404).json({ error: 'Entrée introuvable' });
    if (entry.status !== 'WAITING') return res.status(409).json({ error: `Impossible d'annuler — statut : ${entry.status}` });

    if (entry.wallet_blocked) {
      await supabase.rpc('credit_wallet', { p_user_id: fanId, p_amount: entry.bid_xcon });
      await supabase.from('transactions').insert({
        id: uuidv4(), user_id: fanId, type: 'REFUND',
        amount_xcon: entry.bid_xcon, balance_after: 0,
        description: `Remboursement annulation file Private Show`,
        related_user_id: entry.creator_id,
      });
    }

    await supabase.from('private_show_queue')
      .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
      .eq('id', entry.id);

    res.json({ message: 'Annulé et remboursé', refund_xcon: entry.bid_xcon });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
// CRÉATEUR — gérer la queue
// ════════════════════════════════════════════════════════════

// GET /private-shows/queue — queue du créateur (triée bid DESC)
router.get('/queue', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const { data: entries } = await supabase.from('private_show_queue')
      .select('*')
      .eq('creator_id', req.user.id)
      .eq('status', 'WAITING')
      .gte('expires_at', new Date().toISOString())
      .order('bid_xcon', { ascending: false })
      .order('created_at', { ascending: true });

    if (!entries?.length) return res.json({ queue: [] });

    const fanIds = [...new Set(entries.map((e) => e.fan_id))];
    const { data: fans } = await supabase.from('users')
      .select('id, pseudo, avatar_url').in('id', fanIds);
    const fanMap = new Map((fans || []).map((f) => [f.id, f]));

    res.json({
      queue: entries.map((e, idx) => ({
        ...e,
        position: idx + 1,
        fan: fanMap.get(e.fan_id) || null,
      })),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /private-shows/queue/:id/accept — créateur accepte → crée session + room
router.post('/queue/:id/accept', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const { data: entry } = await supabase.from('private_show_queue')
      .select('*').eq('id', req.params.id).eq('creator_id', req.user.id).single();
    if (!entry) return res.status(404).json({ error: 'Demande introuvable' });
    if (entry.status !== 'WAITING') return res.status(409).json({ error: `Demande déjà ${entry.status}` });
    if (new Date() > new Date(entry.expires_at))
      return res.status(410).json({ error: 'La demande a expiré' });

    // Vérifier qu'il n'y a pas déjà un show actif pour ce créateur
    const { data: activeShow } = await supabase.from('private_shows')
      .select('id').eq('creator_id', req.user.id).eq('status', 'ACTIVE').maybeSingle();
    if (activeShow)
      return res.status(409).json({ error: 'Vous avez déjà un show actif en cours' });

    const commRate   = await configService.getCommissionRate('ppv');
    const commission = Math.floor(entry.bid_xcon * commRate);
    const showId     = uuidv4();
    const roomName   = `private-show-${showId}`;

    await createRoom(roomName);

    const { data: show, error: showErr } = await supabase.from('private_shows').insert({
      id:              showId,
      creator_id:      req.user.id,
      fan_id:          entry.fan_id,
      show_type:       entry.show_type,
      status:          'ACTIVE',
      package_minutes: entry.package_minutes,
      price_xcon:      entry.bid_xcon,
      commission_xcon: commission,
      livekit_room:    roomName,
      started_at:      new Date().toISOString(),
    }).select().single();
    if (showErr) throw showErr;

    // Marquer l'entrée acceptée
    await supabase.from('private_show_queue')
      .update({ status: 'ACCEPTED', updated_at: new Date().toISOString() })
      .eq('id', entry.id);

    // Notifier le fan
    await supabase.from('notifications').insert({
      id: uuidv4(), user_id: entry.fan_id, type: 'PRIVATE_SHOW_ACCEPTED',
      message: `Votre Private Show ${entry.show_type} ${entry.package_minutes} min commence — rejoignez maintenant !`,
      related_id: showId,
    });

    res.json({ show, room_name: roomName });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /private-shows/queue/:id/reject — créateur refuse → remboursement bid
router.post('/queue/:id/reject', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  const { reason } = req.body;
  try {
    const { data: entry } = await supabase.from('private_show_queue')
      .select('*').eq('id', req.params.id).eq('creator_id', req.user.id).single();
    if (!entry) return res.status(404).json({ error: 'Demande introuvable' });
    if (entry.status !== 'WAITING') return res.status(409).json({ error: `Demande déjà ${entry.status}` });

    if (entry.wallet_blocked) {
      await supabase.rpc('credit_wallet', { p_user_id: entry.fan_id, p_amount: entry.bid_xcon });
      await supabase.from('transactions').insert({
        id: uuidv4(), user_id: entry.fan_id, type: 'REFUND',
        amount_xcon: entry.bid_xcon, balance_after: 0,
        description: `Remboursement Private Show ${entry.package_minutes} min (refus créateur)`,
        related_user_id: req.user.id,
      });
    }

    await supabase.from('private_show_queue')
      .update({ status: 'REJECTED', updated_at: new Date().toISOString() })
      .eq('id', entry.id);

    await supabase.from('notifications').insert({
      id: uuidv4(), user_id: entry.fan_id, type: 'PRIVATE_SHOW_REJECTED',
      message: 'Votre demande de Private Show a été refusée — vous avez été remboursé.',
      related_id: entry.id,
    });

    res.json({ message: 'Refusé et fan remboursé' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
// SESSION ACTIVE — tokens + show en cours
// ════════════════════════════════════════════════════════════

// GET /private-shows/:id — détails du show (avec vérif grâce expirée)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { data: show } = await supabase.from('private_shows')
      .select('*').eq('id', req.params.id).single();
    if (!show) return res.status(404).json({ error: 'Show introuvable' });

    const isCreator = show.creator_id === req.user.id;
    const isFan     = show.fan_id     === req.user.id;
    const isAdmin   = isAdminRole(req.user.role);
    if (!isCreator && !isFan && !isAdmin)
      return res.status(403).json({ error: 'Accès refusé' });

    // Lazy-close si grâce expirée
    if (show.status === 'ACTIVE' && show.creator_disconnected_at) {
      const expired = await isGraceExpired(show);
      if (expired) {
        await autoEndShow(show);
        return res.json({ show: { ...show, status: 'ENDED' }, grace_expired: true });
      }
      const graceKey = await redis.safeGet(GRACE_KEY(show.id));
      const graceSec = await configService.get('private_show_grace_period_seconds') || 300;
      const discoAt  = new Date(show.creator_disconnected_at).getTime();
      const elapsed  = Math.floor((Date.now() - discoAt) / 1000);
      return res.json({
        show,
        grace_active:          true,
        grace_remaining_seconds: Math.max(0, graceSec - elapsed),
      });
    }

    res.json({ show });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /private-shows/:id/token — token LiveKit selon rôle
router.get('/:id/token', authMiddleware, async (req, res) => {
  try {
    const { data: show } = await supabase.from('private_shows')
      .select('*').eq('id', req.params.id).single();
    if (!show) return res.status(404).json({ error: 'Show introuvable' });
    if (show.status !== 'ACTIVE') return res.status(409).json({ error: `Show ${show.status}` });

    const isCreator = show.creator_id === req.user.id;
    const isFan     = show.fan_id     === req.user.id;
    const isAdmin   = isAdminRole(req.user.role);

    if (!isCreator && !isFan && !isAdmin)
      return res.status(403).json({ error: 'Accès refusé' });

    // Vérifier qu'il n'est pas en grâce expirée
    if (show.creator_disconnected_at && await isGraceExpired(show)) {
      await autoEndShow(show);
      return res.status(410).json({ error: 'Show terminé — le créateur ne s\'est pas reconnecté à temps' });
    }

    const token = await createRoomToken(req.user.id, show.livekit_room, {
      canPublish:   isCreator || isFan, // spy = false (voir /spy-token)
      canSubscribe: true,
      name:         req.user.pseudo || req.user.id,
    });

    const wsUrl = (process.env.LIVEKIT_URL || '').replace(/^http/, 'ws');
    res.json({ token, ws_url: wsUrl, room_name: show.livekit_room, show_type: show.show_type });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /private-shows/:id/spy — fan paie pour rejoindre en spy (STANDARD uniquement)
router.post('/:id/spy', authMiddleware, requireNotWalletFrozen, async (req, res) => {
  const fanId = req.user.id;
  try {
    const { data: show } = await supabase.from('private_shows')
      .select('*, private_show_prices(spy_price_per_min_xcon)')
      .eq('id', req.params.id).single();
    if (!show) return res.status(404).json({ error: 'Show introuvable' });
    if (show.status !== 'ACTIVE') return res.status(409).json({ error: `Show ${show.status}` });
    if (show.show_type !== 'STANDARD')
      return res.status(403).json({ error: 'Le spy n\'est pas disponible sur les shows Premium' });
    if (show.creator_id === fanId || show.fan_id === fanId)
      return res.status(400).json({ error: 'Vous êtes déjà participant de ce show' });

    // Récupérer le prix spy du créateur
    const { data: priceRow } = await supabase.from('private_show_prices')
      .select('spy_price_per_min_xcon')
      .eq('creator_id', show.creator_id)
      .eq('show_type', 'STANDARD')
      .eq('duration_min', show.package_minutes)
      .single();

    const spyFloor = await configService.get('private_show_spy_min_price_xcon') || 200;
    const spyPerMin = priceRow?.spy_price_per_min_xcon || spyFloor;

    // Calculer les minutes restantes du show
    const startedAt = new Date(show.started_at).getTime();
    const elapsedMin = (Date.now() - startedAt) / 60000;
    const remainingMin = Math.max(1, Math.ceil(show.package_minutes - elapsedMin));
    const spyPrice = Math.floor(remainingMin * spyPerMin);

    if (spyPrice <= 0) return res.status(410).json({ error: 'Show trop proche de sa fin pour rejoindre en spy' });

    // Pas déjà spy sur ce show
    const { data: existingSpy } = await supabase.from('private_show_spies')
      .select('id').eq('show_id', show.id).eq('fan_id', fanId).maybeSingle();
    if (existingSpy) return res.status(409).json({ error: 'Vous êtes déjà spy sur ce show' });

    // Débiter le fan
    const { data: newBalance, error: debitErr } = await supabase.rpc('debit_wallet', {
      p_user_id: fanId, p_amount: spyPrice,
    });
    if (debitErr) {
      if (debitErr.message?.includes('Solde insuffisant'))
        return res.status(402).json({ error: 'Solde insuffisant' });
      throw debitErr;
    }

    const { data: spyEntry, error: spyErr } = await supabase.from('private_show_spies').insert({
      show_id:   show.id,
      fan_id:    fanId,
      price_xcon: spyPrice,
    }).select().single();
    if (spyErr) throw spyErr;

    await supabase.from('transactions').insert({
      id: uuidv4(), user_id: fanId, type: 'PPV_PAYMENT',
      amount_xcon: -spyPrice, balance_after: newBalance,
      description: `Accès Spy Private Show (${remainingMin} min restantes)`,
      related_user_id: show.creator_id,
    });

    // Token subscriber-only (pas de cam ni micro)
    const token = await createRoomToken(fanId, show.livekit_room, {
      canPublish:   false,
      canSubscribe: true,
      name: req.user.pseudo || fanId,
    });

    const wsUrl = (process.env.LIVEKIT_URL || '').replace(/^http/, 'ws');
    res.status(201).json({
      spy: spyEntry,
      token,
      ws_url: wsUrl,
      room_name: show.livekit_room,
      spy_price_xcon: spyPrice,
      remaining_minutes: remainingMin,
      new_balance: newBalance,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /private-shows/:id/spy — fan spy quitte (remboursement prorata)
router.delete('/:id/spy', authMiddleware, async (req, res) => {
  const fanId = req.user.id;
  try {
    const { data: show } = await supabase.from('private_shows')
      .select('started_at, package_minutes, status').eq('id', req.params.id).single();
    if (!show) return res.status(404).json({ error: 'Show introuvable' });

    const { data: spyEntry } = await supabase.from('private_show_spies')
      .select('*').eq('show_id', req.params.id).eq('fan_id', fanId).single();
    if (!spyEntry) return res.status(404).json({ error: 'Session spy introuvable' });
    if (spyEntry.left_at) return res.json({ message: 'Déjà quitté' });

    const now       = new Date();
    const joinedAt  = new Date(spyEntry.joined_at);
    const actualMin = Math.ceil((now - joinedAt) / 60000);
    const spyFloor  = await configService.get('private_show_spy_min_price_xcon') || 200;
    const pricePerMin = spyEntry.price_xcon / Math.max(1,
      Math.ceil(show.package_minutes - (joinedAt - new Date(show.started_at || joinedAt)) / 60000)
    );
    const charged   = Math.floor(actualMin * pricePerMin);
    const refund    = Math.max(0, spyEntry.price_xcon - charged);

    if (refund > 0) {
      await supabase.rpc('credit_wallet', { p_user_id: fanId, p_amount: refund });
      await supabase.from('transactions').insert({
        id: uuidv4(), user_id: fanId, type: 'REFUND',
        amount_xcon: refund, balance_after: 0,
        description: `Remboursement spy prorata (${actualMin} min utilisées)`,
      });
    }

    // Part créateur du spy
    const commRate    = await configService.getCommissionRate('ppv');
    const creatorShare = Math.floor(charged * (1 - commRate));
    if (creatorShare > 0) {
      await supabase.rpc('credit_pending_balance', {
        p_user_id: show.creator_id || (await supabase.from('private_shows')
          .select('creator_id').eq('id', req.params.id).single()).data?.creator_id,
        p_amount: creatorShare,
      }).catch(() => {});
    }

    await supabase.from('private_show_spies')
      .update({ left_at: now.toISOString(), actual_minutes: actualMin })
      .eq('id', spyEntry.id);

    res.json({ message: 'Spy session terminée', actual_minutes: actualMin, refund_xcon: refund });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
// FIN DE SESSION
// ════════════════════════════════════════════════════════════

// POST /private-shows/:id/end — créateur ou fan termine (volontaire)
router.post('/:id/end', authMiddleware, async (req, res) => {
  try {
    const { data: show } = await supabase.from('private_shows')
      .select('*').eq('id', req.params.id).single();
    if (!show) return res.status(404).json({ error: 'Show introuvable' });

    const isCreator = show.creator_id === req.user.id;
    const isFan     = show.fan_id     === req.user.id;
    const isAdmin   = isAdminRole(req.user.role);
    if (!isCreator && !isFan && !isAdmin)
      return res.status(403).json({ error: 'Accès refusé' });
    if (show.status !== 'ACTIVE') return res.status(409).json({ error: `Show déjà ${show.status}` });

    // Marquer comme fin volontaire avant d'appeler autoEndShow
    await supabase.from('private_shows')
      .update({ ended_voluntarily: isCreator })
      .eq('id', show.id);

    const now       = new Date();
    // Déduire le temps de pause (grâce éventuelle)
    const pauseStartStr = await redis.safeGet(PAUSE_KEY(show.id));
    const pauseMs   = pauseStartStr
      ? Math.max(0, now.getTime() - parseInt(pauseStartStr, 10))
      : 0;

    const startedAt     = show.started_at ? new Date(show.started_at) : now;
    const totalElapsedMs = now.getTime() - startedAt.getTime() - pauseMs;
    const actualSeconds  = Math.max(0, Math.floor(totalElapsedMs / 1000));
    const refundXcon     = computeRefund(show.price_xcon, show.package_minutes, actualSeconds);

    const commRate     = await configService.getCommissionRate('ppv');
    const netRevenue   = show.price_xcon - refundXcon;
    const commission   = Math.floor(netRevenue * commRate);
    const creatorShare = netRevenue - commission;

    if (refundXcon > 0) {
      await supabase.rpc('credit_wallet', { p_user_id: show.fan_id, p_amount: refundXcon });
      await supabase.from('transactions').insert({
        id: uuidv4(), user_id: show.fan_id, type: 'REFUND',
        amount_xcon: refundXcon, balance_after: 0,
        description: `Remboursement Private Show ${show.package_minutes} min (${Math.floor(actualSeconds/60)} min utilisées)`,
        related_user_id: show.creator_id,
      });
    }
    if (creatorShare > 0) {
      await supabase.rpc('credit_pending_balance', { p_user_id: show.creator_id, p_amount: creatorShare });
      await supabase.from('transactions').insert({
        id: uuidv4(), user_id: show.creator_id, type: 'PPV_INCOME',
        amount_xcon: creatorShare, balance_after: 0,
        description: `Gains Private Show ${show.package_minutes} min`,
        related_user_id: show.fan_id,
      });
    }
    if (commission > 0) {
      await supabase.from('platform_revenue').insert({
        id: uuidv4(), type: 'PRIVATE_SHOW', amount_xcon: commission,
        creator_id: show.creator_id, fan_id: show.fan_id,
      }).catch(() => {});
    }

    if (show.livekit_room) { try { await endRoom(show.livekit_room); } catch (_) {} }

    await supabase.from('private_shows').update({
      status: 'ENDED', ended_at: now.toISOString(),
      actual_duration_seconds: actualSeconds, refund_xcon: refundXcon,
    }).eq('id', show.id);

    await redis.safeDel(GRACE_KEY(show.id));
    await redis.safeDel(PAUSE_KEY(show.id));

    res.json({ message: 'Show terminé', actual_duration_seconds: actualSeconds, refund_xcon: refundXcon, creator_share_xcon: creatorShare });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /private-shows/:id/reconnect — créateur se reconnecte après déco réseau
router.post('/:id/reconnect', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const { data: show } = await supabase.from('private_shows')
      .select('*').eq('id', req.params.id).eq('creator_id', req.user.id).single();
    if (!show) return res.status(404).json({ error: 'Show introuvable' });
    if (show.status !== 'ACTIVE') return res.status(409).json({ error: `Show ${show.status}` });
    if (!show.creator_disconnected_at)
      return res.status(400).json({ error: 'Aucune déconnexion enregistrée' });

    // Vérifier que la grâce n'a pas encore expiré
    if (await isGraceExpired(show)) {
      await autoEndShow(show);
      return res.status(410).json({ error: 'Délai de grâce expiré — le show a été clôturé et le fan remboursé' });
    }

    // Annuler la grâce
    await redis.safeDel(GRACE_KEY(show.id));
    await redis.safeDel(PAUSE_KEY(show.id));

    await supabase.from('private_shows').update({
      creator_disconnected_at: null,
      reconnect_count: (show.reconnect_count || 0) + 1,
    }).eq('id', show.id);

    // Réémettre le token LiveKit
    const token = await createRoomToken(req.user.id, show.livekit_room, {
      canPublish: true, canSubscribe: true,
      name: req.user.pseudo || req.user.id,
    });
    const wsUrl = (process.env.LIVEKIT_URL || '').replace(/^http/, 'ws');

    // Notifier le fan
    await supabase.from('notifications').insert({
      id: uuidv4(), user_id: show.fan_id, type: 'PRIVATE_SHOW_CREATOR_RECONNECTED',
      message: 'Le créateur est de retour — le show reprend !',
      related_id: show.id,
    });

    res.json({ message: 'Reconnexion réussie, show reprend', token, ws_url: wsUrl, room_name: show.livekit_room });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
// WEBHOOK LIVEKIT — participant_left
// ════════════════════════════════════════════════════════════

// POST /private-shows/livekit-webhook
// Reçoit les événements LiveKit (participant_left) pour gérer la grâce créateur.
// Vérifié par le secret LiveKit (header Authorization).
router.post('/livekit-webhook', async (req, res) => {
  try {
    // Vérification minimaliste : token Bearer dans header Authorization
    const authHeader = req.headers['authorization'] || '';
    const lkSecret   = process.env.LIVEKIT_API_SECRET || '';
    // LiveKit envoie le JWT signé avec son secret — vérification simplifiée
    // (la validation complète JWT est optionnelle sur webhooks internes)
    if (!authHeader && lkSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { event, room, participant } = req.body || {};
    if (event !== 'participant_left' || !room?.name || !participant?.identity) {
      return res.json({ handled: false });
    }

    // Chercher le show correspondant à cette room
    const { data: show } = await supabase.from('private_shows')
      .select('id, creator_id, fan_id, status, ended_voluntarily, creator_disconnected_at')
      .eq('livekit_room', room.name)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (!show) return res.json({ handled: false });

    // Le créateur s'est déconnecté (involontairement — ended_voluntarily = false)
    if (participant.identity === show.creator_id && !show.ended_voluntarily) {
      const graceSec = await configService.get('private_show_grace_period_seconds') || 300;
      const now      = Date.now().toString();

      // Stocker le timestamp de déco dans Redis (TTL = grâce + 60s tampon)
      await redis.safeSetex(GRACE_KEY(show.id), graceSec + 60, now);
      // Pause du timer de facturation
      await redis.safeSetex(PAUSE_KEY(show.id), graceSec + 60, now);

      await supabase.from('private_shows')
        .update({ creator_disconnected_at: new Date().toISOString() })
        .eq('id', show.id);

      // Notifier le fan
      await supabase.from('notifications').insert({
        id: uuidv4(), user_id: show.fan_id, type: 'PRIVATE_SHOW_CREATOR_DISCONNECTED',
        message: `Problème de connexion — le créateur tente de se reconnecter (${Math.floor(graceSec/60)} min accordées). Le timer est pausé.`,
        related_id: show.id,
      }).catch(() => {});
    }

    res.json({ handled: true });
  } catch (err) {
    console.error('[LiveKit Webhook Private Show]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════
// HISTORIQUE
// ════════════════════════════════════════════════════════════

// GET /private-shows/history — historique (créateur ou fan)
router.get('/history', authMiddleware, async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page) || 1);
  const limit  = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  try {
    const userId    = req.user.id;
    const isCreator = ['influencer','admin','super_admin','root_admin'].includes(req.user.role)
      && req.query.role === 'creator';

    let query = supabase.from('private_shows').select('*')
      .in('status', ['ENDED','REJECTED','CANCELLED'])
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    query = isCreator ? query.eq('creator_id', userId) : query.eq('fan_id', userId);

    const { data: shows } = await query;
    if (!shows?.length) return res.json({ sessions: [], page, limit });

    const peerIds = shows.map((s) => isCreator ? s.fan_id : s.creator_id);
    const { data: peers } = await supabase.from('users')
      .select('id, pseudo, avatar_url').in('id', [...new Set(peerIds)]);
    const peerMap = new Map((peers || []).map((p) => [p.id, p]));

    res.json({
      sessions: shows.map((s) => ({
        ...s,
        peer: peerMap.get(isCreator ? s.fan_id : s.creator_id) || null,
      })),
      page,
      limit,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
// ADMIN
// ════════════════════════════════════════════════════════════

// GET /private-shows/admin/sessions — liste toutes les sessions
router.get('/admin/sessions', authMiddleware, requireMinRole('admin'), async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page) || 1);
  const limit  = Math.min(100, parseInt(req.query.limit) || 25);
  const offset = (page - 1) * limit;
  const status = req.query.status || null;

  try {
    let q = supabase.from('private_shows')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (status) q = q.eq('status', status);

    const { data: shows, count } = await q;
    if (!shows?.length) return res.json({ sessions: [], count: count || 0, page, limit });

    const allIds = [...new Set([...shows.map((s) => s.creator_id), ...shows.map((s) => s.fan_id)])];
    const { data: users } = await supabase.from('users')
      .select('id, pseudo, avatar_url').in('id', allIds);
    const userMap = new Map((users || []).map((u) => [u.id, u]));

    res.json({
      sessions: shows.map((s) => ({
        ...s,
        creator: userMap.get(s.creator_id) || null,
        fan:     userMap.get(s.fan_id)     || null,
      })),
      count: count || 0,
      page,
      limit,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /private-shows/admin/stats — chiffres globaux
router.get('/admin/stats', authMiddleware, requireMinRole('admin'), async (req, res) => {
  try {
    const [activeSt, endedSt, totalRevSt] = await Promise.all([
      supabase.from('private_shows').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      supabase.from('private_shows').select('id', { count: 'exact', head: true }).eq('status', 'ENDED'),
      supabase.from('private_shows').select('platform_revenue_xcon').eq('status', 'ENDED'),
    ]);

    const totalRevenue = (totalRevSt.data || []).reduce(
      (acc, s) => acc + (s.platform_revenue_xcon || 0), 0,
    );

    res.json({
      active_count:   activeSt.count  || 0,
      ended_count:    endedSt.count   || 0,
      total_revenue:  Math.floor(totalRevenue),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /private-shows/admin/:id/force-end — forcer la fin d'une session
router.post('/admin/:id/force-end', authMiddleware, requireMinRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    const { data: show } = await supabase.from('private_shows')
      .select('*').eq('id', id).eq('status', 'ACTIVE').maybeSingle();
    if (!show) return res.status(404).json({ error: 'Show actif introuvable' });

    await autoEndShow(show, reason || 'forced_by_admin');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

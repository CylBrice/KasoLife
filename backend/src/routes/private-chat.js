// ============================================================
// KASOLIFE — Routes /private-chat v1.0
// Private Chat 1-to-1 créateur ↔ fan via LiveKit.
// Forfaits fixes : 15 / 30 / 45 / 60 min.
// Débit complet au départ → remboursement prorata à la fin.
// Cam2Cam : fan doit activer sa webcam dans le délai de grâce.
// ============================================================
'use strict';

const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authMiddleware, requireMinRole, requireNotWalletFrozen, isAdminRole } = require('../middleware/auth');
const { createRoom, endRoom, createRoomToken } = require('../services/livekit');
const configService = require('../services/configService');

const router = express.Router();

const PACKAGES = [15, 30, 45, 60];

// ── Helper : lire les prix des forfaits depuis la config ─────
const getPackagePrices = async () => {
  const prices = {};
  for (const min of PACKAGES) {
    prices[min] = await configService.get(`private_chat_price_${min}min`);
  }
  return prices;
};

// ── Helper : calcul du remboursement prorata ─────────────────
const computeRefund = (pricePaid, packageMinutes, actualSeconds) => {
  const packageSeconds = packageMinutes * 60;
  if (actualSeconds >= packageSeconds) return 0;
  const unusedRatio = 1 - actualSeconds / packageSeconds;
  return Math.floor(pricePaid * unusedRatio);
};

// ════════════════════════════════════════════════════════════
// PACKAGES — prix disponibles (public)
// ════════════════════════════════════════════════════════════

// GET /private-chat/packages — liste des forfaits
router.get('/packages', async (req, res) => {
  try {
    const prices = await getPackagePrices();
    res.json({
      packages: PACKAGES.map((min) => ({
        minutes: min,
        price_xcon: prices[min],
        label: `${min} min`,
      })),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
// FAN — demander une session
// ════════════════════════════════════════════════════════════

// POST /private-chat/request — fan demande une session
router.post('/request', authMiddleware, requireNotWalletFrozen, async (req, res) => {
  const { creator_id, package_minutes, cam2cam } = req.body;
  const fanId = req.user.id;

  if (!creator_id) return res.status(400).json({ error: 'creator_id requis' });
  if (!PACKAGES.includes(parseInt(package_minutes)))
    return res.status(400).json({ error: `Forfait invalide — choisissez parmi ${PACKAGES.join(', ')} minutes` });

  const pkgMin = parseInt(package_minutes);

  try {
    // Vérifier que le créateur existe et est bien créateur
    const { data: creator } = await supabase.from('users')
      .select('id, role').eq('id', creator_id).single();
    if (!creator || !['influencer','admin','super_admin','root_admin'].includes(creator.role))
      return res.status(404).json({ error: 'Créateur introuvable' });
    if (creator_id === fanId) return res.status(400).json({ error: 'Vous ne pouvez pas vous réserver à vous-même' });

    // Vérifier qu'il n'y a pas déjà une session active/en attente avec ce créateur
    const { data: existing } = await supabase.from('private_chats')
      .select('id, status').eq('fan_id', fanId).eq('creator_id', creator_id)
      .in('status', ['PENDING','ACTIVE']).single();
    if (existing) return res.status(409).json({ error: 'Vous avez déjà une session en cours ou en attente avec ce créateur' });

    const prices = await getPackagePrices();
    const priceXcon = prices[pkgMin];
    if (!priceXcon) return res.status(500).json({ error: 'Prix du forfait non configuré' });

    const pricePerMin = Math.floor(priceXcon / pkgMin);
    const timeoutMin  = await configService.get('private_chat_request_timeout_min') || 5;
    const commRate    = await configService.getCommissionRate('ppv');
    const commission  = Math.floor(priceXcon * commRate);

    // Débiter le wallet fan immédiatement
    const { data: newBalance, error: debitErr } = await supabase.rpc('debit_wallet', {
      p_user_id: fanId, p_amount: priceXcon,
    });
    if (debitErr) {
      if (debitErr.message?.includes('Solde insuffisant'))
        return res.status(402).json({ error: 'Solde insuffisant — veuillez recharger votre wallet' });
      throw debitErr;
    }

    const chatId = uuidv4();
    const expiresAt = new Date(Date.now() + timeoutMin * 60 * 1000).toISOString();

    const { data: chat, error: insertErr } = await supabase.from('private_chats').insert({
      id: chatId,
      creator_id,
      fan_id: fanId,
      package_minutes: pkgMin,
      price_xcon: priceXcon,
      price_per_minute_xcon: pricePerMin,
      commission_xcon: commission,
      status: 'PENDING',
      cam2cam_required: !!cam2cam,
      request_expires_at: expiresAt,
    }).select().single();
    if (insertErr) throw insertErr;

    await supabase.from('transactions').insert({
      id: uuidv4(), user_id: fanId, type: 'PPV_PAYMENT',
      amount_xcon: -priceXcon, balance_after: newBalance,
      description: `Réservation Private Chat ${pkgMin} min`,
      related_user_id: creator_id,
    });

    // Notifier le créateur
    await supabase.from('notifications').insert({
      id: uuidv4(), user_id: creator_id, type: 'PRIVATE_CHAT_REQUEST',
      message: `Nouvelle demande de Private Chat — ${pkgMin} min`,
      related_id: chatId,
    });

    res.status(201).json({ chat, new_balance: newBalance });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
// CRÉATEUR — gérer les demandes
// ════════════════════════════════════════════════════════════

// GET /private-chat/requests/pending — demandes en attente
router.get('/requests/pending', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const { data: chats } = await supabase.from('private_chats')
      .select('*')
      .eq('creator_id', req.user.id)
      .eq('status', 'PENDING')
      .gte('request_expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (!chats?.length) return res.json({ requests: [] });

    // Enrichir avec les infos du fan
    const fanIds = [...new Set(chats.map((c) => c.fan_id))];
    const { data: fans } = await supabase.from('users')
      .select('id, pseudo, avatar_url').in('id', fanIds);
    const fanMap = new Map((fans || []).map((f) => [f.id, f]));

    res.json({
      requests: chats.map((c) => ({ ...c, fan: fanMap.get(c.fan_id) || null })),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /private-chat/requests/:id/accept — créateur accepte
router.post('/requests/:id/accept', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const { data: chat } = await supabase.from('private_chats')
      .select('*').eq('id', req.params.id).eq('creator_id', req.user.id).single();
    if (!chat) return res.status(404).json({ error: 'Demande introuvable' });
    if (chat.status !== 'PENDING') return res.status(409).json({ error: `Session déjà ${chat.status}` });
    if (new Date() > new Date(chat.request_expires_at))
      return res.status(410).json({ error: 'La demande a expiré — le fan a été remboursé' });

    const roomName = `private-chat-${chat.id}`;
    await createRoom(roomName);

    const { data: updated } = await supabase.from('private_chats')
      .update({ status: 'ACTIVE', room_name: roomName, started_at: new Date().toISOString() })
      .eq('id', chat.id).select().single();

    // Notifier le fan
    await supabase.from('notifications').insert({
      id: uuidv4(), user_id: chat.fan_id, type: 'PRIVATE_CHAT_ACCEPTED',
      message: 'Votre demande de Private Chat a été acceptée — rejoignez maintenant !',
      related_id: chat.id,
    });

    res.json({ chat: updated, room_name: roomName });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /private-chat/requests/:id/reject — créateur refuse
router.post('/requests/:id/reject', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  const { reason } = req.body;
  try {
    const { data: chat } = await supabase.from('private_chats')
      .select('*').eq('id', req.params.id).eq('creator_id', req.user.id).single();
    if (!chat) return res.status(404).json({ error: 'Demande introuvable' });
    if (chat.status !== 'PENDING') return res.status(409).json({ error: `Session déjà ${chat.status}` });

    // Rembourser le fan
    await supabase.rpc('credit_wallet', { p_user_id: chat.fan_id, p_amount: chat.price_xcon });
    await supabase.from('transactions').insert({
      id: uuidv4(), user_id: chat.fan_id, type: 'REFUND',
      amount_xcon: chat.price_xcon, balance_after: 0,
      description: `Remboursement Private Chat ${chat.package_minutes} min (refus créateur)`,
      related_user_id: req.user.id,
    });

    await supabase.from('private_chats').update({
      status: 'REJECTED', rejection_reason: reason || null, ended_at: new Date().toISOString(),
    }).eq('id', chat.id);

    await supabase.from('notifications').insert({
      id: uuidv4(), user_id: chat.fan_id, type: 'PRIVATE_CHAT_REJECTED',
      message: 'Votre demande de Private Chat a été refusée — vous avez été remboursé.',
      related_id: chat.id,
    });

    res.json({ message: 'Demande refusée, fan remboursé' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
// SESSION ACTIVE
// ════════════════════════════════════════════════════════════

// GET /private-chat/:id/token — token LiveKit pour rejoindre la room
router.get('/:id/token', authMiddleware, async (req, res) => {
  try {
    const { data: chat } = await supabase.from('private_chats')
      .select('*').eq('id', req.params.id).single();
    if (!chat) return res.status(404).json({ error: 'Session introuvable' });

    const isCreator = chat.creator_id === req.user.id;
    const isFan     = chat.fan_id     === req.user.id;
    const isAdmin   = isAdminRole(req.user.role);

    if (!isCreator && !isFan && !isAdmin)
      return res.status(403).json({ error: 'Accès refusé' });

    if (chat.status !== 'ACTIVE')
      return res.status(409).json({ error: `La session est ${chat.status}` });

    const identity  = req.user.id;
    const canPublish = isCreator || isFan; // les deux peuvent streamer
    const token = await createRoomToken(identity, chat.room_name, {
      canPublish,
      canSubscribe: true,
      name: req.user.pseudo || identity,
    });

    const wsUrl = (process.env.LIVEKIT_URL || '').replace(/^http/, 'ws');
    res.json({ token, ws_url: wsUrl, room_name: chat.room_name, cam2cam_required: chat.cam2cam_required });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /private-chat/:id/fan-cam-ready — fan signale sa webcam active
router.post('/:id/fan-cam-ready', authMiddleware, async (req, res) => {
  try {
    const { data: chat } = await supabase.from('private_chats')
      .select('id, fan_id, status, fan_cam_active_at')
      .eq('id', req.params.id).single();
    if (!chat || chat.fan_id !== req.user.id)
      return res.status(403).json({ error: 'Accès refusé' });
    if (chat.status !== 'ACTIVE') return res.status(409).json({ error: 'Session inactive' });
    if (chat.fan_cam_active_at) return res.json({ message: 'Déjà enregistrée' });

    await supabase.from('private_chats')
      .update({ fan_cam_active_at: new Date().toISOString() })
      .eq('id', chat.id);

    res.json({ message: 'Webcam fan confirmée' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /private-chat/:id/end — terminer la session (créateur ou fan)
router.post('/:id/end', authMiddleware, async (req, res) => {
  try {
    const { data: chat } = await supabase.from('private_chats')
      .select('*').eq('id', req.params.id).single();
    if (!chat) return res.status(404).json({ error: 'Session introuvable' });

    const isCreator = chat.creator_id === req.user.id;
    const isFan     = chat.fan_id     === req.user.id;
    const isAdmin   = isAdminRole(req.user.role);

    if (!isCreator && !isFan && !isAdmin)
      return res.status(403).json({ error: 'Accès refusé' });

    if (chat.status !== 'ACTIVE') return res.status(409).json({ error: `Session déjà ${chat.status}` });

    const now = new Date();
    const startedAt = chat.started_at ? new Date(chat.started_at) : now;
    const actualSeconds = Math.floor((now - startedAt) / 1000);
    const refundXcon = computeRefund(chat.price_xcon, chat.package_minutes, actualSeconds);

    // Calculer la part créateur (prix payé - remboursement - commission)
    const creatorShare = Math.floor((chat.price_xcon - refundXcon) * (1 - chat.commission_xcon / chat.price_xcon || 0.20));
    const actualCommission = Math.floor((chat.price_xcon - refundXcon) - creatorShare);

    // Rembourser le fan si session courte
    if (refundXcon > 0) {
      await supabase.rpc('credit_wallet', { p_user_id: chat.fan_id, p_amount: refundXcon });
      await supabase.from('transactions').insert({
        id: uuidv4(), user_id: chat.fan_id, type: 'REFUND',
        amount_xcon: refundXcon, balance_after: 0,
        description: `Remboursement Private Chat ${chat.package_minutes} min (${Math.floor(actualSeconds/60)} min utilisées)`,
        related_user_id: chat.creator_id,
      });
    }

    // Créditer le créateur
    if (creatorShare > 0) {
      await supabase.rpc('credit_pending_balance', { p_user_id: chat.creator_id, p_amount: creatorShare });
      await supabase.from('transactions').insert({
        id: uuidv4(), user_id: chat.creator_id, type: 'PPV_INCOME',
        amount_xcon: creatorShare, balance_after: 0,
        description: `Gains Private Chat ${chat.package_minutes} min`,
        related_user_id: chat.fan_id,
      });
    }

    // Enregistrer la revenue plateforme
    if (actualCommission > 0) {
      await supabase.from('platform_revenue').insert({
        id: uuidv4(), type: 'PRIVATE_CHAT', amount_xcon: actualCommission,
        creator_id: chat.creator_id, fan_id: chat.fan_id,
      });
    }

    // Fermer la room LiveKit
    if (chat.room_name) {
      try { await endRoom(chat.room_name); } catch (_) {}
    }

    await supabase.from('private_chats').update({
      status: 'ENDED',
      ended_at: now.toISOString(),
      actual_duration_seconds: actualSeconds,
      refund_xcon: refundXcon,
    }).eq('id', chat.id);

    res.json({
      message: 'Session terminée',
      actual_duration_seconds: actualSeconds,
      refund_xcon: refundXcon,
      creator_share_xcon: creatorShare,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
// HISTORIQUE
// ════════════════════════════════════════════════════════════

// GET /private-chat/history — historique (fan ou créateur)
router.get('/history', authMiddleware, async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  try {
    const userId = req.user.id;
    const isCreator = ['influencer','admin','super_admin','root_admin'].includes(req.user.role);

    let query = supabase.from('private_chats').select('*')
      .in('status', ['ENDED','REJECTED','CANCELLED'])
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (isCreator && req.query.role === 'creator') {
      query = query.eq('creator_id', userId);
    } else {
      query = query.eq('fan_id', userId);
    }

    const { data: chats } = await query;
    if (!chats?.length) return res.json({ sessions: [], page, limit });

    // Enrichir
    const peerIds = chats.map((c) => isCreator ? c.fan_id : c.creator_id);
    const { data: peers } = await supabase.from('users')
      .select('id, pseudo, avatar_url').in('id', [...new Set(peerIds)]);
    const peerMap = new Map((peers || []).map((p) => [p.id, p]));

    res.json({
      sessions: chats.map((c) => ({
        ...c,
        peer: peerMap.get(isCreator ? c.fan_id : c.creator_id) || null,
      })),
      page,
      limit,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

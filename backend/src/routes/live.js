// ============================================================
// KASOLIFE — Routes /live v1.0
// Direct (livestream) — MVP : un créateur diffuse via LiveKit,
// les spectateurs s'abonnent directement à la room (pas d'Egress/HLS
// pour cette phase — cf. note d'architecture).
// ============================================================
'use strict';
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const supabase = require('../config/supabase');
const { authMiddleware, requireMinRole, requireNotWalletFrozen, logAdminContentView } = require('../middleware/auth');
const { createRoom, endRoom, createRoomToken } = require('../services/livekit');
const { notifyStreamEnded } = require('../services/liveSocket');
const { cleanupStream } = require('../services/streamCleanupService');
const { finalizeStreamPayments } = require('../services/streamFinalizationService');
const { PPV_PRICE_MIN, PPV_PRICE_MAX } = require('../config/constants');
const configService = require('../services/configService');
const { sanitizeHtmlTitle } = require('../services/htmlSanitizer');

const router = express.Router();

const startLimit = rateLimit({ windowMs: 3600000, max: 10, message: { error: 'Trop de tentatives — réessayez dans 1 heure' } });

// Le client navigateur se connecte en ws(s):// au même serveur LiveKit que l'API http(s)://
const wsUrl = () => (process.env.LIVEKIT_URL || '').replace(/^http/, 'ws');

// ── GET /live — directs en cours (découverte publique) ────────────────────────
// Jointure manuelle : la couche de compatibilité Supabase→pg (config/supabase.js)
// ignore silencieusement les relations imbriquées de type "alias:table(cols)".
router.get('/', async (req, res) => {
  try {
    const { data: streams } = await supabase.from('live_streams')
      .select('id, title, started_at, creator_id, price_xcon')
      .eq('status', 'LIVE').order('started_at', { ascending: false }).limit(50);

    const creatorIds = [...new Set((streams || []).map((s) => s.creator_id))];
    const { data: creators } = creatorIds.length
      ? await supabase.from('users').select('id, pseudo, avatar_url').in('id', creatorIds)
      : { data: [] };
    const creatorById = new Map((creators || []).map((c) => [c.id, c]));

    res.json({
      streams: (streams || []).map(({ creator_id, ...s }) => ({ ...s, creator: creatorById.get(creator_id) || null })),
    });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /live/start — démarre un direct (créateur uniquement) ────────────────
router.post('/start', startLimit, authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const { title, price_xcon: rawPrice } = req.body;

    const { data: existing } = await supabase.from('live_streams')
      .select('id').eq('creator_id', req.user.id).eq('status', 'LIVE').single();
    if (existing) return res.status(409).json({ error: 'Vous avez déjà un direct en cours' });

    const priceXcon = rawPrice ? parseInt(rawPrice, 10) : null;
    if (priceXcon !== null) {
      if (isNaN(priceXcon) || priceXcon < PPV_PRICE_MIN || priceXcon > PPV_PRICE_MAX)
        return res.status(400).json({ error: `Prix invalide — entre ${PPV_PRICE_MIN} et ${PPV_PRICE_MAX} XCON` });
    }

    const roomName = `live-${req.user.id}-${Date.now()}`;
    await createRoom(roomName);

    const { data: stream, error } = await supabase.from('live_streams').insert({
      id: uuidv4(), creator_id: req.user.id, room_name: roomName,
      title: title ? sanitizeHtmlTitle(String(title)).slice(0, 300) || null : null,
      status: 'LIVE',
      price_xcon: priceXcon,
    }).select().single();
    if (error) throw error;

    const publishToken = await createRoomToken(req.user.id, roomName, {
      canPublish: true, canSubscribe: true,
    });

    res.status(201).json({ streamId: stream.id, roomName, publishToken, wsUrl: wsUrl() });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur', details: err.message }); }
});

// ── GET /live/:id/token — token spectateur (abonnement seul) ─────────────────
router.get('/:id/token', authMiddleware, async (req, res) => {
  try {
    const { data: stream } = await supabase.from('live_streams')
      .select('id, room_name, status, creator_id, price_xcon').eq('id', req.params.id).single();
    if (!stream) return res.status(404).json({ error: 'Direct introuvable' });
    if (stream.status !== 'LIVE') return res.status(410).json({ error: 'Ce direct est terminé' });

    // Gate PPV : si le direct a un prix, vérifier l'achat (créateur exempté)
    if (stream.price_xcon && stream.creator_id !== req.user.id) {
      const { data: purchase } = await supabase.from('live_stream_purchases')
        .select('id').eq('live_stream_id', stream.id).eq('buyer_id', req.user.id).single();
      if (!purchase) {
        return res.status(402).json({ error: 'Achat requis pour rejoindre ce direct', price: stream.price_xcon });
      }
    }

    const token = await createRoomToken(req.user.id, stream.room_name, {
      canPublish: false, canSubscribe: true,
    });
    res.json({ token, roomName: stream.room_name, wsUrl: wsUrl() });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /live/:id/purchase — acheter un ticket d'accès à un direct payant ────
router.post('/:id/purchase', authMiddleware, requireNotWalletFrozen, async (req, res) => {
  try {
    const { data: stream } = await supabase.from('live_streams')
      .select('id, creator_id, status, price_xcon').eq('id', req.params.id).single();
    if (!stream) return res.status(404).json({ error: 'Direct introuvable' });
    if (stream.status !== 'LIVE') return res.status(410).json({ error: 'Ce direct est terminé' });
    if (!stream.price_xcon) return res.status(400).json({ error: 'Ce direct est gratuit' });
    if (stream.creator_id === req.user.id) return res.status(400).json({ error: 'Vous ne pouvez pas acheter l\'accès à votre propre direct' });

    const { data: existing } = await supabase.from('live_stream_purchases')
      .select('id').eq('live_stream_id', stream.id).eq('buyer_id', req.user.id).single();
    if (existing) return res.status(409).json({ error: 'Vous avez déjà acheté l\'accès à ce direct' });

    // Les admins+ accèdent sans paiement (modération)
    if (req.isAdminAccess) {
      logAdminContentView(req, 'live_stream', stream.id);
      return res.json({ message: 'Accès admin — accès direct sans paiement', admin_access: true });
    }

    const price      = stream.price_xcon;
    const ppvRate    = await configService.getCommissionRate('ppv');
    const commission = Math.round(price * ppvRate);
    const creatorShare = price - commission;

    const { data: newBalance, error: debitErr } = await supabase.rpc('debit_wallet', {
      p_user_id: req.user.id, p_amount: price,
    });
    if (debitErr) {
      if (debitErr.message?.includes('Solde insuffisant'))
        return res.status(402).json({ error: 'Solde insuffisant — veuillez recharger votre wallet' });
      throw debitErr;
    }

    await supabase.from('live_stream_purchases').insert({
      id: uuidv4(), live_stream_id: stream.id, buyer_id: req.user.id,
      price_xcon: price, commission_xcon: commission,
    });

    await supabase.rpc('credit_pending_balance', { p_user_id: stream.creator_id, p_amount: creatorShare });

    await supabase.from('transactions').insert([
      {
        id: uuidv4(), user_id: req.user.id, type: 'LIVE_PPV_PAYMENT', amount_xcon: -price,
        balance_after: newBalance,
        description: `Ticket direct payant`,
        related_user_id: stream.creator_id,
      },
      {
        id: uuidv4(), user_id: stream.creator_id, type: 'LIVE_PPV_INCOME', amount_xcon: creatorShare,
        balance_after: 0,
        description: `Vente ticket direct (commission ${(ppvRate * 100).toFixed(0)}%)`,
        related_user_id: req.user.id,
      },
    ]);

    await supabase.from('platform_revenue').insert({
      id: uuidv4(), source_type: 'COMMISSION_LIVE_PPV', amount_xcon: commission,
      reference_id: stream.id, user_id: stream.creator_id,
    });

    res.json({ message: 'Achat réussi — accès au direct débloqué', balance_xcon: newBalance });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur', details: err.message }); }
});

// ── POST /live/:id/end — termine un direct (créateur propriétaire) ───────────
router.post('/:id/end', authMiddleware, async (req, res) => {
  try {
    const { data: stream } = await supabase.from('live_streams')
      .select('id, room_name, creator_id, status').eq('id', req.params.id).single();
    if (!stream) return res.status(404).json({ error: 'Direct introuvable' });
    if (stream.creator_id !== req.user.id) return res.status(403).json({ error: 'Accès non autorisé' });
    if (stream.status === 'ENDED') return res.json({ ok: true });

    await endRoom(stream.room_name);
    await supabase.from('live_streams')
      .update({ status: 'ENDED', ended_at: new Date().toISOString() })
      .eq('id', stream.id);
    notifyStreamEnded(stream.id);

    // Finalisation et nettoyage asynchrones — ne bloquent pas la réponse
    setImmediate(async () => {
      try {
        await finalizeStreamPayments(stream.id);
      } catch (err) {
        console.error(`[Live] Failed to finalize stream ${stream.id}:`, err.message);
      }
      try {
        await cleanupStream(stream.id);
      } catch (err) {
        console.error(`[Live] Failed to cleanup stream ${stream.id}:`, err.message);
      }
    });

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

module.exports = router;

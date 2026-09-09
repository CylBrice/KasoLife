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
const { authMiddleware, requireMinRole } = require('../middleware/auth');
const { createRoom, endRoom, createRoomToken } = require('../services/livekit');
const { notifyStreamEnded } = require('../services/liveSocket');

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
      .select('id, title, started_at, creator_id')
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
    const { title } = req.body;

    const { data: existing } = await supabase.from('live_streams')
      .select('id').eq('creator_id', req.user.id).eq('status', 'LIVE').single();
    if (existing) return res.status(409).json({ error: 'Vous avez déjà un direct en cours' });

    const roomName = `live-${req.user.id}-${Date.now()}`;
    await createRoom(roomName);

    const { data: stream, error } = await supabase.from('live_streams').insert({
      id: uuidv4(), creator_id: req.user.id, room_name: roomName,
      title: title ? String(title).slice(0, 120) : null, status: 'LIVE',
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
      .select('id, room_name, status').eq('id', req.params.id).single();
    if (!stream) return res.status(404).json({ error: 'Direct introuvable' });
    if (stream.status !== 'LIVE') return res.status(410).json({ error: 'Ce direct est terminé' });

    const token = await createRoomToken(req.user.id, stream.room_name, {
      canPublish: false, canSubscribe: true,
    });
    res.json({ token, roomName: stream.room_name, wsUrl: wsUrl() });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
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

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

module.exports = router;

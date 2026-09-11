// ============================================================
// KASOLIFE — WebSocket direct (chat + cadeaux temps réel)
// Le paquet `ws` était déclaré en dépendance mais jamais câblé —
// première utilisation ici, montée sur le même serveur HTTP.
// Cadeaux : même mécanique argent que subscriptions.js
// (debit_wallet → commission TIP_COMMISSION_RATE → credit_pending_balance
// → tips → transactions), juste rattachée à un live_stream_id.
// ============================================================
'use strict';
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { TIP_MIN, TIP_MAX } = require('../config/constants');
const configService = require('./configService');

// streamId -> Set<ws>
const rooms = new Map();

// userId -> Set<ws>  (pour dispatch ciblé toy-control)
const userSockets = new Map();

const addUserSocket = (userId, ws) => {
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(ws);
};
const removeUserSocket = (userId, ws) => {
  const set = userSockets.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) userSockets.delete(userId);
};
const sendToUser = (userId, payload) => {
  const set = userSockets.get(userId);
  if (!set) return;
  const data = JSON.stringify(payload);
  for (const client of set) {
    if (client.readyState === client.OPEN) client.send(data);
  }
};

const joinRoom = (streamId, ws) => {
  if (!rooms.has(streamId)) rooms.set(streamId, new Set());
  rooms.get(streamId).add(ws);
};

const leaveRoom = (streamId, ws) => {
  const set = rooms.get(streamId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) rooms.delete(streamId);
};

const broadcast = (streamId, payload) => {
  const set = rooms.get(streamId);
  if (!set) return;
  const data = JSON.stringify(payload);
  for (const client of set) {
    if (client.readyState === client.OPEN) client.send(data);
  }
};

const getRoomViewerCount = (streamId) => rooms.get(streamId)?.size || 0;

// ── Notifie les spectateurs connectés que le direct est terminé ──────────────
const notifyStreamEnded = (streamId) => broadcast(streamId, { type: 'STREAM_ENDED' });

// ── Cadeau en direct — reproduit le pattern argent de subscriptions.js ───────
const handleGift = async (ws, stream, msg) => {
  try {
    const amount = Math.round(Number(msg.amount_xcon));
    if (!Number.isFinite(amount) || amount < TIP_MIN || amount > TIP_MAX) {
      ws.send(JSON.stringify({ type: 'GIFT_ERROR', error: `Montant invalide (entre ${TIP_MIN} et ${TIP_MAX} XCON)` }));
      return;
    }
    if (ws.userId === stream.creator_id) {
      ws.send(JSON.stringify({ type: 'GIFT_ERROR', error: 'Vous ne pouvez pas vous envoyer un cadeau' }));
      return;
    }

    const tipRate       = await configService.getCommissionRate('tip');
    const commission    = Math.round(amount * tipRate);
    const creatorShare  = amount - commission;

    const { data: newBalance, error: debitErr } = await supabase.rpc('debit_wallet', {
      p_user_id: ws.userId, p_amount: amount,
    });
    if (debitErr) {
      ws.send(JSON.stringify({ type: 'GIFT_ERROR', error: 'Solde insuffisant — rechargez votre wallet' }));
      return;
    }

    await supabase.rpc('credit_pending_balance', { p_user_id: stream.creator_id, p_amount: creatorShare });

    await supabase.from('tips').insert({
      id: uuidv4(), sender_id: ws.userId, receiver_id: stream.creator_id,
      live_stream_id: stream.id, amount_xcon: amount, commission_xcon: commission,
      message: msg.message ? String(msg.message).slice(0, 200) : null,
    });

    await supabase.from('transactions').insert([
      {
        id: uuidv4(), user_id: ws.userId, type: 'TIP_SENT', amount_xcon: -amount,
        balance_after: newBalance, description: 'Cadeau en direct', related_user_id: stream.creator_id,
      },
      {
        id: uuidv4(), user_id: stream.creator_id, type: 'TIP_RECEIVED', amount_xcon: creatorShare,
        balance_after: 0, description: `Cadeau reçu en direct (commission ${(tipRate * 100).toFixed(0)}%)`,
        related_user_id: ws.userId,
      },
    ]);

    broadcast(stream.id, { type: 'GIFT_RECEIVED', pseudo: ws.pseudo, amount_xcon: amount, ts: Date.now() });
  } catch {
    ws.send(JSON.stringify({ type: 'GIFT_ERROR', error: 'Erreur serveur' }));
  }
};

// ── Branchement sur le serveur HTTP existant ──────────────────────────────────
const attachLiveSocket = (server) => {
  const wss = new WebSocketServer({ server, path: '/live/ws' });

  wss.on('connection', (ws, req) => {
    // La validation (JWT + lookups DB) est asynchrone, mais le client peut envoyer
    // un message dès l'événement 'open' côté navigateur — avant que ce handler async
    // n'ait fini. On attache donc l'écouteur tout de suite et on met en file d'attente
    // tout message reçu avant la fin de la validation, pour ne rien perdre.
    let ready = false;
    let stream = null;
    const pending = [];

    const processMessage = (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.type === 'CHAT_MESSAGE') {
        const text = String(msg.text || '').slice(0, 300).trim();
        if (!text) return;
        broadcast(ws.streamId, { type: 'CHAT_MESSAGE', pseudo: ws.pseudo, text, ts: Date.now() });
        return;
      }
      if (msg.type === 'SEND_GIFT') {
        handleGift(ws, stream, msg);
      }
    };

    ws.on('message', (raw) => (ready ? processMessage(raw) : pending.push(raw)));

    (async () => {
      const { searchParams } = new URL(req.url, 'http://internal');
      const streamId = searchParams.get('streamId');
      const token    = searchParams.get('token');
      if (!streamId || !token) return ws.close(4001, 'Paramètres manquants');

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return ws.close(4001, 'Token invalide');
      }

      const { data: user } = await supabase.from('users')
        .select('id, pseudo, is_active').eq('id', decoded.userId).single();
      if (!user || !user.is_active) return ws.close(4001, 'Utilisateur invalide');

      const { data: streamRow } = await supabase.from('live_streams')
        .select('id, creator_id, status').eq('id', streamId).single();
      if (!streamRow || streamRow.status !== 'LIVE') return ws.close(4004, 'Direct introuvable ou terminé');

      stream      = streamRow;
      ws.userId   = user.id;
      ws.pseudo   = user.pseudo;
      ws.streamId = streamId;

      joinRoom(streamId, ws);
      addUserSocket(user.id, ws);
      broadcast(streamId, { type: 'VIEWER_COUNT', count: getRoomViewerCount(streamId) });

      ws.on('close', () => {
        leaveRoom(streamId, ws);
        removeUserSocket(user.id, ws);
        broadcast(streamId, { type: 'VIEWER_COUNT', count: getRoomViewerCount(streamId) });
      });

      ready = true;
      pending.splice(0).forEach(processMessage);
    })();
  });
};

module.exports = { attachLiveSocket, getRoomViewerCount, notifyStreamEnded, sendToUser, broadcast };

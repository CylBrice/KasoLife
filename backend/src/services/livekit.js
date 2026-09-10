// ============================================================
// KASOLIFE — Service LiveKit (direct / livestream)
// Auto-hébergé (Apache 2.0) — pas de facturation à la minute.
// LIVEKIT_URL pointe l'API serveur en http(s) (le même serveur
// sert aussi le WebSocket client sur ce port).
// ============================================================
'use strict';
const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');

const LIVEKIT_URL        = process.env.LIVEKIT_URL;
const LIVEKIT_API_KEY    = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

// ── Crée une room LiveKit pour un direct ──────────────────────────────────────
const createRoom = async (roomName, { emptyTimeout = 300, maxParticipants = 0, metadata } = {}) => {
  return roomService.createRoom({
    name: roomName,
    emptyTimeout,
    maxParticipants,
    ...(metadata ? { metadata: JSON.stringify(metadata) } : {}),
  });
};

// ── Ferme une room (fin de direct) ────────────────────────────────────────────
const endRoom = async (roomName) => {
  try {
    await roomService.deleteRoom(roomName);
  } catch (e) {
    // Room déjà fermée/inexistante côté LiveKit — non bloquant
  }
};

// ── Génère un token d'accès avec TTL et permissions granulaires ───────────────
const createRoomToken = async (
  identity,
  roomName,
  {
    canPublish     = false,
    canSubscribe   = true,
    canPublishData = canPublish, // spies reçoivent false via canPublish=false
    name,
    ttlSeconds,                  // expiration du token en secondes
  } = {},
) => {
  const opts = { identity, name };
  if (ttlSeconds) opts.ttl = `${ttlSeconds}s`;
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, opts);
  at.addGrant({ roomJoin: true, room: roomName, canPublish, canSubscribe, canPublishData });
  return at.toJwt();
};

// ── Liste les rooms actives (pour la réconciliation CRON) ────────────────────
const listActiveRooms = async () => roomService.listRooms();

module.exports = { createRoom, endRoom, createRoomToken, listActiveRooms };

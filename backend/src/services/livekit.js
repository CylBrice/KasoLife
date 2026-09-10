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
const createRoom = async (roomName) => {
  return roomService.createRoom({
    name: roomName,
    emptyTimeout: 5 * 60,   // ferme la room si vide 5 min (filet de sécurité côté LiveKit)
    maxParticipants: 0,     // illimité
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

// ── Génère un token d'accès (créateur = publish, spectateur = subscribe) ─────
const createRoomToken = async (identity, roomName, { canPublish = false, canSubscribe = true, name } = {}) => {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity, name });
  at.addGrant({ roomJoin: true, room: roomName, canPublish, canSubscribe });
  return at.toJwt();
};

// ── Liste les rooms actives (pour la réconciliation CRON) ────────────────────
const listActiveRooms = async () => roomService.listRooms();

module.exports = { createRoom, endRoom, createRoomToken, listActiveRooms };

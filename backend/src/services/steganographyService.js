// ============================================================
// KASOLIFE — Service de stéganographie (watermark invisible) v1.0
//
// Technique : LSB (Least Significant Bit) sur le canal Rouge.
// Chaque bit du payload est encodé dans le bit de poids faible
// d'un pixel R, dans l'ordre de lecture (gauche→droite, haut→bas).
// Modification < 0.4% de chaque valeur : imperceptible à l'œil.
//
// Format payload encodé :
//   [4 octets BE = longueur du message UTF-8][message UTF-8]
// Soit 32 pixels pour la longueur + 8*len(msg) pixels pour le message.
//
// Capacité : image 400×400 = 160 000 pixels → 20 000 octets de payload.
//
// ⚠️  USAGE SERVEUR UNIQUEMENT — ne pas exposer côté client.
// ============================================================
'use strict';

const sharp = require('sharp');

// ── Encoder le payload (string) dans un buffer image ─────────
// Retourne un Buffer PNG avec le watermark invisible.
const encode = async (imageBuffer, payload) => {
  const msg      = Buffer.from(payload, 'utf8');
  const msgLen   = msg.length;
  const lenBytes = Buffer.allocUnsafe(4);
  lenBytes.writeUInt32BE(msgLen, 0);
  // Tableau de bits : longueur (32 bits) + message
  const allBytes  = Buffer.concat([lenBytes, msg]);
  const totalBits = allBytes.length * 8;

  const image    = sharp(imageBuffer);
  const meta     = await image.metadata();
  const { width = 0, height = 0, channels = 3 } = meta;
  const totalPixels = width * height;

  if (totalBits > totalPixels) {
    throw new Error(
      `Payload trop long pour cette image : ${totalBits} bits requis, ${totalPixels} disponibles`
    );
  }

  // Obtenir les pixels bruts (RGB ou RGBA)
  const { data } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const buf = Buffer.from(data); // copie mutable

  // Encoder : 1 bit par pixel dans le canal R (index 0 de chaque groupe RGBA)
  let bitIndex = 0;
  for (let i = 0; i < totalBits; i++) {
    const bytePos  = Math.floor(i / 8);
    const bitShift = 7 - (i % 8);
    const bit      = (allBytes[bytePos] >> bitShift) & 1;
    const pixelOff = i * 4; // RGBA : 4 octets par pixel
    buf[pixelOff]  = (buf[pixelOff] & 0xFE) | bit; // écrire dans LSB du canal R
    bitIndex++;
  }

  // Reconstruire l'image PNG (sans perte après LSB)
  return sharp(buf, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 6 })
    .toBuffer();
};

// ── Décoder le payload d'un buffer image ─────────────────────
// Retourne la string cachée, ou null si l'image n'est pas marquée.
const decode = async (imageBuffer) => {
  const image  = sharp(imageBuffer);
  const meta   = await image.metadata();
  const { width = 0, height = 0 } = meta;

  const { data } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const readBits = (numBits, startBit) => {
    const out = Buffer.alloc(Math.ceil(numBits / 8));
    for (let i = 0; i < numBits; i++) {
      const pixelOff = (startBit + i) * 4;
      if (pixelOff >= data.length) return null;
      const bit      = data[pixelOff] & 1;
      const bytePos  = Math.floor(i / 8);
      const bitShift = 7 - (i % 8);
      out[bytePos]   = (out[bytePos] & ~(1 << bitShift)) | (bit << bitShift);
    }
    return out;
  };

  // Lire la longueur du message (32 bits = 32 pixels)
  const lenBuf = readBits(32, 0);
  if (!lenBuf) return null;
  const msgLen = lenBuf.readUInt32BE(0);

  // Sanité : longueur raisonnable
  if (msgLen === 0 || msgLen > 10000) return null;

  const totalPixels = width * height;
  if (32 + msgLen * 8 > totalPixels) return null;

  // Lire le message
  const msgBuf = readBits(msgLen * 8, 32);
  if (!msgBuf) return null;

  try {
    return msgBuf.toString('utf8');
  } catch (_) {
    return null;
  }
};

// ── Appliquer le watermark invisible sur un buffer image ──────
// payload : string à cacher (ex: "KasoLife:U4821:2026-09-10T14:32Z")
// Retourne un Buffer PNG watermarké.
const applyInvisibleWatermark = async (imageBuffer, userId) => {
  const timestamp = new Date().toISOString().slice(0, 19) + 'Z';
  const payload   = `KasoLife:U${userId}:${timestamp}`;
  return encode(imageBuffer, payload);
};

// ── Extraire et vérifier le watermark d'une image ────────────
// Retourne { found: true, payload, userId, timestamp } ou { found: false }
const extractWatermark = async (imageBuffer) => {
  const payload = await decode(imageBuffer);
  if (!payload) return { found: false };

  // Format attendu : "KasoLife:U<id>:<timestamp>"
  const match = payload.match(/^KasoLife:U(\w+):(.+)$/);
  if (!match) return { found: true, payload, userId: null, timestamp: null };
  return {
    found:     true,
    payload,
    userId:    match[1],
    timestamp: match[2],
  };
};

module.exports = { encode, decode, applyInvisibleWatermark, extractWatermark };

// ============================================================
// KASOLIFE — Cloudflare R2 — stockage des avatars
// Même architecture que KasoPlex (kasoImageManager).
// Compatible S3 via @aws-sdk/client-s3.
//
// Variables d'environnement requises :
//   CLOUDFLARE_R2_ENDPOINT   — https://<ACCOUNT_ID>.r2.cloudflarestorage.com
//   CLOUDFLARE_R2_ACCESS_KEY_ID
//   CLOUDFLARE_R2_SECRET_ACCESS_KEY
//   CLOUDFLARE_R2_BUCKET     — kasolife-storage
//   CLOUDFLARE_R2_PUBLIC_URL — URL publique (domaine custom ou pub-*.r2.dev)
// ============================================================
'use strict';

const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

const DEFAULT_BUCKET = () => process.env.CLOUDFLARE_R2_BUCKET || 'kasolife-storage';
const PUB_URL        = () => (process.env.CLOUDFLARE_R2_PUBLIC_URL || '').replace(/\/$/, '');

const getR2Client = () => new S3Client({
  region:   'auto',
  endpoint:  process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId:     process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

// ── Variantes générées pour chaque avatar (comme KasoPlex) ──────────────────
// <uuid>.webp       → 400×400  (card, profil)
// <uuid>_thumb.webp → 96×96   (notifications, inline)
// <uuid>_small.webp → 240×240 (aperçus)
const AVATAR_VARIANTS = [
  { suffix: '',       size: 400, quality: 82 },
  { suffix: '_thumb', size: 96,  quality: 78 },
  { suffix: '_small', size: 240, quality: 80 },
];

// ── Génère les variantes sharp d'un avatar ───────────────────────────────────
const buildAvatarVariants = async (buffer) => {
  // Recadrage centré 1:1 puis WebP
  const meta   = await sharp(buffer).metadata();
  const side   = Math.min(meta.width || 400, meta.height || 400);
  const left   = Math.round(((meta.width  || 400) - side) / 2);
  const top    = Math.round(((meta.height || 400) - side) / 2);
  const cropped = await sharp(buffer)
    .extract({ left, top, width: side, height: side })
    .toBuffer();

  return Promise.all(AVATAR_VARIANTS.map(async ({ suffix, size, quality }) => {
    const data = await sharp(cropped)
      .resize(size, size, { fit: 'cover', position: 'centre' })
      .webp({ quality })
      .toBuffer();
    return { suffix, data };
  }));
};

// ── Upload un avatar vers R2 (toutes variantes) ─────────────────────────────
// @param {Buffer}  buffer  — fichier original (image/*)
// @param {string}  userId  — pour le préfixe de dossier
// @returns {{ url: string, key: string }}
//          url = URL de la variante principale (400×400)
const uploadAvatarToR2 = async (buffer, userId) => {
  const missing = ['CLOUDFLARE_R2_ENDPOINT','CLOUDFLARE_R2_ACCESS_KEY_ID','CLOUDFLARE_R2_SECRET_ACCESS_KEY','CLOUDFLARE_R2_PUBLIC_URL']
    .filter(v => !process.env[v]);
  if (missing.length) throw new Error(`Variables R2 manquantes : ${missing.join(', ')}`);

  const variants  = await buildAvatarVariants(buffer);
  const filename  = `${uuidv4()}.webp`;
  const folder    = `avatars/${userId}`;
  const r2        = getR2Client();
  const bucket    = DEFAULT_BUCKET();

  await Promise.all(variants.map(({ suffix, data }) =>
    r2.send(new PutObjectCommand({
      Bucket:       bucket,
      Key:          `${folder}/${filename.replace('.webp', `${suffix}.webp`)}`,
      Body:         data,
      ContentType:  'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    }))
  ));

  const key = `${folder}/${filename}`;
  const url = `${PUB_URL()}/${key}`;
  return { url, key };
};

// ── Supprime toutes les variantes d'un avatar ────────────────────────────────
// @param {string} url — URL publique principale
const deleteAvatarFromR2 = async (url) => {
  if (!url) return;
  const base = PUB_URL();
  if (!base || !url.startsWith(base)) return;

  const mainKey  = url.slice(base.length + 1);          // avatars/userId/uuid.webp
  const baseName = mainKey.replace(/\.webp$/, '');       // avatars/userId/uuid
  const keys     = AVATAR_VARIANTS.map(({ suffix }) => `${baseName}${suffix}.webp`);

  try {
    const r2     = getR2Client();
    const bucket = DEFAULT_BUCKET();
    await Promise.all(keys.map(Key => r2.send(new DeleteObjectCommand({ Bucket: bucket, Key }))));
  } catch (err) {
    console.error('[R2] Suppression avatars échouée :', err.message);
  }
};

// ── Extrait la clé R2 depuis l'URL publique ──────────────────────────────────
const extractR2Key = (url) => {
  const base = PUB_URL();
  if (!url || !base || !url.startsWith(base)) return null;
  return url.slice(base.length + 1);
};

// ── Mapping MIME → extension ─────────────────────────────────────────────────
const EXT_FROM_MIME = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/wav': 'wav', 'audio/ogg': 'ogg',
};

const FOLDER_FOR = {
  banner:     (uid) => `banners/${uid}`,
  thumbnail:  (uid) => `thumbnails/${uid}`,
  post_image: (uid) => `posts/${uid}`,
  post_video: (uid) => `posts/${uid}`,
  post_audio: (uid) => `posts/${uid}`,
};

// ── Upload générique vers R2 (banners, posts, thumbnails) ────────────────────
const uploadMediaToR2 = async (buffer, userId, type, mimetype) => {
  const missing = ['CLOUDFLARE_R2_ENDPOINT','CLOUDFLARE_R2_ACCESS_KEY_ID','CLOUDFLARE_R2_SECRET_ACCESS_KEY','CLOUDFLARE_R2_PUBLIC_URL']
    .filter(v => !process.env[v]);
  if (missing.length) throw new Error(`Variables R2 manquantes : ${missing.join(', ')}`);

  const ext    = EXT_FROM_MIME[mimetype] || 'bin';
  const folder = (FOLDER_FOR[type] || ((uid) => `media/${uid}`))(userId);
  const key    = `${folder}/${uuidv4()}.${ext}`;

  await getR2Client().send(new PutObjectCommand({
    Bucket:       DEFAULT_BUCKET(),
    Key:          key,
    Body:         buffer,
    ContentType:  mimetype,
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  return { url: `${PUB_URL()}/${key}`, key };
};

// ── Suppression générique par URL publique ───────────────────────────────────
const deleteMediaFromR2 = async (url) => {
  if (!url) return;
  const base = PUB_URL();
  if (!base || !url.startsWith(base)) return;
  const key = url.slice(base.length + 1);
  try {
    await getR2Client().send(new DeleteObjectCommand({ Bucket: DEFAULT_BUCKET(), Key: key }));
  } catch (err) {
    console.error('[R2] Suppression média échouée :', err.message);
  }
};

// ── Download d'un objet R2 par clé ──────────────────────────────────────────
const downloadMediaFromR2 = async (key) => {
  const r2  = getR2Client();
  const res = await r2.send(new GetObjectCommand({ Bucket: DEFAULT_BUCKET(), Key: key }));
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
};

module.exports = { uploadAvatarToR2, deleteAvatarFromR2, extractR2Key, uploadMediaToR2, deleteMediaFromR2, downloadMediaFromR2 };

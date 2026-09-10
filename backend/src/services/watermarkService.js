// ============================================================
// KASOLIFE — Service watermark visible v1.0
// Ajoute un texte semi-transparent (userId + timestamp) sur les
// images servies aux fans. Utilise Sharp pour le traitement.
// Activation contrôlée par platform_config.watermark_visible_enabled
// ADMIN+ : watermark non appliqué (req.isAdminAccess).
// ============================================================
'use strict';

const sharp              = require('sharp');
const configService      = require('./configService');
const { applyInvisibleWatermark } = require('./steganographyService');

// ── Générer le SVG texte watermark ──────────────────────────
const buildWatermarkSvg = (userId, width, height) => {
  const now   = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const label = `KasoLife · ${userId} · ${now}`;
  const fontSize = Math.max(12, Math.floor(width / 40));
  const padding  = fontSize;

  // Texte répété en diagonal sur toute l'image
  const lines = [];
  const step  = Math.max(80, Math.floor(height / 6));
  for (let y = step; y < height + step; y += step) {
    lines.push(
      `<text x="${padding}" y="${y}" font-size="${fontSize}" fill="rgba(255,255,255,0.35)"
       font-family="Arial,sans-serif" transform="rotate(-20,${width / 2},${height / 2})">${label}</text>`
    );
  }

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <style>text { font-weight: bold; letter-spacing: 1px; }</style>
      ${lines.join('\n')}
    </svg>`
  );
};

// ── Appliquer le watermark visible sur un buffer image ──────
// Retourne un Buffer PNG.
// userId : identifiant court affiché (ex: "USR-4821")
const applyVisibleWatermark = async (imageBuffer, userId) => {
  const image    = sharp(imageBuffer);
  const metadata = await image.metadata();
  const { width = 800, height = 600 } = metadata;

  const watermarkSvg = buildWatermarkSvg(userId, width, height);

  return image
    .composite([{ input: watermarkSvg, gravity: 'northwest' }])
    .png()
    .toBuffer();
};

// ── Middleware Express : watermark à la volée ─────────────────
// À utiliser sur les routes de streaming d'images (media proxy).
// Ne s'applique que si :
//   1. La feature est activée (platform_config.watermark_visible_enabled)
//   2. L'utilisateur n'est pas ADMIN+ (req.isAdminAccess !== true)
//   3. Un userId est disponible (req.user?.id)
const watermarkMiddleware = async (req, res, next) => {
  try {
    const enabled = await configService.get('watermark_visible_enabled');
    if (!enabled || enabled === 'false' || req.isAdminAccess) {
      return next();
    }
    // Intercepter la réponse uniquement si le contenu est une image
    const originalSend = res.send.bind(res);
    res.send = async function (body) {
      const ct = res.getHeader('Content-Type') || '';
      if (ct.startsWith('image/') && Buffer.isBuffer(body) && req.user?.id) {
        try {
          const watermarked = await applyVisibleWatermark(body, `U${req.user.id}`);
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Content-Length', watermarked.length);
          return originalSend(watermarked);
        } catch (_) {
          // En cas d'erreur, servir l'image originale sans watermark
          return originalSend(body);
        }
      }
      return originalSend(body);
    };
    next();
  } catch (_) {
    next();
  }
};

// ── Watermarker un fichier depuis son chemin ─────────────────
// Pratique pour les pre-process à l'upload.
const watermarkFile = async (filePath, outputPath, userId) => {
  const fs     = require('fs').promises;
  const input  = await fs.readFile(filePath);
  const output = await applyVisibleWatermark(input, `U${userId}`);
  await fs.writeFile(outputPath, output);
  return outputPath;
};

// ── Appliquer les deux watermarks (visible + invisible) ──────
// Ordre : invisible d'abord (LSB sur pixels), puis visible (SVG overlay).
// Si l'un est désactivé en config, on l'ignore.
const applyWatermarks = async (imageBuffer, userId) => {
  const [wmVisible, wmInvisible] = await Promise.all([
    configService.get('watermark_visible_enabled'),
    configService.get('watermark_invisible_enabled'),
  ]);

  let buf = imageBuffer;

  if (wmInvisible && wmInvisible !== 'false') {
    try { buf = await applyInvisibleWatermark(buf, userId); } catch (_) {}
  }
  if (wmVisible && wmVisible !== 'false') {
    try { buf = await applyVisibleWatermark(buf, userId); } catch (_) {}
  }

  return buf;
};

module.exports = {
  applyVisibleWatermark,
  applyWatermarks,
  watermarkMiddleware,
  watermarkFile,
};

// ============================================================
// KASOLIFE — Service de compression médias
// Objectif : réduire l'espace disque sans dégradation visuelle perceptible
//
// Images  → reconversion WebP qualité 85, redimensionnement max selon usage
//           (WebP ~30-50% plus léger que JPEG/PNG à qualité équivalente)
// Vidéos  → H.264 CRF 23 (qualité visuellement quasi-identique à la source),
//           résolution plafonnée à 1080p, audio AAC 128kbps
// Audio   → AAC 128kbps (transparent pour la voix/musique à débit modéré)
// ============================================================
'use strict';
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Dimensions maximales par usage — au-delà, redimensionnement (sans upscale)
const MAX_DIMENSIONS = {
  avatar:     { width: 512,  height: 512 },
  banner:     { width: 1600, height: 600 },
  thumbnail:  { width: 640,  height: 640 },
  post_image: { width: 2048, height: 2048 },
};

const MAX_VIDEO_HEIGHT = 1080;

/**
 * Compresse une image en WebP, en conservant le ratio et en limitant les dimensions.
 * @param {Buffer} buffer - fichier original
 * @param {string} type - 'avatar' | 'banner' | 'thumbnail' | 'post_image'
 * @returns {Promise<{ buffer: Buffer, mimetype: string, ext: string }>}
 */
async function compressImage(buffer, type) {
  const maxDim = MAX_DIMENSIONS[type] || MAX_DIMENSIONS.post_image;

  const output = await sharp(buffer)
    .rotate() // applique l'orientation EXIF puis la retire (évite les photos pivotées)
    .resize({
      width: maxDim.width,
      height: maxDim.height,
      fit: 'inside',            // ne jamais recadrer ni déformer
      withoutEnlargement: true, // ne jamais agrandir une petite image
    })
    .webp({ quality: 85, effort: 4 }) // 85 = imperceptible à l'œil, gain significatif
    .toBuffer();

  return { buffer: output, mimetype: 'image/webp', ext: 'webp' };
}

/**
 * Compresse une vidéo en H.264/AAC (mp4), plafonne la résolution à 1080p.
 * @param {Buffer} buffer - fichier original
 * @returns {Promise<{ buffer: Buffer, mimetype: string, ext: string }>}
 */
async function compressVideo(buffer) {
  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `${uuidv4()}-in`);
  const outputPath = path.join(tmpDir, `${uuidv4()}-out.mp4`);

  await fs.promises.writeFile(inputPath, buffer);

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .audioBitrate('128k')
        .outputOptions([
          '-vf', `scale='if(gt(ih,${MAX_VIDEO_HEIGHT}),-2,iw)':'if(gt(ih,${MAX_VIDEO_HEIGHT}),${MAX_VIDEO_HEIGHT},ih)'`,
          '-crf', '23',
          '-preset', 'medium',
          '-movflags', '+faststart',
          '-pix_fmt', 'yuv420p',
        ])
        .on('end', resolve)
        .on('error', reject)
        .save(outputPath);
    });

    const output = await fs.promises.readFile(outputPath);
    return { buffer: output, mimetype: 'video/mp4', ext: 'mp4' };
  } finally {
    await fs.promises.unlink(inputPath).catch(() => {});
    await fs.promises.unlink(outputPath).catch(() => {});
  }
}

/**
 * Compresse un fichier audio en AAC 128kbps (m4a).
 * @param {Buffer} buffer - fichier original
 * @returns {Promise<{ buffer: Buffer, mimetype: string, ext: string }>}
 */
async function compressAudio(buffer) {
  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `${uuidv4()}-in`);
  const outputPath = path.join(tmpDir, `${uuidv4()}-out.m4a`);

  await fs.promises.writeFile(inputPath, buffer);

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioCodec('aac')
        .audioBitrate('128k')
        .outputOptions(['-movflags', '+faststart'])
        .on('end', resolve)
        .on('error', reject)
        .save(outputPath);
    });

    const output = await fs.promises.readFile(outputPath);
    return { buffer: output, mimetype: 'audio/mp4', ext: 'm4a' };
  } finally {
    await fs.promises.unlink(inputPath).catch(() => {});
    await fs.promises.unlink(outputPath).catch(() => {});
  }
}

/**
 * Génère une vignette (image WebP) à partir de la première seconde d'une vidéo.
 * @param {Buffer} videoBuffer
 * @returns {Promise<{ buffer: Buffer, mimetype: string, ext: string }>}
 */
async function generateVideoThumbnail(videoBuffer) {
  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `${uuidv4()}-in`);
  const frameName = `${uuidv4()}-frame.jpg`;
  const framePath = path.join(tmpDir, frameName);

  await fs.promises.writeFile(inputPath, videoBuffer);

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({ timestamps: ['1'], filename: frameName, folder: tmpDir, size: '640x?' })
        .on('end', resolve)
        .on('error', reject);
    });

    const frameBuffer = await fs.promises.readFile(framePath);
    return compressImage(frameBuffer, 'thumbnail');
  } finally {
    await fs.promises.unlink(inputPath).catch(() => {});
    await fs.promises.unlink(framePath).catch(() => {});
  }
}

/**
 * Calcule une empreinte perceptuelle simple (différence de hachage / dHash) d'une image.
 * Permet de détecter des images quasi-identiques (republication de contenu)
 * même après recompression/redimensionnement léger.
 * @param {Buffer} buffer - image (n'importe quel format supporté par sharp)
 * @returns {Promise<string>} hash hexadécimal de 64 bits (16 caractères)
 */
async function computePerceptualHash(buffer) {
  // Réduit à 9x8 en niveaux de gris : permet de comparer chaque pixel à son voisin
  // de droite (8x8 = 64 comparaisons = 64 bits)
  const { data } = await sharp(buffer)
    .resize(9, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bits = '';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = data[row * 9 + col];
      const right = data[row * 9 + col + 1];
      bits += left > right ? '1' : '0';
    }
  }

  // Convertit les 64 bits en hexadécimal (16 caractères)
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

/**
 * Calcule la distance de Hamming entre deux hashes perceptuels hexadécimaux.
 * Une distance ≤ 5 sur 64 bits indique généralement des images très similaires.
 */
function hammingDistance(hashA, hashB) {
  if (!hashA || !hashB || hashA.length !== hashB.length) return Infinity;
  let distance = 0;
  for (let i = 0; i < hashA.length; i++) {
    const diff = parseInt(hashA[i], 16) ^ parseInt(hashB[i], 16);
    distance += [0,1,1,2,1,2,2,3,1,2,2,3,2,3,3,4][diff]; // popcount sur 4 bits
  }
  return distance;
}

module.exports = {
  compressImage, compressVideo, compressAudio, generateVideoThumbnail,
  computePerceptualHash, hammingDistance,
};

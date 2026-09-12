// ============================================================
// KASOLIFE — Routes /uploads v2.0
// Upload de médias vers Cloudflare R2 (avatars, bannières, posts)
// ============================================================
'use strict';
const express = require('express');
const multer  = require('multer');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authMiddleware, requireMinRole } = require('../middleware/auth');
const {
  compressImage, compressVideo, compressAudio, generateVideoThumbnail,
  computePerceptualHash, hammingDistance,
} = require('../services/mediaProcessing');
const { moderateImage, generateTags, generateCaption, getAIConfig, checkCategoryConsistency } = require('../services/aiModeration');
const { uploadAvatarToR2, deleteAvatarFromR2, uploadMediaToR2, deleteMediaFromR2, downloadMediaFromR2 } = require('../services/cloudflare');
const configService = require('../services/configService');

const router = express.Router();

// Tailles par défaut — remplacées dynamiquement depuis platform_config
const MAX_SIZES_DEFAULT = {
  avatar:     5,
  banner:     8,
  post_image: 15,
  post_video: 200,
  post_audio: 50,
  thumbnail:  5,
};

const getMaxSize = async (type) => {
  const keyMap = {
    avatar: 'max_upload_avatar_mb', banner: 'max_upload_banner_mb',
    post_image: 'max_upload_image_mb', post_video: 'max_upload_video_mb',
    post_audio: 'max_upload_audio_mb', thumbnail: 'max_upload_avatar_mb',
  };
  const mb = await configService.get(keyMap[type]) ?? MAX_SIZES_DEFAULT[type];
  return mb * 1024 * 1024;
};

const ALLOWED_MIME = {
  avatar:     ['image/jpeg', 'image/png', 'image/webp'],
  banner:     ['image/jpeg', 'image/png', 'image/webp'],
  thumbnail:  ['image/jpeg', 'image/png', 'image/webp'],
  post_image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  post_video: ['video/mp4', 'video/quicktime', 'video/webm'],
  post_audio: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg'],
};

const EXT_FROM_MIME = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/wav': 'wav', 'audio/ogg': 'ogg',
};

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

// ── POST /uploads/:type — upload générique
// type: avatar | banner | thumbnail | post_image | post_video | post_audio
router.post('/:type', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { type } = req.params;
    if (!ALLOWED_MIME[type]) return res.status(400).json({ error: 'Type de média invalide' });

    if (type.startsWith('post_') && req.user.role === 'user')
      return res.status(403).json({ error: 'Réservé aux créateurs' });

    if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
    if (!ALLOWED_MIME[type].includes(req.file.mimetype))
      return res.status(400).json({ error: `Format non supporté. Formats acceptés : ${ALLOWED_MIME[type].join(', ')}` });
    const maxSize = await getMaxSize(type);
    if (req.file.size > maxSize)
      return res.status(400).json({ error: `Fichier trop volumineux (max ${Math.round(maxSize / (1024 * 1024))} Mo)` });

    // ── AVATAR → R2 avec variantes (400, 240, 96px) ──────────────────────────
    if (type === 'avatar') {
      const { url: avatarUrl, key: avatarKey } = await uploadAvatarToR2(req.file.buffer, req.user.id);

      const { data: oldUser } = await supabase.from('users').select('avatar_url').eq('id', req.user.id).single();
      if (oldUser?.avatar_url) deleteAvatarFromR2(oldUser.avatar_url).catch(() => {});

      await supabase.from('users').update({ avatar_url: avatarUrl }).eq('id', req.user.id);

      return res.status(201).json({
        url: avatarUrl, key: avatarKey,
        original_size: req.file.size,
        storage: 'cloudflare_r2',
      });
    }

    // ── Compression ──────────────────────────────────────────────────────────
    let processed;
    try {
      if (['banner', 'thumbnail', 'post_image'].includes(type)) {
        processed = await compressImage(req.file.buffer, type);
      } else if (type === 'post_video') {
        processed = await compressVideo(req.file.buffer);
      } else if (type === 'post_audio') {
        processed = await compressAudio(req.file.buffer);
      } else {
        processed = { buffer: req.file.buffer, mimetype: req.file.mimetype, ext: EXT_FROM_MIME[req.file.mimetype] || 'bin' };
      }
    } catch {
      processed = { buffer: req.file.buffer, mimetype: req.file.mimetype, ext: EXT_FROM_MIME[req.file.mimetype] || 'bin' };
    }

    // ── Modération IA pour les images de post ────────────────────────────────
    let moderation = { status: 'NOT_SCANNED', reason: null };
    if (type === 'post_image') {
      moderation = await moderateImage(processed.buffer, processed.mimetype);
      if (moderation.status === 'REJECTED') {
        return res.status(422).json({
          error: 'Ce contenu ne respecte pas les règles de la plateforme et a été refusé.',
          moderation_reason: moderation.reason,
        });
      }
    }

    // ── Upload vers R2 ───────────────────────────────────────────────────────
    const { url: publicUrl, key: filePath } = await uploadMediaToR2(
      processed.buffer, req.user.id, type, processed.mimetype
    );

    const result = {
      url: publicUrl, path: filePath,
      original_size: req.file.size, compressed_size: processed.buffer.length,
      moderation_status: moderation.status,
      storage: 'cloudflare_r2',
    };

    // ── Tags IA + hash perceptuel + détection doublons + cohérence catégorie
    if (type === 'post_image') {
      const categoryName = (req.body?.category_name || '').slice(0, 50);
      const caption      = (req.body?.caption || '').slice(0, 300);

      result.ai_tags = await generateTags({
        caption, imageBuffer: processed.buffer, mimeType: processed.mimetype,
        categoryName: categoryName || 'Général',
      });

      try {
        const hash = await computePerceptualHash(processed.buffer);
        result.content_hash = hash;

        const aiConfig = await getAIConfig();
        if (aiConfig.AI_DUPLICATE_CONTENT_ENABLED) {
          const { data: existingPosts } = await supabase.from('posts')
            .select('id, content_hash, creator_id')
            .not('content_hash', 'is', null)
            .neq('creator_id', req.user.id)
            .limit(2000);
          for (const existing of existingPosts || []) {
            if (hammingDistance(hash, existing.content_hash) <= 5) {
              result.duplicate_of = existing.id;
              break;
            }
          }
        }
      } catch (hashErr) {
        console.error('[Uploads] Hash perceptuel échoué :', hashErr.message);
      }

      try {
        const consistency = await checkCategoryConsistency({
          imageBuffer: processed.buffer, mimeType: processed.mimetype,
          caption, categoryName: (req.body?.category_name || 'Général').slice(0, 50),
        });
        if (!consistency.consistent) {
          result.category_mismatch        = true;
          result.category_mismatch_reason = consistency.reason;
        }
      } catch {}
    }

    // ── Vignette automatique pour les vidéos ─────────────────────────────────
    if (type === 'post_video') {
      try {
        const thumb = await generateVideoThumbnail(req.file.buffer);

        const thumbModeration = await moderateImage(thumb.buffer, thumb.mimetype);
        if (thumbModeration.status === 'REJECTED') {
          await deleteMediaFromR2(publicUrl);
          return res.status(422).json({
            error: 'Ce contenu ne respecte pas les règles de la plateforme et a été refusé.',
            moderation_reason: thumbModeration.reason,
          });
        }
        result.moderation_status = thumbModeration.status === 'FLAGGED' ? 'FLAGGED' : result.moderation_status;
        result.moderation_reason = thumbModeration.reason;

        const categoryName = (req.body?.category_name || '').slice(0, 50);
        const caption      = (req.body?.caption || '').slice(0, 300);

        result.ai_tags = await generateTags({
          caption, imageBuffer: thumb.buffer, mimeType: thumb.mimetype,
          categoryName: categoryName || 'Général',
        });

        try {
          const hash = await computePerceptualHash(thumb.buffer);
          result.content_hash = hash;

          const aiConfig = await getAIConfig();
          if (aiConfig.AI_DUPLICATE_CONTENT_ENABLED) {
            const { data: existingPosts } = await supabase.from('posts')
              .select('id, content_hash, creator_id')
              .not('content_hash', 'is', null)
              .neq('creator_id', req.user.id)
              .limit(2000);
            for (const existing of existingPosts || []) {
              if (hammingDistance(hash, existing.content_hash) <= 5) {
                result.duplicate_of = existing.id;
                break;
              }
            }
          }
        } catch {}

        try {
          const consistency = await checkCategoryConsistency({
            imageBuffer: thumb.buffer, mimeType: thumb.mimetype,
            caption, categoryName: categoryName || 'Général',
          });
          if (!consistency.consistent) {
            result.category_mismatch        = true;
            result.category_mismatch_reason = consistency.reason;
          }
        } catch {}

        const { url: thumbUrl } = await uploadMediaToR2(thumb.buffer, req.user.id, 'thumbnail', thumb.mimetype);
        result.thumbnail_url = thumbUrl;
      } catch (thumbErr) {
        console.error('[Uploads] Génération vignette échouée :', thumbErr.message);
      }
    }

    // Persister la bannière sur le profil
    if (type === 'banner') {
      await supabase.from('users').update({ banner_url: publicUrl }).eq('id', req.user.id);
    }

    res.status(201).json(result);
  } catch (err) { res.status(500).json({ error: 'Erreur lors du téléversement', details: err.message }); }
});

// ── DELETE /uploads — supprimer un fichier par URL R2
router.delete('/', authMiddleware, async (req, res) => {
  try {
    const { url: fileUrl } = req.body;
    if (!fileUrl) return res.status(400).json({ error: 'url requis' });

    const pubBase = (process.env.CLOUDFLARE_R2_PUBLIC_URL || '').replace(/\/$/, '');
    if (!pubBase || !fileUrl.startsWith(pubBase))
      return res.status(400).json({ error: 'URL R2 invalide' });

    const key = fileUrl.slice(pubBase.length + 1);
    if (!key.startsWith(`${req.user.id}/`) && !['admin','super_admin','root_admin'].includes(req.user.role))
      return res.status(403).json({ error: 'Accès refusé' });

    await deleteMediaFromR2(fileUrl);
    res.json({ message: 'Fichier supprimé' });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /uploads/generate-caption — génère une légende IA pour un média R2
// Body : { url, category_name?, tone? }
router.post('/generate-caption', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const { url: fileUrl, category_name, tone } = req.body;
    if (!fileUrl) return res.status(400).json({ error: 'url requis' });

    const pubBase = (process.env.CLOUDFLARE_R2_PUBLIC_URL || '').replace(/\/$/, '');
    if (!pubBase || !fileUrl.startsWith(pubBase))
      return res.status(400).json({ error: 'URL R2 invalide' });

    const key = fileUrl.slice(pubBase.length + 1);
    if (!key.startsWith(`${req.user.id}/`) && !['admin','super_admin','root_admin'].includes(req.user.role))
      return res.status(403).json({ error: 'Accès refusé' });

    const buffer  = await downloadMediaFromR2(key);
    const ext     = key.split('.').pop()?.toLowerCase();
    const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    const mimeType = mimeMap[ext] || 'image/jpeg';

    const caption = await generateCaption({
      imageBuffer: buffer, mimeType,
      categoryName: (category_name || 'Général').slice(0, 50),
      tone: tone || 'engageant',
    });

    if (!caption) return res.status(503).json({ error: 'Génération de légende indisponible pour le moment' });
    res.json({ caption });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur', details: err.message }); }
});

module.exports = router;

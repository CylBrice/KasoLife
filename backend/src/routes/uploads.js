// ============================================================
// KASOLIFE — Routes /uploads v1.0
// Upload de médias (avatars, bannières, contenu posts) vers Supabase Storage
// Buckets attendus : 'avatars' (public), 'banners' (public), 'posts' (public/privé selon config bucket)
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

const router = express.Router();

const MAX_SIZES = {
  avatar:    5  * 1024 * 1024,  // 5 Mo
  banner:    8  * 1024 * 1024,  // 8 Mo
  post_image: 15 * 1024 * 1024, // 15 Mo
  post_video: 200 * 1024 * 1024, // 200 Mo
  post_audio: 50 * 1024 * 1024,  // 50 Mo
  thumbnail: 5  * 1024 * 1024,  // 5 Mo
};

const ALLOWED_MIME = {
  avatar:     ['image/jpeg', 'image/png', 'image/webp'],
  banner:     ['image/jpeg', 'image/png', 'image/webp'],
  thumbnail:  ['image/jpeg', 'image/png', 'image/webp'],
  post_image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  post_video: ['video/mp4', 'video/quicktime', 'video/webm'],
  post_audio: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg'],
};

const BUCKET_FOR = {
  avatar: 'avatars', banner: 'banners', thumbnail: 'thumbnails',
  post_image: 'posts', post_video: 'posts', post_audio: 'posts',
};

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

const EXT_FROM_MIME = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/wav': 'wav', 'audio/ogg': 'ogg',
};

// ── POST /uploads/:type — upload générique
// type: avatar | banner | thumbnail | post_image | post_video | post_audio
router.post('/:type', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { type } = req.params;
    if (!ALLOWED_MIME[type]) return res.status(400).json({ error: 'Type de média invalide' });

    // Seuls les créateurs peuvent uploader du contenu de post
    if (type.startsWith('post_') && req.user.role === 'user')
      return res.status(403).json({ error: 'Réservé aux créateurs' });

    if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
    if (!ALLOWED_MIME[type].includes(req.file.mimetype))
      return res.status(400).json({ error: `Format non supporté. Formats acceptés : ${ALLOWED_MIME[type].join(', ')}` });
    if (req.file.size > MAX_SIZES[type])
      return res.status(400).json({ error: `Fichier trop volumineux (max ${Math.round(MAX_SIZES[type] / (1024 * 1024))} Mo)` });

    const bucket = BUCKET_FOR[type];

    // ── Compression côté serveur — réduit le poids sans dégradation perceptible
    let processed;
    try {
      if (['avatar', 'banner', 'thumbnail', 'post_image'].includes(type)) {
        processed = await compressImage(req.file.buffer, type);
      } else if (type === 'post_video') {
        processed = await compressVideo(req.file.buffer);
      } else if (type === 'post_audio') {
        processed = await compressAudio(req.file.buffer);
      } else {
        processed = { buffer: req.file.buffer, mimetype: req.file.mimetype, ext: EXT_FROM_MIME[req.file.mimetype] || 'bin' };
      }
    } catch (compErr) {
      console.error('[Uploads] Compression échouée, envoi du fichier original :', compErr.message);
      processed = { buffer: req.file.buffer, mimetype: req.file.mimetype, ext: EXT_FROM_MIME[req.file.mimetype] || 'bin' };
    }

    const filePath = `${req.user.id}/${type}/${uuidv4()}.${processed.ext}`;

    // ── Modération IA (si activée par un admin) — bloque le stockage si REJECTED
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

    const { error: uploadErr } = await supabase.storage.from(bucket).upload(filePath, processed.buffer, {
      contentType: processed.mimetype,
      cacheControl: '31536000', // 1 an — fichiers immuables (nouveau nom à chaque upload)
      upsert: false,
    });
    if (uploadErr) throw uploadErr;

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
    const publicUrl = publicUrlData?.publicUrl;

    const result = {
      url: publicUrl, path: filePath, bucket,
      original_size: req.file.size, compressed_size: processed.buffer.length,
      moderation_status: moderation.status,
    };

    // ── Tags IA + hash perceptuel + détection de doublons + cohérence catégorie
    // (best-effort, n'empêchent jamais l'upload en cas d'échec)
    if (type === 'post_image') {
      const categoryName = (req.body?.category_name || '').slice(0, 50);
      const caption = (req.body?.caption || '').slice(0, 300);

      result.ai_tags = await generateTags({
        caption, imageBuffer: processed.buffer, mimeType: processed.mimetype,
        categoryName: categoryName || 'Général',
      });

      // Empreinte perceptuelle — pour détecter les republications de contenu
      try {
        const hash = await computePerceptualHash(processed.buffer);
        result.content_hash = hash;

        const aiConfig = await getAIConfig();
        if (aiConfig.AI_DUPLICATE_CONTENT_ENABLED) {
          const { data: existingPosts } = await supabase.from('posts')
            .select('id, content_hash, creator_id')
            .not('content_hash', 'is', null)
            .neq('creator_id', req.user.id) // republication par un AUTRE créateur = suspect
            .limit(2000);
          for (const existing of existingPosts || []) {
            if (hammingDistance(hash, existing.content_hash) <= 5) {
              result.duplicate_of = existing.id;
              break;
            }
          }
        }
      } catch (hashErr) {
        console.error('[Uploads] Calcul hash perceptuel échoué :', hashErr.message);
      }

      // Cohérence catégorie/contenu
      try {
        const consistency = await checkCategoryConsistency({
          imageBuffer: processed.buffer, mimeType: processed.mimetype,
          caption, categoryName: categoryName || 'Général',
        });
        if (!consistency.consistent) {
          result.category_mismatch = true;
          result.category_mismatch_reason = consistency.reason;
        }
      } catch (consErr) {
        console.error('[Uploads] Vérification cohérence catégorie échouée :', consErr.message);
      }
    }

    // ── Vignette automatique pour les vidéos (+ modération sur la vignette)
    if (type === 'post_video') {
      try {
        const thumb = await generateVideoThumbnail(req.file.buffer);

        const thumbModeration = await moderateImage(thumb.buffer, thumb.mimetype);
        if (thumbModeration.status === 'REJECTED') {
          // La vidéo est déjà stockée mais on bloque sa publication : on la supprime
          await supabase.storage.from(bucket).remove([filePath]);
          return res.status(422).json({
            error: 'Ce contenu ne respecte pas les règles de la plateforme et a été refusé.',
            moderation_reason: thumbModeration.reason,
          });
        }
        result.moderation_status = thumbModeration.status === 'FLAGGED' ? 'FLAGGED' : result.moderation_status;
        result.moderation_reason = thumbModeration.reason;

        const categoryName = (req.body?.category_name || '').slice(0, 50);
        const caption = (req.body?.caption || '').slice(0, 300);
        result.ai_tags = await generateTags({
          caption, imageBuffer: thumb.buffer, mimeType: thumb.mimetype,
          categoryName: categoryName || 'Général',
        });

        // Empreinte perceptuelle + détection de doublons (sur la vignette)
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
        } catch (hashErr) {
          console.error('[Uploads] Calcul hash perceptuel échoué :', hashErr.message);
        }

        // Cohérence catégorie/contenu (sur la vignette)
        try {
          const consistency = await checkCategoryConsistency({
            imageBuffer: thumb.buffer, mimeType: thumb.mimetype,
            caption, categoryName: categoryName || 'Général',
          });
          if (!consistency.consistent) {
            result.category_mismatch = true;
            result.category_mismatch_reason = consistency.reason;
          }
        } catch (consErr) {
          console.error('[Uploads] Vérification cohérence catégorie échouée :', consErr.message);
        }

        const thumbPath = `${req.user.id}/thumbnail/${uuidv4()}.${thumb.ext}`;
        const { error: thumbErr } = await supabase.storage.from('thumbnails').upload(thumbPath, thumb.buffer, {
          contentType: thumb.mimetype, cacheControl: '31536000', upsert: false,
        });
        if (!thumbErr) {
          const { data: thumbUrlData } = supabase.storage.from('thumbnails').getPublicUrl(thumbPath);
          result.thumbnail_url = thumbUrlData?.publicUrl;
        }
      } catch (thumbErr) {
        console.error('[Uploads] Génération vignette échouée :', thumbErr.message);
      }
    }

    // Mettre à jour automatiquement le profil pour avatar/banner
    if (type === 'avatar') {
      await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', req.user.id);
    } else if (type === 'banner') {
      await supabase.from('users').update({ banner_url: publicUrl }).eq('id', req.user.id);
    }

    res.status(201).json(result);
  } catch (err) { res.status(500).json({ error: 'Erreur lors du téléversement', details: err.message }); }
});

// ── DELETE /uploads — supprimer un fichier (le propriétaire uniquement, via path complet)
router.delete('/', authMiddleware, async (req, res) => {
  try {
    const { bucket, path: filePath } = req.body;
    if (!bucket || !filePath) return res.status(400).json({ error: 'bucket et path requis' });

    // Vérifier que le fichier appartient bien à l'utilisateur (préfixe userId/)
    if (!filePath.startsWith(`${req.user.id}/`) && !['admin','super_admin','root_admin'].includes(req.user.role))
      return res.status(403).json({ error: 'Accès refusé' });

    const { error } = await supabase.storage.from(bucket).remove([filePath]);
    if (error) throw error;

    res.json({ message: 'Fichier supprimé' });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /uploads/generate-caption — génère une légende IA pour un média déjà uploadé
// Body : { bucket, path, category_name?, tone? }
router.post('/generate-caption', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const { bucket, path: filePath, category_name, tone } = req.body;
    if (!bucket || !filePath) return res.status(400).json({ error: 'bucket et path requis' });
    if (!filePath.startsWith(`${req.user.id}/`) && !['admin','super_admin','root_admin'].includes(req.user.role))
      return res.status(403).json({ error: 'Accès refusé' });

    const { data, error } = await supabase.storage.from(bucket).download(filePath);
    if (error) throw error;

    const buffer = Buffer.from(await data.arrayBuffer());
    const ext = filePath.split('.').pop()?.toLowerCase();
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

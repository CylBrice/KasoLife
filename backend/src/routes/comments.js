// ============================================================
// KASOLIFE — Routes /posts/:postId/comments v1.0
// CRUD commentaires : créer, lire, supprimer, liker, épingler
// Support threading (réponses aux commentaires)
// Modération IA intégrée
// ============================================================
'use strict';
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authMiddleware, requireMinRole } = require('../middleware/auth');
const { moderateText } = require('../services/aiModeration');

const router = express.Router({ mergeParams: true }); // pour accéder à :postId

const COMMENT_MAX_LENGTH = 1000;
const COMMENT_MAX_DEPTH = 10;

// ── Helper: Résoudre l'accès au post (pour valider que l'utilisateur peut commenter)
const canAccessPost = async (postId, userId) => {
  const { data: post } = await supabase.from('posts')
    .select('id, creator_id, access_level')
    .eq('id', postId)
    .single();

  if (!post) return { canAccess: false, reason: 'POST_NOT_FOUND' };
  if (post.access_level === 'FREE') return { canAccess: true, reason: 'FREE' };
  if (!userId) return { canAccess: false, reason: 'AUTH_REQUIRED' };
  if (userId === post.creator_id) return { canAccess: true, reason: 'OWNER' };

  if (post.access_level === 'SUBSCRIBERS') {
    const { data: sub } = await supabase.from('subscriptions')
      .select('id').eq('fan_id', userId).eq('creator_id', post.creator_id).eq('status', 'ACTIVE').single();
    return { canAccess: !!sub, reason: sub ? 'SUBSCRIBED' : 'SUBSCRIPTION_REQUIRED' };
  }

  if (post.access_level === 'PPV') {
    const { data: purchase } = await supabase.from('post_purchases')
      .select('id').eq('post_id', postId).eq('buyer_id', userId).single();
    return { canAccess: !!purchase, reason: purchase ? 'PURCHASED' : 'PURCHASE_REQUIRED' };
  }

  return { canAccess: false, reason: 'UNKNOWN' };
};

// ── GET /posts/:postId/comments — lire tous les commentaires d'un post (avec pagination)
router.get('/', async (req, res) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 50, sort_by = 'recent' } = req.query;
    const pageNum  = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const offset   = (pageNum - 1) * pageSize;

    // Vérifier que le post existe
    const { data: post } = await supabase.from('posts')
      .select('id').eq('id', postId).single();
    if (!post) return res.status(404).json({ error: 'Post not found' });

    // Récupérer les commentaires (seulement les top-level, pas les réponses)
    let query = supabase.from('post_comments')
      .select(`
        id, post_id, user_id, parent_id, content, likes_count, is_pinned, is_flagged, created_at, updated_at,
        user:users!post_comments_user_id_fkey(id, pseudo, avatar_url, role)
      `)
      .eq('post_id', postId)
      .is('parent_id', true); // Seulement les commentaires top-level

    if (sort_by === 'popular') {
      query = query.order('likes_count', { ascending: false }).order('created_at', { ascending: false });
    } else if (sort_by === 'oldest') {
      query = query.order('created_at', { ascending: true });
    } else { // 'recent' (default)
      query = query.order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
    }

    const { data: comments, error, count } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;

    // Pour chaque commentaire, récupérer les replies
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        const { data: replies } = await supabase.from('post_comments')
          .select(`
            id, post_id, user_id, parent_id, content, likes_count, is_pinned, is_flagged, created_at, updated_at,
            user:users!post_comments_user_id_fkey(id, pseudo, avatar_url, role)
          `)
          .eq('parent_id', comment.id)
          .order('created_at', { ascending: true });

        return {
          ...comment,
          replies: replies || [],
          reply_count: replies?.length || 0,
        };
      })
    );

    res.json({
      comments: commentsWithReplies,
      pagination: { page: pageNum, limit: pageSize, total: count || 0, pages: Math.ceil((count || 0) / pageSize) },
    });
  } catch (err) {
    console.error('GET /posts/:postId/comments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /posts/:postId/comments/:commentId/thread — lire un commentaire + tous ses replies en thread
router.get('/:commentId/thread', async (req, res) => {
  try {
    const { postId, commentId } = req.params;

    // Vérifier que le commentaire existe et appartient au post
    const { data: comment } = await supabase.from('post_comments')
      .select('id, post_id').eq('id', commentId).eq('post_id', postId).single();
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    // Utiliser la fonction RPC pour récupérer le thread complet
    const { data: thread, error } = await supabase.rpc('get_comment_thread', { p_comment_id: commentId });
    if (error) throw error;

    res.json({ thread });
  } catch (err) {
    console.error('GET /posts/:postId/comments/:commentId/thread error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /posts/:postId/comments — créer un nouveau commentaire
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, parent_id } = req.body;
    const userId = req.user.id;

    // Validation
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required' });
    }
    if (content.length > COMMENT_MAX_LENGTH) {
      return res.status(400).json({ error: `Comment must be ${COMMENT_MAX_LENGTH} chars or less` });
    }
    if (content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }

    // Vérifier accès au post
    const access = await canAccessPost(postId, userId);
    if (!access.canAccess) {
      return res.status(403).json({ error: access.reason });
    }

    // Si parent_id est fourni, vérifier que le commentaire parent existe et appartient au même post
    if (parent_id) {
      const { data: parentComment } = await supabase.from('post_comments')
        .select('id, post_id').eq('id', parent_id).eq('post_id', postId).single();
      if (!parentComment) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }
    }

    // Modération IA : détecter le spam/contenu toxique
    const moderation = await moderateText(content);
    const isFlagged = moderation.isToxic || moderation.isSpam;

    // Créer le commentaire
    const commentId = uuidv4();
    const { error: insertError } = await supabase.from('post_comments')
      .insert({
        id: commentId,
        post_id: postId,
        user_id: userId,
        content: content.trim(),
        parent_id: parent_id || null,
        is_flagged: isFlagged,
      });

    if (insertError) throw insertError;

    // Récupérer le commentaire créé avec les infos utilisateur
    const { data: newComment, error: fetchError } = await supabase.from('post_comments')
      .select(`
        id, post_id, user_id, parent_id, content, likes_count, is_pinned, is_flagged, created_at, updated_at,
        user:users!post_comments_user_id_fkey(id, pseudo, avatar_url, role)
      `)
      .eq('id', commentId)
      .single();

    if (fetchError) throw fetchError;

    // Créer notification pour le créateur du post (si ce n'est pas lui qui commente)
    if (userId !== req.params.creatorId) {
      const { data: post } = await supabase.from('posts')
        .select('creator_id').eq('id', postId).single();

      if (post && post.creator_id !== userId) {
        await supabase.from('notifications')
          .insert({
            id: uuidv4(),
            user_id: post.creator_id,
            title: `${req.user.pseudo} a commenté ton post`,
            message: content.substring(0, 100),
            type: 'COMMENT',
          });
      }
    }

    res.status(201).json({
      message: 'Comment created',
      comment: newComment,
      flagged_for_moderation: isFlagged,
    });
  } catch (err) {
    console.error('POST /posts/:postId/comments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /posts/:postId/comments/:commentId — modifier un commentaire (auteur seulement)
router.put('/:commentId', authMiddleware, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || content.length > COMMENT_MAX_LENGTH) {
      return res.status(400).json({ error: 'Invalid content' });
    }

    // Récupérer le commentaire
    const { data: comment } = await supabase.from('post_comments')
      .select('id, post_id, user_id').eq('id', commentId).eq('post_id', postId).single();

    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.user_id !== userId) {
      return res.status(403).json({ error: 'Can only edit own comments' });
    }

    // Modération IA
    const moderation = await moderateText(content);
    const isFlagged = moderation.isToxic || moderation.isSpam;

    // Mettre à jour
    const { error: updateError } = await supabase.from('post_comments')
      .update({
        content: content.trim(),
        is_flagged: isFlagged,
        updated_at: new Date().toISOString(),
      })
      .eq('id', commentId);

    if (updateError) throw updateError;

    // Récupérer le commentaire mis à jour
    const { data: updated } = await supabase.from('post_comments')
      .select(`
        id, post_id, user_id, parent_id, content, likes_count, is_pinned, is_flagged, created_at, updated_at,
        user:users!post_comments_user_id_fkey(id, pseudo, avatar_url, role)
      `)
      .eq('id', commentId)
      .single();

    res.json({ message: 'Comment updated', comment: updated });
  } catch (err) {
    console.error('PUT /posts/:postId/comments/:commentId error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /posts/:postId/comments/:commentId — supprimer un commentaire (auteur ou créateur du post)
router.delete('/:commentId', authMiddleware, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.user.id;

    // Récupérer le commentaire
    const { data: comment } = await supabase.from('post_comments')
      .select('id, post_id, user_id').eq('id', commentId).eq('post_id', postId).single();

    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    // Récupérer le créateur du post
    const { data: post } = await supabase.from('posts')
      .select('creator_id').eq('id', postId).single();

    // Vérifier autorisations: auteur du commentaire OU créateur du post
    if (comment.user_id !== userId && post.creator_id !== userId) {
      return res.status(403).json({ error: 'Can only delete own comments or post creator can delete any' });
    }

    // Supprimer le commentaire (les replies orphelines seront conservées)
    const { error: deleteError } = await supabase.from('post_comments')
      .delete()
      .eq('id', commentId);

    if (deleteError) throw deleteError;

    res.json({ message: 'Comment deleted' });
  } catch (err) {
    console.error('DELETE /posts/:postId/comments/:commentId error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /posts/:postId/comments/:commentId/like — liker un commentaire
router.post('/:commentId/like', authMiddleware, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.user.id;

    // Vérifier que le commentaire existe
    const { data: comment } = await supabase.from('post_comments')
      .select('id, post_id').eq('id', commentId).eq('post_id', postId).single();

    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    // Vérifier si l'utilisateur l'a déjà liké
    const { data: existing } = await supabase.from('comment_likes')
      .select('id').eq('comment_id', commentId).eq('user_id', userId).single();

    if (existing) {
      return res.status(409).json({ error: 'Already liked this comment' });
    }

    // Ajouter le like
    const { error: insertError } = await supabase.from('comment_likes')
      .insert({
        id: uuidv4(),
        comment_id: commentId,
        user_id: userId,
      });

    if (insertError) throw insertError;

    // Incrémenter le compteur
    await supabase.from('post_comments')
      .update({ likes_count: 'likes_count + 1' })
      .eq('id', commentId);

    res.json({ message: 'Comment liked' });
  } catch (err) {
    console.error('POST /posts/:postId/comments/:commentId/like error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /posts/:postId/comments/:commentId/like — retirer un like
router.delete('/:commentId/like', authMiddleware, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    // Récupérer le like
    const { data: like } = await supabase.from('comment_likes')
      .select('id').eq('comment_id', commentId).eq('user_id', userId).single();

    if (!like) return res.status(404).json({ error: 'Like not found' });

    // Supprimer le like
    await supabase.from('comment_likes').delete().eq('id', like.id);

    // Décrémenter le compteur
    await supabase.from('post_comments')
      .update({ likes_count: 'GREATEST(0, likes_count - 1)' })
      .eq('id', commentId);

    res.json({ message: 'Like removed' });
  } catch (err) {
    console.error('DELETE /posts/:postId/comments/:commentId/like error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /posts/:postId/comments/:commentId/pin — épingler un commentaire (créateur du post seulement)
router.put('/:commentId/pin', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.user.id;

    // Vérifier que l'utilisateur est le créateur du post
    const { data: post } = await supabase.from('posts')
      .select('creator_id').eq('id', postId).single();

    if (!post || post.creator_id !== userId) {
      return res.status(403).json({ error: 'Only post creator can pin comments' });
    }

    // Récupérer le commentaire
    const { data: comment } = await supabase.from('post_comments')
      .select('is_pinned').eq('id', commentId).eq('post_id', postId).single();

    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    // Toggle pin
    const { error: updateError } = await supabase.from('post_comments')
      .update({ is_pinned: !comment.is_pinned })
      .eq('id', commentId);

    if (updateError) throw updateError;

    res.json({
      message: comment.is_pinned ? 'Comment unpinned' : 'Comment pinned',
      is_pinned: !comment.is_pinned,
    });
  } catch (err) {
    console.error('PUT /posts/:postId/comments/:commentId/pin error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

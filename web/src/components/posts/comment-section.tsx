'use client';

import { useState, useEffect, useCallback } from 'react';
import { Heart, MessageCircle, Trash2, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface User {
  id: string;
  pseudo: string;
  avatar_url?: string;
  role: string;
}

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id?: string | null;
  content: string;
  likes_count: number;
  is_pinned: boolean;
  is_flagged: boolean;
  created_at: string;
  user: User;
  replies?: Comment[];
  reply_count?: number;
}

interface CommentSectionProps {
  postId: string;
  creatorId: string;
  isAuthenticated: boolean;
  currentUserId?: string;
  onCommentAdded?: () => void;
}

export function CommentSection({
  postId,
  creatorId,
  isAuthenticated,
  currentUserId,
  onCommentAdded,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'oldest'>('recent');
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Fetch comments
  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/posts/${postId}/comments?sort=${sortBy}`,
        {
          headers: {
            ...(isAuthenticated && currentUserId && { 'Authorization': `Bearer ${currentUserId}` }),
          },
        }
      );
      if (!res.ok) throw new Error('Failed to fetch comments');
      const data = await res.json();
      setComments(data.comments || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  }, [postId, sortBy, isAuthenticated, currentUserId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Submit new comment
  const handleSubmitComment = async (e: React.FormEvent, parentId?: string) => {
    e.preventDefault();
    if (!isAuthenticated) {
      alert('Veuillez vous connecter pour commenter');
      return;
    }

    const text = parentId ? replyText : newComment;
    if (!text.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          parent_id: parentId || null,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || 'Erreur lors de la création du commentaire');
        return;
      }

      if (parentId) {
        setReplyText('');
        setReplyingTo(null);
      } else {
        setNewComment('');
      }

      await fetchComments();
      onCommentAdded?.();
    } catch (error) {
      console.error('Error submitting comment:', error);
      alert('Erreur serveur');
    } finally {
      setSubmitting(false);
    }
  };

  // Like comment
  const handleLikeComment = async (commentId: string) => {
    if (!isAuthenticated) {
      alert('Veuillez vous connecter');
      return;
    }

    try {
      const res = await fetch(
        `/api/posts/${postId}/comments/${commentId}/like`,
        { method: 'POST' }
      );

      if (res.ok) {
        await fetchComments();
      }
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce commentaire ?')) return;

    try {
      const res = await fetch(
        `/api/posts/${postId}/comments/${commentId}`,
        { method: 'DELETE' }
      );

      if (res.ok) {
        await fetchComments();
      } else {
        alert('Erreur : vous ne pouvez pas supprimer ce commentaire');
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  // Pin comment
  const handlePinComment = async (commentId: string) => {
    if (creatorId !== currentUserId) {
      alert('Seul le créateur peut épingler les commentaires');
      return;
    }

    try {
      const res = await fetch(
        `/api/posts/${postId}/comments/${commentId}/pin`,
        { method: 'PUT' }
      );

      if (res.ok) {
        await fetchComments();
      }
    } catch (error) {
      console.error('Error pinning comment:', error);
    }
  };

  const CommentItem = ({ comment, level = 0 }: { comment: Comment; level?: number }) => {
    const isOwner = currentUserId === comment.user_id;
    const isCreator = currentUserId === creatorId;
    const canDelete = isOwner || isCreator;
    const showReplies = expandedReplies.has(comment.id);

    return (
      <div key={comment.id} style={{ marginLeft: level > 0 ? '40px' : '0' }} className="mb-4 pb-4 border-b last:border-b-0">
        {/* Comment header */}
        <div className="flex gap-3 mb-2">
          {comment.user.avatar_url && (
            <img
              src={comment.user.avatar_url}
              alt={comment.user.pseudo}
              className="w-8 h-8 rounded-full object-cover"
            />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{comment.user.pseudo}</span>
              {comment.user.['influencer','admin','super_admin','root_admin'].includes(role) && (
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Créateur</span>
              )}
              {comment.is_pinned && (
                <Pin className="w-3 h-3 text-amber-600" />
              )}
              <span className="text-xs text-gray-500">
                {new Date(comment.created_at).toLocaleDateString('fr-FR')}
              </span>
            </div>
          </div>
        </div>

        {/* Comment content */}
        <p className="text-sm text-gray-700 mb-3 break-words">{comment.content}</p>

        {/* Comment actions */}
        <div className="flex items-center gap-4 text-xs">
          <button
            onClick={() => handleLikeComment(comment.id)}
            className="flex items-center gap-1 text-gray-500 hover:text-red-500 transition"
          >
            <Heart className="w-4 h-4" />
            <span>{comment.likes_count}</span>
          </button>

          {level === 0 && (comment.reply_count || 0) > 0 && (
            <button
              onClick={() => setExpandedReplies(new Set(
                showReplies
                  ? Array.from(expandedReplies).filter(id => id !== comment.id)
                  : [...expandedReplies, comment.id]
              ))}
              className="flex items-center gap-1 text-gray-500 hover:text-blue-500 transition"
            >
              <MessageCircle className="w-4 h-4" />
              <span>{comment.reply_count} réponse{(comment.reply_count || 0) > 1 ? 's' : ''}</span>
            </button>
          )}

          {level === 0 && (
            <button
              onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
              className="text-gray-500 hover:text-blue-500 transition"
            >
              Répondre
            </button>
          )}

          {canDelete && (
            <button
              onClick={() => handleDeleteComment(comment.id)}
              className="text-gray-500 hover:text-red-500 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {isCreator && (
            <button
              onClick={() => handlePinComment(comment.id)}
              className={`transition ${comment.is_pinned ? 'text-amber-600' : 'text-gray-500 hover:text-amber-600'}`}
            >
              <Pin className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Reply form */}
        {replyingTo === comment.id && level === 0 && (
          <form onSubmit={(e) => handleSubmitComment(e, comment.id)} className="mt-3 pt-3 border-t">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Votre réponse..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="text-sm"
                disabled={submitting}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!replyText.trim() || submitting}
              >
                {submitting ? 'Envoi...' : 'Répondre'}
              </Button>
            </div>
          </form>
        )}

        {/* Replies */}
        {level === 0 && showReplies && comment.replies && comment.replies.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            {comment.replies.map(reply => (
              <CommentItem key={reply.id} comment={reply} level={1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Comment form */}
      {isAuthenticated ? (
        <form onSubmit={(e) => handleSubmitComment(e)} className="mb-6 p-4 bg-gray-50 rounded-lg">
          <Input
            type="text"
            placeholder="Écrivez un commentaire..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            maxLength={1000}
            disabled={submitting}
            className="mb-2"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">
              {newComment.length} / 1000
            </span>
            <Button
              type="submit"
              disabled={!newComment.trim() || submitting}
              size="sm"
            >
              {submitting ? 'Envoi...' : 'Commenter'}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-gray-600 p-4 bg-blue-50 rounded-lg">
          <a href="/connexion" className="text-blue-600 hover:underline">Connectez-vous</a> pour commenter
        </p>
      )}

      {/* Sort options */}
      <div className="flex gap-2 mb-4">
        {(['recent', 'popular', 'oldest'] as const).map(sort => (
          <button
            key={sort}
            onClick={() => setSortBy(sort)}
            className={`text-sm px-3 py-1 rounded transition ${
              sortBy === sort
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {sort === 'recent' ? 'Récent' : sort === 'popular' ? 'Populaire' : 'Ancien'}
          </button>
        ))}
      </div>

      {/* Comments list */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Chargement des commentaires...</div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Aucun commentaire pour le moment. Soyez le premier !
        </div>
      ) : (
        <div className="space-y-0">
          {comments.map(comment => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      )}
    </div>
  );
}

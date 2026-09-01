'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Trash2, Clock } from 'lucide-react';

interface ScheduledPost {
  id: string;
  caption: string;
  media_url: string;
  scheduled_at: string;
  created_at: string;
}

export function ScheduledPostsList() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchScheduledPosts = async () => {
      try {
        const response = await api.get('/posts/scheduled');
        setPosts(response.data.posts || []);
      } catch (err) {
        console.error('Erreur lors de la récupération des posts programmés:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchScheduledPosts();
  }, [user]);

  const handleReschedule = async (postId: string) => {
    const newDate = window.prompt('Nouvelle date/heure (YYYY-MM-DD HH:MM):');
    if (!newDate) return;

    try {
      const scheduledAt = new Date(newDate).toISOString();
      await api.put(`/posts/${postId}/reschedule`, { scheduled_at: scheduledAt });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, scheduled_at: scheduledAt } : p
        )
      );
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur lors de la reprogrammation.');
    }
  };

  const handleCancel = async (postId: string) => {
    if (!window.confirm('Annuler la programmation et publier maintenant ?')) return;

    try {
      await api.put(`/posts/${postId}/reschedule`, { scheduled_at: null });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur lors de l\'annulation.');
    }
  };

  const handleDelete = async (postId: string) => {
    if (!window.confirm('Supprimer ce post programmé ?')) return;

    try {
      await api.delete(`/posts/${postId}`);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur lors de la suppression.');
    }
  };

  if (loading) return <p className="text-sm text-sage">Chargement...</p>;

  if (posts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-ink-line px-4 py-8 text-center">
        <Clock className="w-6 h-6 text-sage-muted mx-auto mb-2" />
        <p className="text-sm text-sage">Aucun post programmé.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-cream mb-2">Posts programmés</h3>
      {posts.map((post) => {
        const scheduled = new Date(post.scheduled_at);
        const now = new Date();
        const issoon = scheduled.getTime() - now.getTime() < 3600000; // < 1 heure

        return (
          <div
            key={post.id}
            className={`flex gap-3 p-3 rounded-lg border ${
              issoon ? 'border-coral/50 bg-coral/10' : 'border-ink-line bg-ink-surface/30'
            }`}
          >
            {post.media_url && (
              <img
                src={post.media_url}
                alt={post.caption || 'Post'}
                className="w-16 h-16 rounded object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1">
              <p className="text-sm text-cream truncate">
                {post.caption || 'Post sans titre'}
              </p>
              <div className="flex items-center gap-1 text-xs text-sage-muted mt-1">
                <Clock className="w-3 h-3" />
                <span>{scheduled.toLocaleString()}</span>
                {isoon && <span className="text-coral ml-2">Bientôt !</span>}
              </div>
            </div>
            <div className="flex gap-1 flex-col">
              <Button
                onClick={() => handleReschedule(post.id)}
                size="sm"
                variant="outline"
                className="text-xs"
              >
                Modifier
              </Button>
              <Button
                onClick={() => handleCancel(post.id)}
                size="sm"
                variant="outline"
                className="text-xs"
              >
                Publier
              </Button>
              <Button
                onClick={() => handleDelete(post.id)}
                size="sm"
                variant="ghost"
                className="text-xs text-coral hover:bg-coral/10"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

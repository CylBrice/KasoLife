'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import type { Post } from '@/types';

interface PostCreatorFormProps {
  onPostCreated?: (post: Post) => void;
  onCancel?: () => void;
}

export function PostCreatorForm({ onPostCreated, onCancel }: PostCreatorFormProps) {
  const { user } = useAuth();
  const [caption, setCaption] = useState('');
  const [mediaType, setMediaType] = useState<'IMAGE' | 'VIDEO' | 'AUDIO'>('IMAGE');
  const [mediaUrl, setMediaUrl] = useState('');
  const [accessLevel, setAccessLevel] = useState<'PUBLIC' | 'SUBSCRIBER'>('PUBLIC');
  const [priceXcon, setPriceXcon] = useState(0);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return <p className="text-sm text-sage">Vous devez être connecté.</p>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let scheduledAt: string | null = null;

      // Si une date et une heure sont spécifiées, les combiner
      if (scheduleDate && scheduleTime) {
        scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
        const now = new Date();
        if (new Date(scheduledAt) <= now) {
          setError('La date programmée doit être dans le futur.');
          setLoading(false);
          return;
        }
      }

      const payload = {
        caption: caption || null,
        media_type: mediaType,
        media_url: mediaUrl,
        access_level: accessLevel,
        price_xcon: accessLevel === 'SUBSCRIBER' ? priceXcon : 0,
        scheduled_at: scheduledAt,
      };

      const response = await api.post('/posts', payload);
      if (onPostCreated) onPostCreated(response.data);

      // Réinitialiser le formulaire
      setCaption('');
      setMediaUrl('');
      setScheduleDate('');
      setScheduleTime('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la création du post.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 border border-ink-line rounded-lg bg-ink-surface/30">
      <h3 className="text-lg font-semibold text-cream">Créer un post</h3>

      {error && <p className="text-sm text-coral">{error}</p>}

      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Votre texte (optionnel)"
        maxLength={2000}
        className="w-full p-2 rounded border border-ink-line bg-ink-raised text-cream placeholder-sage-muted focus:outline-none focus:ring-2 focus:ring-coral"
      />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-sage mb-1">Type de média</label>
          <select
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value as any)}
            className="w-full p-2 rounded border border-ink-line bg-ink-raised text-cream text-sm focus:outline-none"
          >
            <option value="IMAGE">Image</option>
            <option value="VIDEO">Vidéo</option>
            <option value="AUDIO">Audio</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-sage mb-1">Accès</label>
          <select
            value={accessLevel}
            onChange={(e) => setAccessLevel(e.target.value as any)}
            className="w-full p-2 rounded border border-ink-line bg-ink-raised text-cream text-sm focus:outline-none"
          >
            <option value="PUBLIC">Public</option>
            <option value="SUBSCRIBER">Abonnés uniquement</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-sage mb-1">URL du média</label>
        <input
          type="url"
          value={mediaUrl}
          onChange={(e) => setMediaUrl(e.target.value)}
          placeholder="https://..."
          className="w-full p-2 rounded border border-ink-line bg-ink-raised text-cream placeholder-sage-muted text-sm focus:outline-none focus:ring-2 focus:ring-coral"
        />
      </div>

      {accessLevel === 'SUBSCRIBER' && (
        <div>
          <label className="block text-xs text-sage mb-1">Prix (XCon)</label>
          <input
            type="number"
            min="0"
            value={priceXcon}
            onChange={(e) => setPriceXcon(Number(e.target.value))}
            className="w-full p-2 rounded border border-ink-line bg-ink-raised text-cream text-sm focus:outline-none focus:ring-2 focus:ring-coral"
          />
        </div>
      )}

      <div className="bg-ink-raised/50 border border-sage-muted/30 rounded-lg p-3">
        <p className="text-xs text-sage mb-2">Programmer la publication (optionnel)</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-sage-muted mb-1">Date</label>
            <input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="w-full p-2 rounded border border-ink-line bg-ink-raised text-cream text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-sage-muted mb-1">Heure</label>
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="w-full p-2 rounded border border-ink-line bg-ink-raised text-cream text-sm focus:outline-none"
            />
          </div>
        </div>
        {scheduleDate && scheduleTime && (
          <p className="text-xs text-gold mt-2">
            Programmé pour {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString()}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={loading || !mediaUrl}
          className="flex-1 bg-coral hover:bg-coral/90 disabled:opacity-50"
        >
          {loading ? 'Envoi...' : scheduleDate ? 'Programmer' : 'Publier'}
        </Button>
        {onCancel && (
          <Button type="button" onClick={onCancel} variant="ghost">
            Annuler
          </Button>
        )}
      </div>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';

export function BroadcastComposer() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [broadcastType, setBroadcastType] = useState<'FREE' | 'SUBSCRIBERS_ONLY' | 'PPV'>('FREE');
  const [price, setPrice] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!title || !content) {
      alert('Titre et message requis');
      return;
    }

    if (content.length > 1000) {
      alert('Message trop long (max 1000 caractères)');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/messages/broadcast', {
        title,
        content,
        broadcast_type: broadcastType,
        price_xcon: broadcastType === 'PPV' ? price : 0,
      });

      // Auto-send
      await api.post(`/messages/broadcast/${res.data.id}/send`);

      setTitle('');
      setContent('');
      setBroadcastType('FREE');
      setPrice(0);
      alert('Message envoyé !');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 border border-ink-line rounded-lg bg-ink-raised/30">
      <h3 className="text-lg font-semibold text-cream">Message de broadcast</h3>

      <input
        type="text"
        placeholder="Titre du message"
        maxLength={100}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="px-3 py-2 rounded border border-ink-line bg-ink-raised text-cream placeholder-sage-muted text-sm focus:outline-none"
      />

      <textarea
        placeholder="Votre message (max 1000 caractères)"
        maxLength={1000}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="px-3 py-2 rounded border border-ink-line bg-ink-raised text-cream placeholder-sage-muted text-sm h-24 focus:outline-none resize-none"
      />

      <div className="grid grid-cols-3 gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="type"
            value="FREE"
            checked={broadcastType === 'FREE'}
            onChange={(e) => setBroadcastType(e.target.value as any)}
            className="w-4 h-4"
          />
          <span className="text-sm text-cream">Gratuit</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="type"
            value="SUBSCRIBERS_ONLY"
            checked={broadcastType === 'SUBSCRIBERS_ONLY'}
            onChange={(e) => setBroadcastType(e.target.value as any)}
            className="w-4 h-4"
          />
          <span className="text-sm text-cream">Abonnés</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="type"
            value="PPV"
            checked={broadcastType === 'PPV'}
            onChange={(e) => setBroadcastType(e.target.value as any)}
            className="w-4 h-4"
          />
          <span className="text-sm text-cream">Payant</span>
        </label>
      </div>

      {broadcastType === 'PPV' && (
        <input
          type="number"
          min="0"
          placeholder="Prix (FCFA)"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="px-3 py-2 rounded border border-ink-line bg-ink-raised text-cream text-sm focus:outline-none"
        />
      )}

      <Button onClick={handleSend} disabled={loading || !title || !content} className="gap-2 bg-coral hover:bg-coral/90 disabled:opacity-50">
        <Send className="w-4 h-4" />
        {loading ? 'Envoi...' : 'Envoyer le message'}
      </Button>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Trash2, Plus } from 'lucide-react';

interface PromoCode {
  id: string;
  code: string;
  discount_percent?: number;
  discount_amount?: number;
  max_uses?: number;
  uses_count: number;
  is_active: boolean;
  applies_to: string;
  expires_at?: string;
}

export function PromoCodeManager() {
  const { user } = useAuth();
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    discount_percent: 10,
    max_uses: null as number | null,
    applies_to: 'SUBSCRIBERS',
  });

  useEffect(() => {
    if (!user) return;
    fetchCodes();
  }, [user]);

  const fetchCodes = async () => {
    try {
      const res = await api.get('/promo-codes');
      setCodes(res.data || []);
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await api.post('/promo-codes', formData);
      setFormData({ code: '', discount_percent: 10, max_uses: null, applies_to: 'SUBSCRIBERS' });
      setShowForm(false);
      fetchCodes();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce code ?')) return;
    try {
      await api.delete(`/promo-codes/${id}`);
      fetchCodes();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur');
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await api.put(`/promo-codes/${id}`, { is_active: !isActive });
      fetchCodes();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur');
    }
  };

  if (loading) return <p className="text-sm text-sage">Chargement...</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-cream">Codes Promo</h3>
        <Button onClick={() => setShowForm(!showForm)} size="sm" className="gap-1">
          <Plus className="w-4 h-4" />
          Nouveau code
        </Button>
      </div>

      {showForm && (
        <div className="border border-ink-line rounded-lg p-4 bg-ink-raised/50 gap-3 flex flex-col">
          <input
            type="text"
            placeholder="CODE"
            maxLength={20}
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            className="px-3 py-2 rounded border border-ink-line bg-ink-raised text-cream text-sm focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-sage mb-1">Réduction %</label>
              <input
                type="number"
                min="1"
                max="100"
                value={formData.discount_percent}
                onChange={(e) => setFormData({ ...formData, discount_percent: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded border border-ink-line bg-ink-raised text-cream text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-sage mb-1">Max utilisations</label>
              <input
                type="number"
                min="1"
                value={formData.max_uses || ''}
                onChange={(e) => setFormData({ ...formData, max_uses: e.target.value ? Number(e.target.value) : null })}
                placeholder="Illimité"
                className="w-full px-3 py-2 rounded border border-ink-line bg-ink-raised text-cream text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} className="flex-1 bg-coral hover:bg-coral/90" size="sm">
              Créer
            </Button>
            <Button onClick={() => setShowForm(false)} variant="ghost" size="sm">
              Annuler
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {codes.length === 0 ? (
          <p className="text-sm text-sage-muted">Aucun code promo</p>
        ) : (
          codes.map((code) => (
            <div key={code.id} className="border border-ink-line rounded-lg p-3 flex justify-between items-center bg-ink-surface/30">
              <div className="flex-1">
                <p className="text-sm font-mono text-cream">{code.code}</p>
                <p className="text-xs text-sage-muted">
                  {code.discount_percent ? `${code.discount_percent}% off` : `${(code.discount_amount || 0) / 100}$ off`} •{' '}
                  {code.uses_count}/{code.max_uses || '∞'} utilisations
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleToggle(code.id, code.is_active)}
                  size="sm"
                  variant={code.is_active ? 'primary' : 'outline'}
                  className="text-xs"
                >
                  {code.is_active ? 'Actif' : 'Inactif'}
                </Button>
                <Button onClick={() => handleDelete(code.id)} size="sm" variant="ghost" className="text-coral hover:bg-coral/10">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

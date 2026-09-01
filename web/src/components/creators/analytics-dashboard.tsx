'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

interface Analytics {
  period: string;
  summary: {
    posts_created: number;
    total_likes: number;
    total_comments: number;
    active_subscribers: number;
  };
  revenue: {
    tips: number;
    ppv: number;
    total: number;
  };
  top_posts: Array<{ id: string; engagement: number }>;
}

export function AnalyticsDashboard() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    if (!user) return;
    fetchAnalytics();
  }, [user, period]);

  const fetchAnalytics = async () => {
    try {
      const res = await api.get(`/creators/me/analytics?period=${period}`);
      setAnalytics(res.data);
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p className="text-sm text-sage">Chargement...</p>;
  if (!analytics) return <p className="text-sm text-sage">Données non disponibles</p>;

  const revenueData = [
    { name: 'Tips', value: analytics.revenue.tips },
    { name: 'PPV', value: analytics.revenue.ppv },
  ];

  const summaryData = [
    { label: 'Posts créés', value: analytics.summary.posts_created },
    { label: 'Likes totaux', value: analytics.summary.total_likes },
    { label: 'Commentaires', value: analytics.summary.total_comments },
    { label: 'Abonnés actifs', value: analytics.summary.active_subscribers },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 border border-ink-line rounded-lg bg-ink-raised/20">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-cream">Analytiques</h3>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-2 rounded border border-ink-line bg-ink-raised text-cream text-sm focus:outline-none"
        >
          <option value="7d">7 jours</option>
          <option value="30d">30 jours</option>
          <option value="90d">90 jours</option>
        </select>
      </div>

      {/* Métriques principales */}
      <div className="grid grid-cols-2 gap-3">
        {summaryData.map((metric) => (
          <div key={metric.label} className="bg-ink-surface/50 rounded-lg p-3 border border-ink-line/30">
            <p className="text-xs text-sage-muted">{metric.label}</p>
            <p className="text-2xl font-bold text-coral">{metric.value}</p>
          </div>
        ))}
      </div>

      {/* Revenu */}
      <div className="bg-ink-surface/50 rounded-lg p-4 border border-ink-line/30">
        <p className="text-sm font-semibold text-cream mb-3">Revenu ({analytics.period})</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center">
            <p className="text-xs text-sage">Tips</p>
            <p className="text-xl font-bold text-gold">{(analytics.revenue.tips / 100).toFixed(0)} FCFA</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-sage">PPV</p>
            <p className="text-xl font-bold text-coral">{(analytics.revenue.ppv / 100).toFixed(0)} FCFA</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-sage">Total</p>
            <p className="text-xl font-bold text-cream">{(analytics.revenue.total / 100).toFixed(0)} FCFA</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="name" stroke="#999" />
            <YAxis stroke="#999" />
            <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333' }} />
            <Bar dataKey="value" fill="#ff6b6b" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top posts */}
      {analytics.top_posts.length > 0 && (
        <div className="bg-ink-surface/50 rounded-lg p-4 border border-ink-line/30">
          <p className="text-sm font-semibold text-cream mb-2">Top posts</p>
          <div className="flex flex-col gap-2">
            {analytics.top_posts.slice(0, 5).map((post, i) => (
              <div key={post.id} className="flex justify-between items-center text-xs">
                <span className="text-sage">#</span>
                <span className="text-cream font-mono">{post.id.slice(0, 8)}...</span>
                <span className="text-gold">{post.engagement} engagements</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

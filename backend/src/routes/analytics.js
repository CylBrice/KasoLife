// ============================================================
// KASOLIFE — Routes /creators/me/analytics v1.0
// Creator analytics dashboard
// ============================================================
'use strict';
const express = require('express');
const supabase = require('../config/supabase');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /analytics — statistiques du créateur
router.get('/', authMiddleware, requireRole('CREATOR'), async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const days = parseInt(period.replace('d', '')) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Total stats
    const { data: posts } = await supabase.from('posts')
      .select('id, likes_count, comments_count, price_xcon, access_level')
      .eq('creator_id', req.user.id)
      .eq('is_published', true)
      .gte('created_at', startDate.toISOString());

    const { data: subscriptions } = await supabase.from('subscriptions')
      .select('id, status')
      .eq('creator_id', req.user.id)
      .gte('created_at', startDate.toISOString());

    const { data: tips } = await supabase.from('tips')
      .select('amount_xcon')
      .eq('receiver_id', req.user.id)
      .gte('created_at', startDate.toISOString());

    const { data: ppv } = await supabase.from('post_purchases')
      .select('price_xcon, commission_xcon')
      .gte('created_at', startDate.toISOString());

    // Calculate metrics
    const postsCount = posts?.length || 0;
    const likesTotal = posts?.reduce((sum, p) => sum + (p.likes_count || 0), 0) || 0;
    const commentsTotal = posts?.reduce((sum, p) => sum + (p.comments_count || 0), 0) || 0;
    const subscriptionsActive = subscriptions?.filter(s => s.status === 'ACTIVE').length || 0;
    const tipsRevenue = tips?.reduce((sum, t) => sum + (t.amount_xcon || 0), 0) || 0;
    const ppvRevenue = ppv?.reduce((sum, p) => sum + (p.price_xcon || 0) - (p.commission_xcon || 0), 0) || 0;

    // Top posts
    const topPosts = (posts || [])
      .sort((a, b) => (b.likes_count + b.comments_count) - (a.likes_count + b.comments_count))
      .slice(0, 5)
      .map(p => ({ id: p.id, engagement: p.likes_count + p.comments_count }));

    res.json({
      period: `${days} jours`,
      summary: {
        posts_created: postsCount,
        total_likes: likesTotal,
        total_comments: commentsTotal,
        active_subscribers: subscriptionsActive,
      },
      revenue: {
        tips: tipsRevenue,
        ppv: ppvRevenue,
        total: tipsRevenue + ppvRevenue,
      },
      top_posts: topPosts,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /analytics/retention — taux de retention
router.get('/retention', authMiddleware, requireRole('CREATOR'), async (req, res) => {
  try {
    const { data: result, error } = await supabase.rpc('get_creator_retention', {
      p_creator_id: req.user.id,
    });

    if (error) throw error;
    res.json(result?.[0] || {});
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

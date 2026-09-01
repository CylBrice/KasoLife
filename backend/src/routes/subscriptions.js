// ============================================================
// KASOLIFE — Routes /subscriptions v1.0
// Abonnement créateur (récurrent, 30 jours), annulation, renouvellement
// Commission plateforme : 20% prélevés sur chaque paiement
// ============================================================
'use strict';
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authMiddleware, requireNotWalletFrozen } = require('../middleware/auth');
const { SUBSCRIPTION_COMMISSION_RATE } = require('../config/constants');

const router = express.Router();
const SUBSCRIPTION_PERIOD_DAYS = 30;

// ── GET /subscriptions/me — abonnements actifs de l'utilisateur (fan)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabase.from('subscriptions')
      .select(`
        id, price_xcon, status, started_at, current_period_end, auto_renew, cancelled_at,
        creator:users!subscriptions_creator_id_fkey(
          id, pseudo, avatar_url,
          creator_profile:creator_profiles(display_name, category:categories(name, slug))
        )
      `)
      .eq('fan_id', req.user.id)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── GET /subscriptions/subscribers — abonnés du créateur connecté
router.get('/subscribers', authMiddleware, async (req, res) => {
  try {
    if (!['CREATOR', 'ADMIN', 'SUPERADMIN'].includes(req.user.role))
      return res.status(403).json({ error: 'Accès réservé aux créateurs' });

    const { page = 1, limit = 30 } = req.query;
    const pageNum  = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 30));
    const offset   = (pageNum - 1) * pageSize;

    const { data, error, count } = await supabase.from('subscriptions')
      .select(`
        id, price_xcon, status, started_at, current_period_end, auto_renew,
        fan:users!subscriptions_fan_id_fkey(id, pseudo, avatar_url)
      `, { count: 'exact' })
      .eq('creator_id', req.user.id)
      .eq('status', 'ACTIVE')
      .order('started_at', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;

    res.json({
      subscribers: data || [],
      pagination: { page: pageNum, limit: pageSize, total: count || 0, pages: Math.ceil((count || 0) / pageSize) },
    });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /subscriptions/:creatorId — s'abonner à un créateur
router.post('/:creatorId', authMiddleware, requireNotWalletFrozen, async (req, res) => {
  try {
    const { creatorId } = req.params;

    if (creatorId === req.user.id)
      return res.status(400).json({ error: 'Vous ne pouvez pas vous abonner à vous-même' });

    const { data: creator } = await supabase.from('users')
      .select('id, role').eq('id', creatorId).single();
    if (!creator || creator.role !== 'CREATOR')
      return res.status(404).json({ error: 'Créateur introuvable' });

    const { data: profile } = await supabase.from('creator_profiles')
      .select('subscription_price_xcon, is_accepting_subs').eq('user_id', creatorId).single();
    if (!profile) return res.status(404).json({ error: 'Profil créateur introuvable' });
    if (!profile.is_accepting_subs) return res.status(403).json({ error: "Ce créateur n'accepte plus de nouveaux abonnés" });

    const { data: existing } = await supabase.from('subscriptions')
      .select('id, status, current_period_end').eq('fan_id', req.user.id).eq('creator_id', creatorId).single();

    if (existing && existing.status === 'ACTIVE')
      return res.status(409).json({ error: 'Vous êtes déjà abonné à ce créateur' });

    const price = profile.subscription_price_xcon;
    const commission = Math.round(price * SUBSCRIPTION_COMMISSION_RATE);
    const creatorShare = price - commission;

    const { data: newBalance, error: debitErr } = await supabase.rpc('debit_wallet', {
      p_user_id: req.user.id, p_amount: price,
    });
    if (debitErr) {
      if (debitErr.message?.includes('Solde insuffisant'))
        return res.status(402).json({ error: 'Solde insuffisant — veuillez recharger votre wallet' });
      throw debitErr;
    }

    const periodEnd = new Date(Date.now() + SUBSCRIPTION_PERIOD_DAYS * 24 * 3600000).toISOString();
    let subscription;

    if (existing) {
      const { data, error } = await supabase.from('subscriptions').update({
        status: 'ACTIVE', price_xcon: price, started_at: new Date().toISOString(),
        current_period_end: periodEnd, cancelled_at: null, auto_renew: true,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id).select().single();
      if (error) throw error;
      subscription = data;
    } else {
      const { data, error } = await supabase.from('subscriptions').insert({
        id: uuidv4(), fan_id: req.user.id, creator_id: creatorId, price_xcon: price,
        status: 'ACTIVE', current_period_end: periodEnd,
      }).select().single();
      if (error) throw error;
      subscription = data;
    }

    await supabase.rpc('credit_pending_balance', { p_user_id: creatorId, p_amount: creatorShare });
    await supabase.rpc('increment_subscribers_count', { p_creator_id: creatorId, p_delta: 1 });

    await supabase.from('transactions').insert([
      {
        id: uuidv4(), user_id: req.user.id, type: 'SUBSCRIPTION_PAYMENT', amount_xcon: -price,
        balance_after: newBalance, description: 'Abonnement créateur', related_user_id: creatorId,
      },
      {
        id: uuidv4(), user_id: creatorId, type: 'SUBSCRIPTION_INCOME', amount_xcon: creatorShare,
        balance_after: 0, description: `Nouvel abonné (commission ${(SUBSCRIPTION_COMMISSION_RATE * 100).toFixed(0)}%)`,
        related_user_id: req.user.id,
      },
    ]);

    await supabase.from('platform_revenue').insert({
      id: uuidv4(), source_type: 'COMMISSION_ABONNEMENT', amount_xcon: commission,
      reference_id: subscription.id, user_id: creatorId,
    });

    res.status(201).json({ message: 'Abonnement activé', subscription, balance_xcon: newBalance });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur', details: err.message }); }
});

// ── PUT /subscriptions/:id/cancel — annuler le renouvellement automatique
router.put('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: sub } = await supabase.from('subscriptions')
      .select('id, fan_id, status').eq('id', id).single();
    if (!sub) return res.status(404).json({ error: 'Abonnement introuvable' });
    if (sub.fan_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé' });
    if (sub.status !== 'ACTIVE') return res.status(400).json({ error: "Cet abonnement n'est pas actif" });

    const { data, error } = await supabase.from('subscriptions').update({
      auto_renew: false, cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', id).select().single();
    if (error) throw error;

    res.json({
      message: `Renouvellement automatique désactivé — votre accès reste actif jusqu'au ${new Date(data.current_period_end).toLocaleDateString('fr-FR')}`,
      subscription: data,
    });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── PUT /subscriptions/:id/resume — réactiver le renouvellement automatique
router.put('/:id/resume', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: sub } = await supabase.from('subscriptions')
      .select('id, fan_id, status, current_period_end').eq('id', id).single();
    if (!sub) return res.status(404).json({ error: 'Abonnement introuvable' });
    if (sub.fan_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé' });
    if (sub.status !== 'ACTIVE') return res.status(400).json({ error: "Cet abonnement n'est plus actif — réabonnez-vous" });
    if (new Date(sub.current_period_end) < new Date())
      return res.status(400).json({ error: 'Période expirée — réabonnez-vous' });

    const { data, error } = await supabase.from('subscriptions').update({
      auto_renew: true, cancelled_at: null, updated_at: new Date().toISOString(),
    }).eq('id', id).select().single();
    if (error) throw error;

    res.json({ message: 'Renouvellement automatique réactivé', subscription: data });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

module.exports = router;

// ============================================================
// KASOLIFE — Routes /admin v1.0
// Dashboard, gestion utilisateurs, validation candidatures créateurs,
// modération de contenu, gestion des retraits (payouts), maintenance
// Toutes les routes nécessitent role ADMIN ou SUPERADMIN
// ============================================================
'use strict';
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { sendPushNotification } = require('../services/notifications');
const { invalidateAIConfigCache } = require('../services/aiModeration');

const router = express.Router();
router.use(authMiddleware, requireRole('ADMIN', 'SUPERADMIN'));

// ── Helper : date de début selon période
const periodStart = (period) => {
  const now = new Date();
  switch (period) {
    case 'day':   return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    case 'week':  return new Date(now.getTime() - 7   * 24 * 3600 * 1000).toISOString();
    case 'month': return new Date(now.getTime() - 30  * 24 * 3600 * 1000).toISOString();
    case 'year':  return new Date(now.getTime() - 365 * 24 * 3600 * 1000).toISOString();
    default:      return new Date(0).toISOString();
  }
};


// ════════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════════════════════

router.get('/stats', async (req, res) => {
  try {
    const [users, creators, posts, revenue, wallets, activeSubs] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'CREATOR'),
      supabase.from('posts').select('id', { count: 'exact', head: true }),
      supabase.from('platform_revenue').select('amount_xcon'),
      supabase.from('wallets').select('balance_xcon, pending_balance_xcon'),
      supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
    ]);

    const totalRevenue = (revenue.data || []).reduce((s, r) => s + r.amount_xcon, 0);
    const totalBalances = (wallets.data || []).reduce((s, w) => s + (w.balance_xcon || 0), 0);
    const totalPending  = (wallets.data || []).reduce((s, w) => s + (w.pending_balance_xcon || 0), 0);

    res.json({
      total_users: users.count || 0,
      total_creators: creators.count || 0,
      total_posts: posts.count || 0,
      active_subscriptions: activeSubs.count || 0,
      total_revenue_xcon: totalRevenue,
      total_user_balances_xcon: totalBalances,
      total_pending_creator_earnings_xcon: totalPending,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/revenue', async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const since = periodStart(period);
    const { data, error } = await supabase.from('platform_revenue')
      .select('source_type, amount_xcon, created_at').gte('created_at', since);
    if (error) throw error;

    const breakdown = {};
    let total = 0;
    for (const row of data || []) {
      breakdown[row.source_type] = (breakdown[row.source_type] || 0) + row.amount_xcon;
      total += row.amount_xcon;
    }

    // Courbe par jour (30 derniers jours pour le graphe)
    const dailyMap = {};
    for (const row of data || []) {
      const day = row.created_at.slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { total: 0 };
      dailyMap[day].total += row.amount_xcon;
      dailyMap[day][row.source_type] = (dailyMap[day][row.source_type] || 0) + row.amount_xcon;
    }
    const dailyCurve = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));

    // Top 5 sources par montant
    const topSources = Object.entries(breakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([source, amount]) => ({
        source, amount_xcon: amount,
        pct: total > 0 ? Math.round((amount / total) * 100) : 0,
      }));

    res.json({ period, total_xcon: total, breakdown, dailyCurve, topSources });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /admin/actions — journal des actions admin (paginé, filtrable)
router.get('/actions', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const safeLmt = Math.min(Number(limit) || 50, 100);
    const { data, error } = await supabase.from('admin_actions')
      .select('*, admin:users(pseudo)')
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + safeLmt - 1);
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ════════════════════════════════════════════════════════════════════════════════
// CONFIG PLATEFORME — SUPERADMIN uniquement
// ════════════════════════════════════════════════════════════════════════════════

// ── GET /admin/config — toutes les clés platform_config
router.get('/config', requireRole('SUPERADMIN'), async (req, res) => {
  try {
    const { data, error } = await supabase.from('platform_config')
      .select('key, value, description, updated_at, updated_by')
      .order('key');
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /admin/config/:key — modifier une clé platform_config
router.put('/config/:key', requireRole('SUPERADMIN'), async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    if (value === undefined || value === null)
      return res.status(400).json({ error: 'Valeur requise' });

    // Vérifier que la clé existe
    const { data: existing } = await supabase.from('platform_config')
      .select('key, value').eq('key', key).single();
    if (!existing)
      return res.status(404).json({ error: `Clé de configuration "${key}" introuvable` });

    await supabase.from('platform_config').update({
      value: String(value),
      updated_at: new Date().toISOString(),
      updated_by: req.user.id,
    }).eq('key', key);

    invalidateAIConfigCache();

    await supabase.from('admin_actions').insert({
      admin_id: req.user.id, action: 'UPDATE_CONFIG',
      target_type: 'platform',
      metadata: { key, old_value: existing.value, new_value: String(value) },
    });

    res.json({ message: `Configuration "${key}" mise à jour → ${value}`, key, value });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ════════════════════════════════════════════════════════════════════════════════
// GESTION DES ADMINS — SUPERADMIN uniquement
// ════════════════════════════════════════════════════════════════════════════════

// ── GET /admin/admins — liste de tous les admins et superadmins
router.get('/admins', requireRole('SUPERADMIN'), async (req, res) => {
  try {
    const { data, error } = await supabase.from('users')
      .select('id, pseudo, name, role, is_active, kyc_status, created_at, last_active')
      .in('role', ['ADMIN', 'SUPERADMIN'])
      .order('role').order('created_at');
    if (error) throw error;

    // Nombre d'actions admin par utilisateur (derniers 30j)
    const since = new Date(Date.now() - 30 * 24 * 3600000).toISOString();
    const { data: actionCounts } = await supabase.from('admin_actions')
      .select('admin_id')
      .gte('created_at', since);
    const countMap = {};
    for (const a of actionCounts || []) {
      countMap[a.admin_id] = (countMap[a.admin_id] || 0) + 1;
    }

    const enriched = (data || []).map((u) => ({
      ...u,
      actions_30d: countMap[u.id] || 0,
    }));

    res.json(enriched);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /admin/admins/:id/role — changer le rôle d'un utilisateur (USER→ADMIN ou ADMIN→USER)
// SUPERADMIN ne peut pas être rétrogradé par cette route (protection)
router.put('/admins/:id/role', requireRole('SUPERADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['USER', 'ADMIN'].includes(role))
      return res.status(400).json({ error: 'Rôle invalide — valeurs acceptées : USER, ADMIN' });

    const { data: target } = await supabase.from('users')
      .select('id, pseudo, role').eq('id', id).single();
    if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (target.role === 'SUPERADMIN')
      return res.status(403).json({ error: 'Impossible de modifier le rôle d\'un SUPERADMIN' });
    if (target.id === req.user.id)
      return res.status(403).json({ error: 'Impossible de modifier votre propre rôle' });

    await supabase.from('users').update({ role }).eq('id', id);

    await supabase.from('admin_actions').insert({
      admin_id: req.user.id, action: 'CHANGE_ROLE',
      target_type: 'user', target_id: id,
      metadata: { pseudo: target.pseudo, old_role: target.role, new_role: role },
    });

    const action = role === 'ADMIN' ? 'promu Admin' : 'rétrogradé Utilisateur';
    res.json({ message: `@${target.pseudo} ${action}`, id, role });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /admin/admins/:id/suspend — suspendre un admin (SUPERADMIN only)
router.post('/admins/:id/suspend', requireRole('SUPERADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ error: 'Motif requis' });

    const { data: target } = await supabase.from('users')
      .select('id, pseudo, role').eq('id', id).single();
    if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (target.role === 'SUPERADMIN')
      return res.status(403).json({ error: 'Impossible de suspendre un SUPERADMIN' });
    if (target.id === req.user.id)
      return res.status(403).json({ error: 'Impossible de se suspendre soi-même' });

    await supabase.from('users').update({ is_active: false }).eq('id', id);

    await supabase.from('admin_actions').insert({
      admin_id: req.user.id, action: 'SUSPEND_ADMIN',
      target_type: 'user', target_id: id,
      metadata: { pseudo: target.pseudo, reason: reason.trim() },
    });

    res.json({ message: `Compte admin @${target.pseudo} suspendu` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /admin/admins/:id/reactivate — réactiver un admin (SUPERADMIN only)
router.post('/admins/:id/reactivate', requireRole('SUPERADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { data: target } = await supabase.from('users')
      .select('id, pseudo, role').eq('id', id).single();
    if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });

    await supabase.from('users').update({ is_active: true }).eq('id', id);

    await supabase.from('admin_actions').insert({
      admin_id: req.user.id, action: 'REACTIVATE_ADMIN',
      target_type: 'user', target_id: id,
      metadata: { pseudo: target.pseudo },
    });

    res.json({ message: `Compte admin @${target.pseudo} réactivé` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ════════════════════════════════════════════════════════════════════════════════
// JOURNAL D'AUDIT — SUPERADMIN uniquement
// ════════════════════════════════════════════════════════════════════════════════

// ── GET /admin/audit — journal paginé des actions admin avec filtres
router.get('/audit', requireRole('SUPERADMIN'), async (req, res) => {
  try {
    const { action, admin_id, target_type, page = 1, limit = 50 } = req.query;
    const safeLmt = Math.min(Number(limit) || 50, 100);
    const offset = (Number(page) - 1) * safeLmt;

    let q = supabase.from('admin_actions')
      .select('*, admin:users!admin_actions_admin_id_fkey(pseudo, role)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + safeLmt - 1);

    if (action)      q = q.eq('action', action);
    if (admin_id)    q = q.eq('admin_id', admin_id);
    if (target_type) q = q.eq('target_type', target_type);

    const { data, count, error } = await q;
    if (error) throw error;

    // Liste des actions distinctes (pour le filtre dans le frontend)
    const { data: actionTypes } = await supabase.from('admin_actions')
      .select('action').order('action');
    const uniqueActions = [...new Set((actionTypes || []).map((a) => a.action))];

    res.json({
      actions: data || [],
      total: count || 0,
      page: Number(page),
      limit: safeLmt,
      pages: Math.ceil((count || 0) / safeLmt),
      available_filters: { actions: uniqueActions },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});




// ════════════════════════════════════════════════════════════════════════════════
// GESTION UTILISATEURS
// ════════════════════════════════════════════════════════════════════════════════

router.get('/users', async (req, res) => {
  try {
    const { search, role, limit = 30, offset = 0 } = req.query;
    const safeLmt = Math.min(Number(limit) || 30, 100);
    let q = supabase.from('users')
      .select('id, pseudo, name, role, is_active, country_iso, kyc_status, created_at, last_active', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + safeLmt - 1);
    if (search) q = q.ilike('pseudo', `%${search}%`);
    if (role)   q = q.eq('role', role);
    const { data, count, error } = await q;
    if (error) throw error;
    res.json({ users: data || [], total: count || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const canModerate = (actorRole, targetRole) => {
  if (targetRole === 'SUPERADMIN') return false;
  if (actorRole === 'SUPERADMIN') return ['USER', 'CREATOR', 'ADMIN'].includes(targetRole);
  if (actorRole === 'ADMIN')      return ['USER', 'CREATOR'].includes(targetRole);
  return false;
};

router.post('/users/:id/suspend', async (req, res) => {
  try {
    const { reason } = req.body;
    const { data: target } = await supabase.from('users')
      .select('id, role, pseudo').eq('id', req.params.id).single();
    if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (!canModerate(req.user.role, target.role))
      return res.status(403).json({ error: `Un ${req.user.role} ne peut pas suspendre un ${target.role}` });

    await supabase.from('users').update({
      is_active: false, suspension_reason: reason || null,
      suspended_by: req.user.id, suspended_at: new Date().toISOString(),
    }).eq('id', req.params.id);

    await supabase.from('refresh_tokens').update({ revoked: true }).eq('user_id', req.params.id);

    await supabase.from('admin_actions').insert({
      admin_id: req.user.id, action: 'SUSPEND_USER',
      target_type: 'user', target_id: req.params.id, reason,
      metadata: { target_role: target.role, target_pseudo: target.pseudo },
    });
    res.json({ message: 'Compte suspendu' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:id/reactivate', async (req, res) => {
  try {
    const { data: target } = await supabase.from('users')
      .select('id, role, pseudo').eq('id', req.params.id).single();
    if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (!canModerate(req.user.role, target.role))
      return res.status(403).json({ error: `Un ${req.user.role} ne peut pas réactiver un ${target.role}` });

    await supabase.from('users').update({
      is_active: true, suspension_reason: null, suspended_by: null, suspended_at: null,
    }).eq('id', req.params.id);

    await supabase.from('admin_actions').insert({
      admin_id: req.user.id, action: 'REACTIVATE_USER',
      target_type: 'user', target_id: req.params.id,
      metadata: { target_role: target.role },
    });
    res.json({ message: 'Compte réactivé' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users/:id/promote', requireRole('SUPERADMIN'), async (req, res) => {
  try {
    const { role } = req.body;
    if (!['USER', 'CREATOR', 'ADMIN'].includes(role))
      return res.status(400).json({ error: 'Rôle invalide' });

    const { data: target } = await supabase.from('users').select('id, role').eq('id', req.params.id).single();
    if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (target.role === 'SUPERADMIN') return res.status(403).json({ error: 'Impossible de modifier un SUPERADMIN' });

    await supabase.from('users').update({ role }).eq('id', req.params.id);

    await supabase.from('admin_actions').insert({
      admin_id: req.user.id, action: 'CHANGE_ROLE',
      target_type: 'user', target_id: req.params.id, metadata: { new_role: role, previous_role: target.role },
    });
    res.json({ message: `Rôle mis à jour : ${role}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ════════════════════════════════════════════════════════════════════════════════
// CANDIDATURES CRÉATEUR
// ════════════════════════════════════════════════════════════════════════════════

router.get('/creator-applications', async (req, res) => {
  try {
    const { status = 'PENDING' } = req.query;
    const { data, error } = await supabase.from('creator_applications')
      .select('*, user:users(pseudo, kyc_status, created_at), category:categories(name, slug)')
      .eq('status', status)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/creator-applications/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: application } = await supabase.from('creator_applications')
      .select('*').eq('id', id).single();
    if (!application) return res.status(404).json({ error: 'Candidature introuvable' });
    if (application.status !== 'PENDING') return res.status(400).json({ error: 'Candidature déjà traitée' });

    const { data: user } = await supabase.from('users').select('id, kyc_status, role').eq('id', application.user_id).single();
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (user.kyc_status !== 'VERIFIED')
      return res.status(400).json({ error: "L'utilisateur doit avoir un KYC vérifié pour devenir créateur" });
    if (user.role === 'CREATOR') return res.status(400).json({ error: 'Cet utilisateur est déjà créateur' });

    let subscriptionPrice = 1000;
    try {
      const parsed = JSON.parse(application.motivation);
      if (parsed?.subscription_price_xcon) subscriptionPrice = parsed.subscription_price_xcon;
    } catch {}

    const { error: profileErr } = await supabase.from('creator_profiles').insert({
      id: uuidv4(), user_id: application.user_id, category_id: application.category_id,
      display_name: application.display_name, subscription_price_xcon: subscriptionPrice,
    });
    if (profileErr) throw profileErr;

    await supabase.from('users').update({ role: 'CREATOR' }).eq('id', application.user_id);

    await supabase.from('creator_applications').update({
      status: 'APPROVED', reviewed_by: req.user.id, reviewed_at: new Date().toISOString(),
    }).eq('id', id);

    await supabase.from('admin_actions').insert({
      admin_id: req.user.id, action: 'APPROVE_CREATOR_APPLICATION',
      target_type: 'user', target_id: application.user_id,
    });

    await supabase.from('notifications').insert({
      id: uuidv4(), user_id: application.user_id, title: '🎉 Candidature approuvée',
      message: 'Félicitations ! Votre profil créateur KasoLife est actif.', type: 'CREATOR_APPROVED',
    });
    sendPushNotification(application.user_id, '🎉 Vous êtes créateur sur KasoLife !',
      'Votre candidature a été approuvée — commencez à publier dès maintenant.',
      { type: 'CREATOR_APPROVED' }).catch(() => {});

    res.json({ message: 'Candidature approuvée — profil créateur créé' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/creator-applications/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason || reason.length < 5) return res.status(400).json({ error: 'Motif de rejet requis (min 5 caractères)' });

    const { data: application } = await supabase.from('creator_applications')
      .select('id, user_id, status').eq('id', id).single();
    if (!application) return res.status(404).json({ error: 'Candidature introuvable' });
    if (application.status !== 'PENDING') return res.status(400).json({ error: 'Candidature déjà traitée' });

    await supabase.from('creator_applications').update({
      status: 'REJECTED', reviewed_by: req.user.id, reviewed_at: new Date().toISOString(),
      rejection_reason: reason,
    }).eq('id', id);

    await supabase.from('admin_actions').insert({
      admin_id: req.user.id, action: 'REJECT_CREATOR_APPLICATION',
      target_type: 'user', target_id: application.user_id, reason,
    });

    await supabase.from('notifications').insert({
      id: uuidv4(), user_id: application.user_id, title: 'Candidature non retenue',
      message: `Votre candidature créateur n'a pas été retenue : ${reason}`, type: 'CREATOR_REJECTED',
    });

    res.json({ message: 'Candidature rejetée' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ════════════════════════════════════════════════════════════════════════════════
// MODÉRATION DE CONTENU
// ════════════════════════════════════════════════════════════════════════════════

router.get('/reports', async (req, res) => {
  try {
    const { status = 'PENDING', target_type } = req.query;
    let q = supabase.from('content_reports')
      .select('*, reporter:users!content_reports_reporter_id_fkey(pseudo)')
      .eq('status', status);
    if (target_type) q = q.eq('target_type', target_type);
    const { data, error } = await q.order('created_at', { ascending: true });
    if (error) throw error;

    // Tri par sévérité IA décroissante (CRITICAL > HIGH > MEDIUM > LOW > non trié),
    // puis par ancienneté à sévérité égale.
    const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const sorted = [...(data || [])].sort((a, b) => {
      const sa = SEVERITY_ORDER[a.ai_severity] ?? 4;
      const sb = SEVERITY_ORDER[b.ai_severity] ?? 4;
      return sa - sb;
    });

    res.json(sorted);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/reports/:id/dismiss', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('content_reports').update({
      status: 'DISMISSED', reviewed_by: req.user.id, reviewed_at: new Date().toISOString(),
    }).eq('id', id).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Signalement introuvable' });
    res.json({ message: 'Signalement classé sans suite' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/reports/:id/action', async (req, res) => {
  try {
    const { id } = req.params;
    const { action_type, suspend_author, reason } = req.body; // action_type: 'DELETE' | 'FLAG'

    const { data: report } = await supabase.from('content_reports').select('*').eq('id', id).single();
    if (!report) return res.status(404).json({ error: 'Signalement introuvable' });

    let authorId = null;

    if (report.target_type === 'POST') {
      const { data: post } = await supabase.from('posts').select('creator_id').eq('id', report.target_id).single();
      authorId = post?.creator_id;
      if (action_type === 'DELETE') {
        await supabase.from('posts').delete().eq('id', report.target_id);
        if (authorId) await supabase.rpc('increment_posts_count', { p_creator_id: authorId, p_delta: -1 });
      } else {
        await supabase.from('posts').update({ is_flagged: true, is_published: false }).eq('id', report.target_id);
      }
    } else if (report.target_type === 'COMMENT') {
      const { data: comment } = await supabase.from('post_comments').select('user_id, post_id').eq('id', report.target_id).single();
      authorId = comment?.user_id;
      if (action_type === 'DELETE') {
        await supabase.from('post_comments').delete().eq('id', report.target_id);
        if (comment?.post_id) await supabase.rpc('increment_post_comments', { p_post_id: comment.post_id, p_delta: -1 });
      } else {
        await supabase.from('post_comments').update({ is_flagged: true }).eq('id', report.target_id);
      }
    } else if (report.target_type === 'MESSAGE') {
      const { data: message } = await supabase.from('messages').select('sender_id').eq('id', report.target_id).single();
      authorId = message?.sender_id;
      if (action_type === 'DELETE') {
        await supabase.from('messages').delete().eq('id', report.target_id);
      } else {
        await supabase.from('messages').update({ is_flagged: true }).eq('id', report.target_id);
      }
    } else if (report.target_type === 'USER') {
      authorId = report.target_id;
    }

    await supabase.from('content_reports').update({
      status: 'ACTIONED', reviewed_by: req.user.id, reviewed_at: new Date().toISOString(),
    }).eq('id', id);

    if (suspend_author && authorId) {
      const { data: author } = await supabase.from('users').select('role, pseudo').eq('id', authorId).single();
      if (author && canModerate(req.user.role, author.role)) {
        await supabase.from('users').update({
          is_active: false, suspension_reason: reason || 'Violation des règles de modération',
          suspended_by: req.user.id, suspended_at: new Date().toISOString(),
        }).eq('id', authorId);
        await supabase.from('refresh_tokens').update({ revoked: true }).eq('user_id', authorId);
      }
    }

    await supabase.from('admin_actions').insert({
      admin_id: req.user.id, action: `MODERATE_${report.target_type}_${action_type}`,
      target_type: report.target_type.toLowerCase(), target_id: report.target_id, reason,
      metadata: { author_id: authorId, suspended: !!suspend_author },
    });

    res.json({ message: 'Action effectuée' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ════════════════════════════════════════════════════════════════════════════════
// RETRAITS CRÉATEURS (PAYOUTS)
// ════════════════════════════════════════════════════════════════════════════════

router.get('/payouts', async (req, res) => {
  try {
    const { status = 'PENDING' } = req.query;
    const { data, error } = await supabase.from('payouts')
      .select('*, creator:users!payouts_creator_id_fkey(pseudo, kyc_status)')
      .eq('status', status)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/payouts/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { gateway_ref } = req.body;

    const { data: payout } = await supabase.from('payouts').select('*').eq('id', id).single();
    if (!payout) return res.status(404).json({ error: 'Demande de retrait introuvable' });
    if (payout.status !== 'PENDING') return res.status(400).json({ error: 'Cette demande a déjà été traitée' });

    await supabase.from('payouts').update({
      status: 'PAID', processed_by: req.user.id, processed_at: new Date().toISOString(),
      gateway_ref: gateway_ref || null,
    }).eq('id', id);

    await supabase.rpc('increment_total_withdrawn', { p_user_id: payout.creator_id, p_amount: payout.amount_xcon });

    await supabase.from('transactions').insert({
      id: uuidv4(), user_id: payout.creator_id, type: 'RETRAIT', amount_xcon: -payout.amount_xcon,
      balance_after: 0, description: 'Retrait approuvé et payé', gateway_ref: gateway_ref || null, status: 'SUCCESS',
    });

    await supabase.from('platform_revenue').insert({
      id: uuidv4(), source_type: 'COMMISSION_RETRAIT', amount_xcon: payout.commission_xcon,
      reference_id: id, user_id: payout.creator_id,
    });

    await supabase.from('admin_actions').insert({
      admin_id: req.user.id, action: 'APPROVE_PAYOUT',
      target_type: 'payout', target_id: id, metadata: { amount_xcon: payout.amount_xcon },
    });

    await supabase.from('notifications').insert({
      id: uuidv4(), user_id: payout.creator_id, title: '✅ Retrait effectué',
      message: `Votre retrait de ${payout.net_amount_xcon} FCFA a été traité`, type: 'PAYOUT_APPROVED',
    });

    res.json({ message: 'Retrait approuvé et marqué comme payé' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/payouts/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason || reason.length < 5) return res.status(400).json({ error: 'Motif de rejet requis (min 5 caractères)' });

    const { data: payout } = await supabase.from('payouts').select('*').eq('id', id).single();
    if (!payout) return res.status(404).json({ error: 'Demande de retrait introuvable' });
    if (payout.status !== 'PENDING') return res.status(400).json({ error: 'Cette demande a déjà été traitée' });

    await supabase.from('payouts').update({
      status: 'REJECTED', processed_by: req.user.id, processed_at: new Date().toISOString(),
      rejection_reason: reason,
    }).eq('id', id);

    await supabase.rpc('credit_pending_balance', { p_user_id: payout.creator_id, p_amount: payout.amount_xcon });

    await supabase.from('admin_actions').insert({
      admin_id: req.user.id, action: 'REJECT_PAYOUT',
      target_type: 'payout', target_id: id, reason,
    });

    await supabase.from('notifications').insert({
      id: uuidv4(), user_id: payout.creator_id, title: 'Retrait rejeté',
      message: `Votre demande de retrait a été rejetée : ${reason}. Le montant a été recrédité.`, type: 'PAYOUT_REJECTED',
    });

    res.json({ message: 'Retrait rejeté et solde recrédité' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ════════════════════════════════════════════════════════════════════════════════
// MAINTENANCE PLATEFORME
// ════════════════════════════════════════════════════════════════════════════════

router.get('/maintenance/status', async (req, res) => {
  try {
    const { data } = await supabase.from('platform_maintenance')
      .select('*').order('updated_at', { ascending: false }).limit(1).single();
    res.json(data || { status: 'ACTIF' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/maintenance/set', async (req, res) => {
  try {
    const { status, is_emergency } = req.body;
    const VALID = ['ACTIF', 'READ_ONLY', 'MAINTENANCE', 'FORCE_MAINTENANCE'];
    if (!VALID.includes(status)) return res.status(400).json({ error: 'Statut invalide' });
    if (status === 'FORCE_MAINTENANCE' && req.user.role !== 'SUPERADMIN')
      return res.status(403).json({ error: 'Seul un SUPERADMIN peut forcer la maintenance totale' });

    const { data: current } = await supabase.from('platform_maintenance')
      .select('status').order('updated_at', { ascending: false }).limit(1).single();
    const fromStatus = current?.status || 'ACTIF';

    await supabase.from('platform_maintenance').insert({
      status, triggered_by: req.user.id, triggered_at: new Date().toISOString(),
      is_emergency: !!is_emergency,
    });
    await supabase.from('platform_config').update({
      value: status, updated_at: new Date().toISOString(), updated_by: req.user.id,
    }).eq('key', 'MAINTENANCE_STATUS');

    await supabase.from('maintenance_history').insert({
      type: is_emergency ? 'URGENCE' : 'NORMALE', from_status: fromStatus, to_status: status,
      triggered_by: req.user.id,
    });

    await supabase.from('admin_actions').insert({
      admin_id: req.user.id, action: 'SET_MAINTENANCE_STATUS',
      target_type: 'platform', metadata: { from: fromStatus, to: status },
    });

    res.json({ message: `Statut de maintenance : ${status}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ════════════════════════════════════════════════════════════════════════════════
// FONCTIONNALITÉS IA — toggles ADMIN/SUPERADMIN
// ════════════════════════════════════════════════════════════════════════════════

const AI_CONFIG_KEYS = {
  AI_CONTENT_MODERATION_ENABLED: 'Scan IA des médias uploadés (détection de contenu inapproprié)',
  AI_TEXT_MODERATION_ENABLED: 'Modération IA des messages et commentaires (spam/harcèlement)',
  AI_REPORT_TRIAGE_ENABLED: 'Triage IA automatique des signalements par gravité',
  AI_AUTO_TAGGING_ENABLED: 'Génération IA de mots-clés/tags sur les nouveaux posts',
  AI_FRAUD_DETECTION_ENABLED: 'Détection IA d\'anomalies sur les transactions',
};

// ── GET /admin/ai-config — état de toutes les fonctionnalités IA ─────────────
router.get('/ai-config', async (req, res) => {
  try {
    const { data, error } = await supabase.from('platform_config')
      .select('key, value, description, updated_at, updated_by')
      .in('key', Object.keys(AI_CONFIG_KEYS));
    if (error) throw error;

    // S'assure que toutes les clés sont présentes même si absentes en base
    const byKey = Object.fromEntries((data || []).map((row) => [row.key, row]));
    const result = Object.entries(AI_CONFIG_KEYS).map(([key, defaultDescription]) => ({
      key,
      enabled: byKey[key]?.value === 'true',
      description: byKey[key]?.description || defaultDescription,
      updated_at: byKey[key]?.updated_at || null,
    }));

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /admin/ai-config/:key — activer/désactiver une fonctionnalité IA ─────
router.put('/ai-config/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { enabled } = req.body;

    if (!Object.keys(AI_CONFIG_KEYS).includes(key))
      return res.status(400).json({ error: 'Fonctionnalité IA inconnue' });
    if (typeof enabled !== 'boolean')
      return res.status(400).json({ error: 'Le champ "enabled" doit être un booléen' });

    const { error } = await supabase.from('platform_config')
      .update({ value: String(enabled), updated_at: new Date().toISOString(), updated_by: req.user.id })
      .eq('key', key);
    if (error) throw error;

    invalidateAIConfigCache();

    await supabase.from('admin_actions').insert({
      admin_id: req.user.id, action: 'SET_AI_CONFIG',
      target_type: 'platform', metadata: { key, enabled },
    });

    res.json({ message: `${AI_CONFIG_KEYS[key]} : ${enabled ? 'activé' : 'désactivé'}`, key, enabled });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ════════════════════════════════════════════════════════════════════════════════
// DÉTECTION DE FRAUDE — signalements automatiques
// ════════════════════════════════════════════════════════════════════════════════

// ── GET /admin/fraud-flags — liste des signalements de fraude en attente ─────
// ── GET /admin/ai-costs — coûts des appels IA (ADMIN + SUPERADMIN)
router.get('/ai-costs', async (req, res) => {
  try {
    const now = new Date();
    const starts = {
      day:   new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
      week:  new Date(now.getTime() - 7   * 86400000).toISOString(),
      month: new Date(now.getTime() - 30  * 86400000).toISOString(),
      year:  new Date(now.getFullYear(), 0, 1).toISOString(),
    };

    const { data: logs } = await supabase.from('ai_usage_log')
      .select('cost_usd, input_tokens, output_tokens, created_at')
      .gte('created_at', starts.year);

    const filter = (from) => (logs || []).filter((l) => new Date(l.created_at) >= new Date(from));
    const agg = (rows) => ({
      count: rows.length,
      cost_usd: rows.reduce((s, r) => s + Number(r.cost_usd || 0), 0),
      input_tokens: rows.reduce((s, r) => s + (r.input_tokens || 0), 0),
      output_tokens: rows.reduce((s, r) => s + (r.output_tokens || 0), 0),
    });

    // Courbe 30 jours
    const start30 = new Date(now.getTime() - 30 * 86400000);
    const byDay = {};
    filter(start30).forEach((l) => {
      const d = l.created_at.slice(0, 10);
      if (!byDay[d]) byDay[d] = { cost_usd: 0, count: 0 };
      byDay[d].cost_usd += Number(l.cost_usd || 0);
      byDay[d].count++;
    });
    const dailyCurve = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));

    const monthCost = agg(filter(starts.month)).cost_usd;
    const threshold = 10; // $10 par mois
    const alert = monthCost > threshold
      ? { level: 'red', message: `⚠️ Dépenses Claude ce mois : $${monthCost.toFixed(4)} — seuil $${threshold} dépassé` }
      : monthCost > threshold * 0.8
      ? { level: 'yellow', message: `🟡 Dépenses Claude ce mois : $${monthCost.toFixed(4)} — proche du seuil $${threshold}` }
      : null;

    res.json({
      day: agg(filter(starts.day)),
      week: agg(filter(starts.week)),
      month: agg(filter(starts.month)),
      year: agg(filter(starts.year)),
      dailyCurve, alert,
      threshold_usd: threshold,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/fraud-flags', async (req, res) => {
  try {
    const { status = 'PENDING' } = req.query;
    const { data, error } = await supabase.from('fraud_flags')
      .select('*, user:users!fraud_flags_user_id_fkey(pseudo, kyc_status, created_at)')
      .eq('status', status)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /admin/fraud-flags/:id/review — marquer un signalement comme traité ─
router.post('/fraud-flags/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'DISMISS' | 'ACTION'
    if (!['DISMISS', 'ACTION'].includes(action))
      return res.status(400).json({ error: 'Action invalide (DISMISS ou ACTION)' });

    const { error } = await supabase.from('fraud_flags')
      .update({
        status: action === 'DISMISS' ? 'DISMISSED' : 'ACTIONED',
        reviewed_by: req.user.id, reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;

    await supabase.from('admin_actions').insert({
      admin_id: req.user.id, action: 'REVIEW_FRAUD_FLAG',
      target_type: 'fraud_flag', target_id: id, metadata: { decision: action },
    });

    res.json({ message: 'Signalement traité' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ════════════════════════════════════════════════════════════════════════════════
// CATÉGORIES
// ════════════════════════════════════════════════════════════════════════════════

router.post('/categories', requireRole('SUPERADMIN'), async (req, res) => {
  try {
    const { name, slug, description, icon } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'Nom et slug requis' });

    const { data, error } = await supabase.from('categories').insert({
      id: uuidv4(), name, slug, description: description || null, icon: icon || null,
    }).select().single();
    if (error) throw error;

    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/categories/:id', requireRole('SUPERADMIN'), async (req, res) => {
  try {
    const { is_active, name, description, icon } = req.body;
    const updates = {};
    if (is_active !== undefined) updates.is_active = !!is_active;
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (icon !== undefined) updates.icon = icon;

    const { data, error } = await supabase.from('categories').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Catégorie introuvable' });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

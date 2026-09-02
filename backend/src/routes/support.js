// ============================================================
// KASOLIFE — Route Support
// Statuts : OPEN / CLOSED
// Priorités : LOW / MEDIUM / HIGH / URGENT
// Réponses automatiques depuis support_autoresponses.json
// Notification SUPERADMIN push + SMS si URGENT
// Accusé de réception automatique
// Nettoyage messages expirés (cron intégré)
// ============================================================
'use strict';
const express      = require('express');
const { v4: uuidv4, validate: isUUID } = require('uuid');
const rateLimit    = require('express-rate-limit');
const sanitizeHtml = require('sanitize-html');
const path         = require('path');
const fs           = require('fs');
const supabase     = require('../config/supabase');
const { authMiddleware, requireMinRole } = require('../middleware/auth');
const { sendPushNotification } = require('../services/notifications');
const { sendSMS } = require('../services/sms');
const {
  SUPPORT_MAX_MESSAGES,
  SUPPORT_MSG_MAX_CHARS,
  SUPPORT_MSG_EXPIRY_DAYS,
} = require('../config/constants');

const router = express.Router();

// ── Réponses automatiques ──────────────────────────────────────────────────────
const AUTORESPONSES_PATH = path.join(__dirname, '../data/support_autoresponses.json');
let autoResponses = [];
try {
  autoResponses = JSON.parse(fs.readFileSync(AUTORESPONSES_PATH, 'utf8'));
} catch (e) {
  console.warn('[Support] Fichier autoresponses introuvable — réponses auto désactivées');
}

// ── Rate limit dédié ──────────────────────────────────────────────────────────
const supportRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, max: 5,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Trop de messages — réessayez dans 10 minutes' },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const sanitize   = (t) => sanitizeHtml(t, { allowedTags: [], allowedAttributes: {} });
const validUUID  = (id) => isUUID(id);

// Détection automatique de la priorité par mots-clés
const detectPriority = (message) => {
  const m = message.toLowerCase();
  if (['suspendu','bloqué','urgent','arnaque','volé','arnaqué','fraude','problème grave'].some(k => m.includes(k)))
    return 'URGENT';
  if (['gain','retrait','dépôt','pas reçu','non crédité','erreur paiement','compte bloqué'].some(k => m.includes(k)))
    return 'HIGH';
  if (['bug','contenu','résolution','délai','attente'].some(k => m.includes(k)))
    return 'MEDIUM';
  return 'LOW';
};

// Matching réponse automatique par score de mots-clés
const findAutoResponse = (message, lang = 'fr') => {
  if (!autoResponses.length) return null;
  const m = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  let bestMatch = null;
  let bestScore = 0;

  for (const resp of autoResponses) {
    const score = resp.keywords.reduce((s, kw) => {
      const kwNorm = kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      return s + (m.includes(kwNorm) ? 1 : 0);
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = resp;
    }
  }
  if (!bestMatch || bestScore < 1) return null;
  return {
    response:       lang === 'en' ? bestMatch.response_en : bestMatch.response_fr,
    escalate:       bestMatch.escalate_to_admin,
    id:             bestMatch.id,
    category:       bestMatch.category,
    priority:       bestMatch.priority,
  };
};

// Notifier tous les SUPERADMIN
const notifySuperAdmins = async (title, body, data = {}) => {
  try {
    const { data: admins } = await supabase.from('users')
      .select('id, phone').eq('role', 'super_admin').eq('is_active', true);
    if (!admins?.length) return;
    await Promise.all(admins.map(async (admin) => {
      await sendPushNotification(admin.id, title, body, data).catch(() => {});
      if (data.urgent && admin.phone) {
        await sendSMS(admin.phone, `KASOLIFE SUPPORT URGENT — ${body}`).catch(() => {});
      }
    }));
  } catch (e) { console.error('[Support] notifySuperAdmins', e.message); }
};

// Envoyer accusé de réception automatique
const sendAcknowledgment = async (userId) => {
  try {
    await supabase.from('support_messages').insert({
      id: uuidv4(), user_id: userId,
      sender_role: 'ADMIN',
      message: 'Message reçu, nous revenons vers vous rapidement.',
      is_auto: true, status: 'READ',
    });
  } catch (e) { console.error('[Support] sendAcknowledgment', e.message); }
};

// ── Nettoyage messages expirés (appelé périodiquement) ────────────────────────
const cleanExpiredMessages = async () => {
  try {
    const cutoff = new Date(Date.now() - SUPPORT_MSG_EXPIRY_DAYS * 24 * 3600000).toISOString();
    const { error } = await supabase.from('support_messages')
      .delete()
      .lt('created_at', cutoff)
      .neq('conv_status', 'OPEN'); // Garder les conversations ouvertes
    if (!error) console.log(`[Support] Nettoyage messages antérieurs au ${cutoff}`);
  } catch (e) { console.error('[Support] cleanExpiredMessages', e.message); }
};

// Déclencher le nettoyage toutes les 24h
setInterval(cleanExpiredMessages, 24 * 3600 * 1000);

// ── POST /support — Envoyer un message (utilisateur) ─────────────────────────
router.post('/', authMiddleware, supportRateLimit, async (req, res) => {
  try {
    const { message, lang = 'fr' } = req.body;
    const userId = req.user.id;

    if (!message?.trim())
      return res.status(400).json({ error: 'Le message ne peut pas être vide' });
    if (message.length > SUPPORT_MSG_MAX_CHARS)
      return res.status(400).json({ error: `Message trop long — maximum ${SUPPORT_MSG_MAX_CHARS} caractères` });

    const cleanMessage = sanitize(message.trim());
    const priority     = detectPriority(cleanMessage);

    // Vérifier limite 35 messages
    const { count } = await supabase.from('support_messages')
      .select('id', { count: 'exact', head: true }).eq('user_id', userId);
    if ((count || 0) >= SUPPORT_MAX_MESSAGES)
      return res.status(400).json({
        error: `Limite de ${SUPPORT_MAX_MESSAGES} messages atteinte. Veuillez reposer votre problème dans une nouvelle conversation.`,
        limit_reached: true,
      });

    // Insérer le message
    const { data, error } = await supabase.from('support_messages').insert({
      id: uuidv4(), user_id: userId,
      sender_role: 'USER',
      message: cleanMessage,
      priority,
      conv_status: 'OPEN',
      is_auto: false,
    }).select().single();
    if (error) throw error;

    // Accusé de réception immédiat
    await sendAcknowledgment(userId);

    // Réponse automatique si LOW / MEDIUM / HIGH (pas URGENT)
    if (priority !== 'URGENT') {
      const auto = findAutoResponse(cleanMessage, lang);
      if (auto) {
        await supabase.from('support_messages').insert({
          id: uuidv4(), user_id: userId,
          sender_role: 'ADMIN',
          message: auto.response,
          parent_id: data.id,
          is_auto: true,
          auto_response_id: auto.id,
          status: 'READ',
        });
        // Escalade si nécessaire malgré la réponse auto
        if (auto.escalate) {
          await notifySuperAdmins(
            '⚠️ Support — Escalade requise',
            `Ticket ${priority} nécessite attention : "${cleanMessage.slice(0,80)}..."`,
            { type: 'SUPPORT_ESCALADE', userId, priority, urgent: priority === 'URGENT' }
          );
        }
        return res.status(201).json({ message: 'Message envoyé', data, auto_replied: true });
      }
    }

    // Pas de réponse auto — notifier SUPERADMIN
    await notifySuperAdmins(
      priority === 'URGENT' ? '🚨 Support URGENT' : '💬 Nouveau message support',
      `${priority} — "${cleanMessage.slice(0,80)}..."`,
      { type: 'SUPPORT_NEW', userId, priority, urgent: priority === 'URGENT' }
    );

    res.status(201).json({ message: 'Message envoyé', data, auto_replied: false });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /support/my — Historique conversation utilisateur ─────────────────────
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.from('support_messages')
      .select('*').eq('user_id', req.user.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /support/unread-count ─────────────────────────────────────────────────
router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const { count, error } = await supabase.from('support_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id).eq('sender_role', 'ADMIN').eq('status', 'PENDING');
    if (error) throw error;
    res.json({ unread: count || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /support/:id/mark-read ────────────────────────────────────────────────
router.put('/:id/mark-read', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!validUUID(id)) return res.status(400).json({ error: 'Identifiant invalide' });
    const { data: msg } = await supabase.from('support_messages')
      .select('user_id').eq('id', id).single();
    if (!msg || msg.user_id !== req.user.id)
      return res.status(403).json({ error: 'Accès refusé' });
    await supabase.from('support_messages').update({ status: 'READ' }).eq('id', id);
    res.json({ message: 'Message marqué comme lu' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /support/:id/reply — Répondre (admin) ────────────────────────────────
router.post('/:id/reply', authMiddleware, requireMinRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    if (!validUUID(id)) return res.status(400).json({ error: 'Identifiant invalide' });
    if (!message?.trim()) return res.status(400).json({ error: 'Message vide' });
    if (message.length > SUPPORT_MSG_MAX_CHARS)
      return res.status(400).json({ error: `Message trop long — max ${SUPPORT_MSG_MAX_CHARS} caractères` });

    const { data: original } = await supabase.from('support_messages')
      .select('user_id, priority').eq('id', id).single();
    if (!original) return res.status(404).json({ error: 'Message introuvable' });

    const targetUserId = original.user_id;

    // Vérifier limite conversation
    const { count } = await supabase.from('support_messages')
      .select('id', { count: 'exact', head: true }).eq('user_id', targetUserId);
    if ((count || 0) >= SUPPORT_MAX_MESSAGES)
      return res.status(400).json({ error: 'Limite de messages atteinte pour cette conversation' });

    const { data, error } = await supabase.from('support_messages').insert({
      id: uuidv4(), user_id: targetUserId,
      sender_role: 'ADMIN',
      admin_id: req.user.id,
      parent_id: id,
      message: sanitize(message.trim()),
      is_auto: false, status: 'PENDING',
    }).select().single();
    if (error) throw error;

    await supabase.from('support_messages').update({ status: 'REPLIED' }).eq('id', id);

    await sendPushNotification(
      targetUserId,
      '💬 Réponse du support',
      'L\'équipe KasoLife a répondu — appuyez pour lire',
      { type: 'SUPPORT_REPLY', messageId: id }
    ).catch(() => {});

    res.status(201).json({ message: 'Réponse envoyée', data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /support/admin/:id/status — Changer statut OPEN/CLOSED ───────────────
router.put('/admin/:id/status', authMiddleware, requireMinRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!validUUID(id)) return res.status(400).json({ error: 'Identifiant invalide' });
    if (!['OPEN','CLOSED'].includes(status))
      return res.status(400).json({ error: 'Statut invalide — OPEN ou CLOSED' });
    await supabase.from('support_messages')
      .update({ conv_status: status }).eq('id', id);
    res.json({ message: `Conversation marquée ${status}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /support/admin/:id/priority — Changer priorité ───────────────────────
router.put('/admin/:id/priority', authMiddleware, requireMinRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;
    if (!validUUID(id)) return res.status(400).json({ error: 'Identifiant invalide' });
    if (!['LOW','MEDIUM','HIGH','URGENT'].includes(priority))
      return res.status(400).json({ error: 'Priorité invalide' });
    await supabase.from('support_messages').update({ priority }).eq('id', id);
    if (priority === 'URGENT') {
      const { data: msg } = await supabase.from('support_messages')
        .select('message, user_id').eq('id', id).single();
      if (msg) {
        await notifySuperAdmins(
          '🚨 Ticket escaladé URGENT',
          `"${(msg.message||'').slice(0,80)}..."`,
          { type: 'SUPPORT_URGENT', userId: msg.user_id, urgent: true }
        );
      }
    }
    res.json({ message: `Priorité mise à jour : ${priority}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /support/admin/all — Tous les tickets (admin) ────────────────────────
router.get('/admin/all', authMiddleware, requireMinRole('admin'), async (req, res) => {
  try {
    const { limit = 50, offset = 0, status, priority } = req.query;
    let query = supabase.from('support_messages')
      .select('*, user:users(id, name, phone)')
      .eq('sender_role', 'USER')
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);
    if (status)   query = query.eq('conv_status', status);
    if (priority) query = query.eq('priority', priority);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /support/admin/unread — Compteur non lus (admin) ─────────────────────
router.get('/admin/unread', authMiddleware, requireMinRole('admin'), async (req, res) => {
  try {
    const { count } = await supabase.from('support_messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender_role', 'USER').eq('conv_status', 'OPEN').eq('status', 'PENDING');
    res.json({ unread: count || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /support/admin/conversation/:userId ───────────────────────────────────
router.get('/admin/conversation/:userId', authMiddleware, requireMinRole('admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    if (!validUUID(userId)) return res.status(400).json({ error: 'Identifiant invalide' });
    const { data, error } = await supabase.from('support_messages')
      .select('*').eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /support/admin/emails — Emails de notification ───────────────────────
router.get('/admin/emails', authMiddleware, requireMinRole('super_admin'), async (req, res) => {
  try {
    const { data, error } = await supabase.from('support_notification_emails')
      .select('*').order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /support/admin/emails — Ajouter un email ────────────────────────────
router.post('/admin/emails', authMiddleware, requireMinRole('super_admin'), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return res.status(400).json({ error: 'Adresse email invalide' });
    const { data, error } = await supabase.from('support_notification_emails').insert({
      id: uuidv4(), email: email.trim().toLowerCase(), created_by: req.user.id,
    }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /support/admin/emails/:id ─────────────────────────────────────────
router.delete('/admin/emails/:id', authMiddleware, requireMinRole('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!validUUID(id)) return res.status(400).json({ error: 'Identifiant invalide' });
    await supabase.from('support_notification_emails').delete().eq('id', id);
    res.json({ message: 'Email supprimé' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /support/admin/ai-report — Rapport IA sur 7 derniers jours ──────────
router.post('/admin/ai-report', authMiddleware, requireMinRole('super_admin'), async (req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 3600000).toISOString();
    const { data: messages } = await supabase.from('support_messages')
      .select('message, priority, conv_status, created_at, sender_role')
      .eq('sender_role', 'USER')
      .gte('created_at', since)
      .order('created_at', { ascending: true });

    if (!messages?.length)
      return res.json({ report: 'Aucun message utilisateur dans les 7 derniers jours.', generated_at: new Date().toISOString() });

    const messagesText = messages.map((m, i) =>
      `[${i+1}] ${new Date(m.created_at).toLocaleDateString('fr-FR')} — ${m.priority} — ${m.message}`
    ).join('\n');

    // Appel Claude claude-haiku-4-5 (modèle économique)
    const { Anthropic } = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Tu es un analyste support pour KasoLife, plateforme de créateurs de contenu en Afrique francophone.

Voici les ${messages.length} messages utilisateurs des 7 derniers jours :

${messagesText}

Génère un rapport structuré en français avec :
1. **Anomalies signalées** (bugs, problèmes de paiement, erreurs techniques)
2. **Suggestions des utilisateurs** (améliorations demandées)
3. **Tendances récurrentes** (problèmes fréquents avec nombre d'occurrences)
4. **Recommandations prioritaires** (classées par impact ROI)

Sois concis, factuel, orienté action.`,
      }],
    });

    const reportText = response.content[0]?.text || 'Rapport non généré';

    // Sauvegarder le rapport
    const reportId = uuidv4();
    await supabase.from('support_ai_reports').insert({
      id: reportId,
      generated_by: req.user.id,
      messages_count: messages.length,
      period_start: since,
      period_end: new Date().toISOString(),
      report_text: reportText,
    });

    // Envoyer par email aux adresses enregistrées
    const { data: emails } = await supabase.from('support_notification_emails').select('email');
    if (emails?.length) {
      const { sendEmail } = require('../services/email');
      await Promise.all(emails.map(({ email }) =>
        sendEmail(email, `[KasoLife] Rapport support IA — ${new Date().toLocaleDateString('fr-FR')}`, reportText)
          .catch(() => {})
      ));
    }

    res.json({
      report: reportText,
      report_id: reportId,
      messages_analyzed: messages.length,
      generated_at: new Date().toISOString(),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /support/admin/ai-reports — Liste des rapports ───────────────────────
router.get('/admin/ai-reports', authMiddleware, requireMinRole('super_admin'), async (req, res) => {
  try {
    const { data, error } = await supabase.from('support_ai_reports')
      .select('id, generated_by, messages_count, period_start, period_end, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /support/admin/ai-reports/:id — Détail d'un rapport ──────────────────
router.get('/admin/ai-reports/:id', authMiddleware, requireMinRole('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!validUUID(id)) return res.status(400).json({ error: 'Identifiant invalide' });
    const { data, error } = await supabase.from('support_ai_reports')
      .select('*').eq('id', id).single();
    if (error || !data) return res.status(404).json({ error: 'Rapport introuvable' });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /support/admin/ai-reports/:id ─────────────────────────────────────
router.delete('/admin/ai-reports/:id', authMiddleware, requireMinRole('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!validUUID(id)) return res.status(400).json({ error: 'Identifiant invalide' });
    await supabase.from('support_ai_reports').delete().eq('id', id);
    res.json({ message: 'Rapport supprimé' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

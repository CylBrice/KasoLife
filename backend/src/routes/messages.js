// ============================================================
// KASOLIFE — Routes /messages v1.0
// Messagerie privée (texte/media, gratuit ou PPV) + pourboires (tips)
// ============================================================
'use strict';
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authMiddleware, requireNotWalletFrozen } = require('../middleware/auth');
const {
  PPV_PRICE_MIN, PPV_PRICE_MAX, PPV_COMMISSION_RATE,
  TIP_MIN, TIP_MAX, TIP_COMMISSION_RATE,
} = require('../config/constants');
const { moderateText, triageReport, detectDistress, translateText } = require('../services/aiModeration');

const router = express.Router();

// ── GET /messages/conversations — liste des conversations de l'utilisateur
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    // Récupère le dernier message de chaque conversation (via messages où l'user est sender ou receiver)
    const { data, error } = await supabase.from('messages')
      .select('id, sender_id, receiver_id, content, media_url, price_xcon, is_paid, created_at')
      .or(`sender_id.eq.${req.user.id},receiver_id.eq.${req.user.id}`)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;

    // Grouper par interlocuteur (le plus récent par conversation)
    const conversationsMap = new Map();
    for (const msg of data || []) {
      const otherId = msg.sender_id === req.user.id ? msg.receiver_id : msg.sender_id;
      if (!conversationsMap.has(otherId)) conversationsMap.set(otherId, msg);
    }

    const otherIds = [...conversationsMap.keys()];
    if (otherIds.length === 0) return res.json([]);

    const { data: users } = await supabase.from('users')
      .select('id, pseudo, avatar_url, role').in('id', otherIds);
    const usersMap = new Map((users || []).map(u => [u.id, u]));

    const conversations = otherIds.map(id => ({
      user: usersMap.get(id),
      last_message: conversationsMap.get(id),
    })).sort((a, b) => new Date(b.last_message.created_at) - new Date(a.last_message.created_at));

    res.json(conversations);
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── GET /messages/:userId — historique de conversation avec un utilisateur
router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const pageNum  = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const offset   = (pageNum - 1) * pageSize;

    const { data, error } = await supabase.from('messages')
      .select('id, sender_id, receiver_id, content, media_url, price_xcon, is_paid, paid_by, created_at')
      .or(`and(sender_id.eq.${req.user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${req.user.id})`)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;

    // Masquer le contenu PPV non payé pour le destinataire
    const serialized = (data || []).map(msg => {
      if (msg.price_xcon > 0 && !msg.is_paid && msg.receiver_id === req.user.id) {
        return { ...msg, content: null, media_url: null, locked: true };
      }
      return { ...msg, locked: false };
    });

    res.json(serialized.reverse());
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /messages/:userId — envoyer un message (gratuit ou PPV)
router.post('/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { content, media_url, price_xcon } = req.body;

    if (userId === req.user.id) return res.status(400).json({ error: 'Action impossible sur votre propre profil' });
    if (!content && !media_url) return res.status(400).json({ error: 'Message vide' });
    if (content && content.length > 2000) return res.status(400).json({ error: 'Message trop long (max 2000 caractères)' });

    const { data: receiver } = await supabase.from('users').select('id, is_active').eq('id', userId).single();
    if (!receiver || !receiver.is_active) return res.status(404).json({ error: 'Destinataire introuvable' });

    if (content) {
      const modResult = await moderateText(content, 'message');
      if (!modResult.allowed) {
        return res.status(422).json({ error: 'Ce message ne respecte pas nos règles de communauté.', reason: modResult.reason });
      }
    }

    let price = 0;
    let isPaid = false;
    if (price_xcon !== undefined && price_xcon > 0) {
      price = Number(price_xcon);
      if (price < PPV_PRICE_MIN || price > PPV_PRICE_MAX)
        return res.status(400).json({ error: `Le prix doit être entre ${PPV_PRICE_MIN} et ${PPV_PRICE_MAX} FCFA` });
      // Seuls les créateurs peuvent envoyer des messages payants
      if (req.user.role === 'user' && !['admin','super_admin','root_admin'].includes(req.user.role))
        return res.status(403).json({ error: 'Seuls les créateurs peuvent envoyer des messages payants' });
    } else {
      isPaid = true; // message gratuit considéré "payé" pour simplifier l'affichage
    }

    const { data: message, error } = await supabase.from('messages').insert({
      id: uuidv4(), sender_id: req.user.id, receiver_id: userId,
      content: content || null, media_url: media_url || null,
      price_xcon: price, is_paid: isPaid,
    }).select().single();
    if (error) throw error;

    await supabase.from('notifications').insert({
      id: uuidv4(), user_id: userId, title: 'Nouveau message',
      message: price > 0 ? 'Vous avez reçu un message exclusif' : 'Vous avez reçu un nouveau message',
      type: 'MESSAGE',
    });

    // ── Détection de langage de détresse (best-effort, asynchrone, ne bloque jamais l'envoi)
    if (content) {
      detectDistress(content).then(async (result) => {
        if (result.distress) {
          // Notifie les admins pour suivi humain (les ressources de crise ne sont
          // jamais affichées automatiquement à l'utilisateur — suivi humain requis)
          const { data: admins } = await supabase.from('users').select('id').in('role', ['admin','super_admin','root_admin']);
          for (const admin of admins || []) {
            await supabase.from('notifications').insert({
              id: uuidv4(), user_id: admin.id,
              title: 'Signal de détresse détecté',
              message: `Un message envoyé par l'utilisateur ${req.user.id} a été signalé (sévérité : ${result.severity || 'inconnue'}). Un suivi humain est recommandé.`,
              type: 'ADMIN_ALERT',
            });
          }
        }
      }).catch(() => {});
    }

    res.status(201).json(message);
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /messages/:messageId/unlock — débloquer un message payant
router.post('/:messageId/unlock', authMiddleware, requireNotWalletFrozen, async (req, res) => {
  try {
    const { messageId } = req.params;

    const { data: message } = await supabase.from('messages')
      .select('id, sender_id, receiver_id, price_xcon, is_paid').eq('id', messageId).single();
    if (!message) return res.status(404).json({ error: 'Message introuvable' });
    if (message.receiver_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé' });
    if (message.price_xcon <= 0 || message.is_paid) return res.status(400).json({ error: 'Ce message ne nécessite pas de paiement' });

    const price = message.price_xcon;
    const commission = Math.round(price * PPV_COMMISSION_RATE);
    const creatorShare = price - commission;

    const { data: newBalance, error: debitErr } = await supabase.rpc('debit_wallet', {
      p_user_id: req.user.id, p_amount: price,
    });
    if (debitErr) {
      if (debitErr.message?.includes('Solde insuffisant'))
        return res.status(402).json({ error: 'Solde insuffisant — veuillez recharger votre wallet' });
      throw debitErr;
    }

    await supabase.from('messages').update({ is_paid: true, paid_by: req.user.id }).eq('id', messageId);
    await supabase.rpc('credit_pending_balance', { p_user_id: message.sender_id, p_amount: creatorShare });

    await supabase.from('transactions').insert([
      {
        id: uuidv4(), user_id: req.user.id, type: 'PPV_PAYMENT', amount_xcon: -price,
        balance_after: newBalance, description: 'Déblocage message exclusif', related_user_id: message.sender_id,
      },
      {
        id: uuidv4(), user_id: message.sender_id, type: 'PPV_INCOME', amount_xcon: creatorShare,
        balance_after: 0, description: `Message exclusif débloqué (commission ${(PPV_COMMISSION_RATE * 100).toFixed(0)}%)`,
        related_user_id: req.user.id,
      },
    ]);

    await supabase.from('platform_revenue').insert({
      id: uuidv4(), source_type: 'COMMISSION_PPV', amount_xcon: commission,
      reference_id: messageId, user_id: message.sender_id,
    });

    const { data: unlocked } = await supabase.from('messages').select('*').eq('id', messageId).single();
    res.json({ message: 'Message débloqué', data: unlocked, balance_xcon: newBalance });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur', details: err.message }); }
});

// ── POST /messages/:userId/tip — envoyer un pourboire
router.post('/:userId/tip', authMiddleware, requireNotWalletFrozen, async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount_xcon, message: tipMessage, post_id } = req.body;

    if (userId === req.user.id) return res.status(400).json({ error: 'Action impossible sur votre propre profil' });

    const amount = Number(amount_xcon);
    if (!amount || amount < TIP_MIN || amount > TIP_MAX)
      return res.status(400).json({ error: `Le montant doit être entre ${TIP_MIN} et ${TIP_MAX} FCFA` });
    if (tipMessage && tipMessage.length > 300)
      return res.status(400).json({ error: 'Message trop long (max 300 caractères)' });

    const { data: receiver } = await supabase.from('users').select('id, role, is_active').eq('id', userId).single();
    if (!receiver || !receiver.is_active) return res.status(404).json({ error: 'Destinataire introuvable' });
    if (receiver.role === 'user') return res.status(400).json({ error: 'Les pourboires sont réservés aux créateurs' });

    if (post_id) {
      const { data: post } = await supabase.from('posts').select('id').eq('id', post_id).eq('creator_id', userId).single();
      if (!post) return res.status(404).json({ error: 'Post introuvable' });
    }

    const commission = Math.round(amount * TIP_COMMISSION_RATE);
    const creatorShare = amount - commission;

    const { data: newBalance, error: debitErr } = await supabase.rpc('debit_wallet', {
      p_user_id: req.user.id, p_amount: amount,
    });
    if (debitErr) {
      if (debitErr.message?.includes('Solde insuffisant'))
        return res.status(402).json({ error: 'Solde insuffisant — veuillez recharger votre wallet' });
      throw debitErr;
    }

    const { data: tip, error } = await supabase.from('tips').insert({
      id: uuidv4(), sender_id: req.user.id, receiver_id: userId, post_id: post_id || null,
      amount_xcon: amount, commission_xcon: commission, message: tipMessage || null,
    }).select().single();
    if (error) throw error;

    await supabase.rpc('credit_pending_balance', { p_user_id: userId, p_amount: creatorShare });

    await supabase.from('transactions').insert([
      {
        id: uuidv4(), user_id: req.user.id, type: 'TIP_SENT', amount_xcon: -amount,
        balance_after: newBalance, description: 'Pourboire envoyé', related_user_id: userId, related_post_id: post_id || null,
      },
      {
        id: uuidv4(), user_id: userId, type: 'TIP_RECEIVED', amount_xcon: creatorShare,
        balance_after: 0, description: `Pourboire reçu (commission ${(TIP_COMMISSION_RATE * 100).toFixed(0)}%)`,
        related_user_id: req.user.id, related_post_id: post_id || null,
      },
    ]);

    await supabase.from('platform_revenue').insert({
      id: uuidv4(), source_type: 'COMMISSION_TIP', amount_xcon: commission,
      reference_id: tip.id, user_id: userId,
    });

    await supabase.from('notifications').insert({
      id: uuidv4(), user_id: userId, title: '💸 Nouveau pourboire',
      message: `Vous avez reçu un pourboire de ${creatorShare} FCFA`,
      type: 'TIP',
    });

    res.status(201).json({ message: 'Pourboire envoyé', tip, balance_xcon: newBalance });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur', details: err.message }); }
});

// ── POST /messages/:messageId/report — signaler un message
router.post('/:messageId/report', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { reason } = req.body;
    if (!reason || reason.length < 5 || reason.length > 300)
      return res.status(400).json({ error: 'Motif requis (5 à 300 caractères)' });

    const { data: message } = await supabase.from('messages')
      .select('id, sender_id, receiver_id, content').eq('id', messageId).single();
    if (!message) return res.status(404).json({ error: 'Message introuvable' });
    if (message.sender_id !== req.user.id && message.receiver_id !== req.user.id)
      return res.status(403).json({ error: 'Accès refusé' });

    const triage = await triageReport({ reason, targetType: 'message', targetContent: message.content });

    const { error } = await supabase.from('content_reports').insert({
      reporter_id: req.user.id, target_type: 'MESSAGE', target_id: messageId, reason,
      ai_severity: triage.severity, ai_summary: triage.summary,
    });
    if (error) throw error;

    res.status(201).json({ message: "Signalement envoyé — notre équipe va l'examiner" });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /messages/:messageId/translate — traduction à la demande
router.post('/:messageId/translate', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { target_lang = 'fr' } = req.body;

    const { data: message } = await supabase.from('messages')
      .select('id, sender_id, receiver_id, content').eq('id', messageId).single();
    if (!message) return res.status(404).json({ error: 'Message introuvable' });
    if (message.sender_id !== req.user.id && message.receiver_id !== req.user.id)
      return res.status(403).json({ error: 'Accès refusé' });
    if (!message.content) return res.status(400).json({ error: 'Aucun texte à traduire' });

    const translation = await translateText(message.content, target_lang);
    if (!translation) return res.status(503).json({ error: 'Traduction indisponible pour le moment' });

    res.json({ translation, target_lang });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

module.exports = router;

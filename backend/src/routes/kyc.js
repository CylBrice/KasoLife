// ============================================================
// KASOLIFE — Routes /kyc v1.0
// Adapté depuis KasoLife — bonus JTON remplacé par bonus parrainage FCFA
// Vérification d'identité via Didit — requise pour devenir créateur ou retirer des fonds
// ============================================================
'use strict';
const express = require('express');
const crypto  = require('crypto');
const { v4: uuidv4 } = require('uuid');
const supabase  = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const { sendPushNotification } = require('../services/notifications');
const {
  KYC_MAX_ATTEMPTS, DIDIT_API_URL, REFERRAL_BONUS_FCFA,
} = require('../config/constants');

const router = express.Router();

// ── Helper Didit API
const diditRequest = async (path, method = 'GET', body = null) => {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DIDIT_API_KEY}`,
      'X-Client-ID': process.env.DIDIT_CLIENT_ID || '',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${DIDIT_API_URL}${path}`, opts);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Didit API ${res.status}: ${err}`);
  }
  return res.json();
};

// ── GET /kyc/status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const { data: user } = await supabase.from('users')
      .select('kyc_status, kyc_attempts, kyc_verified_at')
      .eq('id', req.user.id).single();
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json({
      kyc_status:      user.kyc_status,
      kyc_attempts:    user.kyc_attempts,
      kyc_verified_at: user.kyc_verified_at,
      attempts_left:   Math.max(0, KYC_MAX_ATTEMPTS - (user.kyc_attempts || 0)),
      max_attempts:    KYC_MAX_ATTEMPTS,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /kyc/initiate
router.post('/initiate', authMiddleware, async (req, res) => {
  try {
    const { data: user } = await supabase.from('users')
      .select('kyc_status, kyc_attempts, language, pseudo')
      .eq('id', req.user.id).single();

    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (user.kyc_status === 'VERIFIED')
      return res.status(400).json({ error: 'Identité déjà vérifiée', kyc_status: 'VERIFIED' });

    const attempts = user.kyc_attempts || 0;
    if (user.kyc_status === 'SUPPORT' || attempts >= KYC_MAX_ATTEMPTS) {
      await supabase.from('users').update({ kyc_status: 'SUPPORT' }).eq('id', req.user.id);
      return res.status(403).json({
        error: 'Limite de tentatives atteinte — veuillez contacter le support',
        kyc_status: 'SUPPORT',
        support_email:    process.env.SUPPORT_EMAIL    || 'support@kasolife.com',
        support_whatsapp: process.env.SUPPORT_WHATSAPP || '',
        support_telegram: process.env.SUPPORT_TELEGRAM || '',
      });
    }

    const lang    = user.language === 'en' ? 'en' : 'fr';
    const session = await diditRequest('/session/', 'POST', {
      callback_url: `${process.env.API_URL}/kyc/webhook`,
      redirect_url: `${process.env.APP_URL}/kyc/result`,
      vendor_data:  req.user.id,
      locale:       lang,
      features:     'OCR + FACE',
    });

    await supabase.from('users').update({
      kyc_didit_ref: session.session_id,
      kyc_status:    'PENDING',
    }).eq('id', req.user.id);

    res.json({
      session_id:    session.session_id,
      session_url:   session.session_url,
      attempts_left: KYC_MAX_ATTEMPTS - attempts,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /kyc/webhook — callback Didit
router.post('/webhook', async (req, res) => {
  // Répondre 200 immédiatement (Didit n'attend pas le traitement complet)
  res.status(200).json({ received: true });

  try {
    // Vérification signature X-Signature-V2 (même algo que KasoPlex)
    const signature = req.headers['x-signature-v2'];
    const timestamp = req.headers['x-timestamp'];
    const secret    = process.env.DIDIT_API_KEY || process.env.DIDIT_WEBHOOK_SECRET;

    if (!secret || !signature || !timestamp) {
      console.warn('[KYC] Webhook — headers signature manquants');
      return;
    }

    // Anti-replay : fenêtre 5 min
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
      console.warn('[KYC] Webhook — timestamp expiré (anti-replay)');
      return;
    }

    // Payload canonique : clés JSON triées récursivement (même logique KasoPlex)
    const sortKeysDeep = (obj) => {
      if (Array.isArray(obj)) return obj.map(sortKeysDeep);
      if (obj !== null && typeof obj === 'object')
        return Object.fromEntries(Object.keys(obj).sort().map(k => [k, sortKeysDeep(obj[k])]));
      return obj;
    };
    const canonical = JSON.stringify(sortKeysDeep(req.body));
    const expected  = crypto.createHmac('sha256', secret).update(canonical).digest('hex');

    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected,  'hex');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      console.warn('[KYC] Signature webhook invalide — possible tentative de falsification');
      return;
    }

    const { session_id, status, vendor_data: userId } = req.body;
    if (!userId || !session_id) return;

    const { data: user } = await supabase.from('users')
      .select('kyc_status, kyc_attempts, language, pseudo')
      .eq('id', userId).single();
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    // ── IDEMPOTENCE : ignorer si déjà traité pour cette session
    if (user.kyc_status === 'VERIFIED' && user.kyc_didit_ref === session_id) {
      return res.json({ received: true, note: 'Déjà traité' });
    }

    if (status === 'APPROVED') {
      // Marquer VERIFIED avant tout crédit (protection double appel)
      const { error: updateErr } = await supabase.from('users').update({
        kyc_status:      'VERIFIED',
        kyc_verified_at: new Date().toISOString(),
        kyc_didit_ref:   session_id,
      }).eq('id', userId).eq('kyc_status', 'PENDING'); // filtre sur PENDING = idempotent

      if (updateErr) {
        // Déjà mis à jour par un autre appel concurrent — ignorer
        return res.json({ received: true, note: 'Race condition ignorée' });
      }

      // ── Bonus de parrainage filleul (FCFA) — versé une fois le KYC vérifié
      let referralBonus = 0;
      const { data: tracking } = await supabase.from('referral_tracking')
        .select('id, parrain_id, bonus_filleul_given')
        .eq('filleul_id', userId).eq('bonus_filleul_given', false).single();

      if (tracking && REFERRAL_BONUS_FCFA > 0) {
        referralBonus = REFERRAL_BONUS_FCFA;
        const { data: newBalance } = await supabase.rpc('credit_wallet', { p_user_id: userId, p_amount: referralBonus });

        await supabase.from('transactions').insert({
          id: uuidv4(), user_id: userId, type: 'BONUS_PARRAINAGE',
          amount_xcon: referralBonus, balance_after: newBalance || referralBonus,
          description: `Bonus de bienvenue parrainage après KYC vérifié`,
        });

        await supabase.from('referral_tracking').update({
          bonus_filleul_given: true,
        }).eq('id', tracking.id);
      }

      // Notification push
      const isEn = user.language === 'en';
      const notifMsg = isEn
        ? { title: '✅ Identity verified!', body: referralBonus > 0
            ? `Welcome ${user.pseudo}! ${referralBonus} FCFA bonus credited to your wallet.`
            : `Welcome ${user.pseudo}! Your identity has been verified.` }
        : { title: '✅ Identité vérifiée !', body: referralBonus > 0
            ? `Bienvenue ${user.pseudo} ! ${referralBonus} FCFA crédités sur votre wallet.`
            : `Bienvenue ${user.pseudo} ! Votre identité a été vérifiée.` };
      sendPushNotification(userId, notifMsg.title, notifMsg.body, { type: 'KYC_VERIFIED', bonus: referralBonus });

    } else if (status === 'DECLINED') {
      const newAttempts = (user.kyc_attempts || 0) + 1;
      const newStatus   = newAttempts >= KYC_MAX_ATTEMPTS ? 'SUPPORT' : 'FAILED';

      await supabase.from('users').update({
        kyc_status:   newStatus,
        kyc_attempts: newAttempts,
      }).eq('id', userId);

      const isEn        = user.language === 'en';
      const attemptsLeft = Math.max(0, KYC_MAX_ATTEMPTS - newAttempts);

      if (newStatus === 'SUPPORT') {
        const msg = isEn
          ? { title: '⚠️ Verification failed', body: 'Maximum attempts reached. Please contact support.' }
          : { title: '⚠️ Vérification échouée', body: 'Limite de tentatives atteinte. Contactez le support.' };
        sendPushNotification(userId, msg.title, msg.body, { type: 'KYC_MAX_ATTEMPTS' });
      } else {
        const msg = isEn
          ? { title: '❌ Verification failed', body: `Please try again. ${attemptsLeft} attempt(s) remaining.` }
          : { title: '❌ Vérification échouée', body: `Réessayez. ${attemptsLeft} tentative(s) restante(s).` };
        sendPushNotification(userId, msg.title, msg.body, { type: 'KYC_FAILED', attempts_left: attemptsLeft });
      }

    } else if (status === 'REVIEW') {
      await supabase.from('users').update({
        kyc_status:    'PENDING',
        kyc_didit_ref: session_id,
      }).eq('id', userId);
    }

  } catch (err) {
    console.error('[KYC] Webhook error:', err.message);
  }
});

// ── GET /kyc/result — polling post-session
router.get('/result', authMiddleware, async (req, res) => {
  try {
    const { data: user } = await supabase.from('users')
      .select('kyc_status, kyc_attempts, kyc_verified_at')
      .eq('id', req.user.id).single();
    res.json({
      kyc_status:      user.kyc_status,
      kyc_attempts:    user.kyc_attempts,
      kyc_verified_at: user.kyc_verified_at,
      attempts_left:   Math.max(0, KYC_MAX_ATTEMPTS - (user.kyc_attempts || 0)),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

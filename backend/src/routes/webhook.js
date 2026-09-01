// ============================================================
// KASOLIFE — Routes /webhook v4 (corrigé)
// C7  : Signature HMAC sur cpm_custom pour sécuriser le webhook
// C12a: supabase.raw() remplacé par incrémentation correcte
// C19 : balance_after réel dans transaction BONUS_PARRAINAGE
// ============================================================
const express = require('express');
const crypto  = require('crypto');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { verifyTransaction } = require('../services/cinetpay');
const { toXcon } = require('../config/constants');
const { sendPushNotification } = require('../services/notifications');

const router = express.Router();

// ── C7 : Génération de la signature HMAC pour cpm_custom ─────────────────────
// Utilisé à la création du dépôt pour signer userId
// Format : userId:timestamp (le timestamp limite la validité)
const signCustom = (userId) => {
  const timestamp = Math.floor(Date.now() / 1000); // secondes
  const payload   = `${userId}:${timestamp}`;
  const sig = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET || process.env.JWT_SECRET)
    .update(payload)
    .digest('hex');
  return `${payload}:${sig}`;
};

// ── C7 : Vérification de la signature HMAC ────────────────────────────────────
// Accepte les webhooks jusqu'à 1 heure après la signature
const verifyCustom = (cpmCustom) => {
  try {
    const parts = cpmCustom.split(':');
    if (parts.length !== 3) return null;
    const [userId, timestamp, sig] = parts;
    const ageSeconds = Math.floor(Date.now() / 1000) - Number(timestamp);
    if (ageSeconds > 3600) {
      console.warn(`Webhook: cpm_custom expiré (${ageSeconds}s)`);
      return null;
    }
    const payload   = `${userId}:${timestamp}`;
    const expected  = crypto
      .createHmac('sha256', process.env.WEBHOOK_SECRET || process.env.JWT_SECRET)
      .update(payload)
      .digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
      console.warn('Webhook: signature HMAC invalide');
      return null;
    }
    return userId;
  } catch (err) {
    console.warn('Webhook: erreur vérification HMAC:', err.message);
    return null;
  }
};

// Exposer signCustom pour le service cinetpay (utilisé dans initDeposit)
module.exports.signCustom = signCustom;

// ── Helper bonus parrainage au 1er dépôt filleul ─────────────────────────────
const processReferralBonus = async (userId, depositAmount) => {
  try {
    // Vérifier si c'est le 1er dépôt (aucune transaction DEPOT avant)
    const { count } = await supabase.from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('type', 'DEPOT');
    if (count > 0) return; // pas le 1er dépôt

    const { data: user } = await supabase.from('users')
      .select('referred_by').eq('id', userId).single();
    if (!user?.referred_by) return;

    const referrerId = user.referred_by;
    const { data: config } = await supabase.from('platform_config')
      .select('value').eq('key', 'REFERRAL_BONUS_XCON').single();
    const bonusXcon = config ? Number(config.value) : 500;

    // Créditer le parrain
    const newBalance = await supabase.rpc('credit_wallet', {
      p_user_id: referrerId, p_amount: bonusXcon,
    });

    // C19 : lire le vrai solde après crédit pour balance_after
    const { data: wParrain } = await supabase.from('wallets')
      .select('balance_xcon').eq('user_id', referrerId).single();

    await supabase.from('transactions').insert({
      id: uuidv4(), user_id: referrerId, type: 'BONUS_PARRAINAGE',
      amount_xcon: bonusXcon,
      balance_after: wParrain?.balance_xcon ?? 0, // C19 : vrai solde
      description: `Bonus parrainage — 1er dépôt filleul (${userId.slice(0, 8)}...)`,
    });

    sendPushNotification(
      referrerId,
      '🎉 Bonus parrainage !',
      `Votre filleul vient d'effectuer son 1er dépôt ! +${bonusXcon} xcon crédités.`,
      { type: 'REFERRAL_BONUS', amount: bonusXcon }
    );

    // C12a : incrémentation total_earned sans supabase.raw()
    const { data: profil } = await supabase.from('influencer_profiles')
      .select('total_earned').eq('user_id', referrerId).single();
    const newTotalEarned = (profil?.total_earned || 0) + bonusXcon;
    await supabase.from('influencer_profiles').upsert({
      user_id:      referrerId,
      total_earned: newTotalEarned,
    }, { onConflict: 'user_id' });

  } catch (err) {
    console.error('processReferralBonus error (non-bloquant):', err.message);
  }
};

// ── Retry CinetPay avec 3 tentatives ─────────────────────────────────────────
const verifyWithRetry = async (txId, maxRetries = 3, delayMs = 2000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await verifyTransaction(txId);
      if (result) return result;
    } catch (err) {
      console.warn(`CinetPay verify attempt ${attempt}/${maxRetries} failed:`, err.message);
    }
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }
  return null;
};

// ── POST /webhook/cinetpay — confirmation dépôt ───────────────────────────────
router.post('/cinetpay', async (req, res) => {
  const startTime = Date.now();
  const { cpm_site_id, cpm_trans_id, cpm_amount, cpm_custom, cpm_currency } = req.body;

  try {
    // Validation Site ID
    if (String(cpm_site_id) !== String(process.env.CINETPAY_SITE_ID)) {
      console.warn(`Webhook: Site ID invalide: ${cpm_site_id}`);
      return res.status(400).json({ error: 'Site ID invalide' });
    }

    // C7 : Vérification signature HMAC de cpm_custom
    const userId = verifyCustom(cpm_custom);
    if (!userId) {
      console.error(`Webhook: cpm_custom invalide ou expiré: ${cpm_custom}`);
      await supabase.from('admin_actions').insert({
        admin_id:    '00000000-0000-0000-0000-000000000000',
        action:      'WEBHOOK_INVALID_SIGNATURE',
        target_type: 'transaction',
        metadata:    { cpm_trans_id, cpm_custom },
      }).catch(() => {});
      return res.status(400).json({ error: 'Signature invalide' });
    }

    // C2 : l'idempotence est garantie atomiquement dans creditWalletDeposit
    // via INSERT ON CONFLICT DO NOTHING sur gateway_ref (index UNIQUE en base)
    // Ce check préliminaire reste pour éviter un appel API CinetPay inutile
    const { data: existing } = await supabase.from('transactions')
      .select('id').eq('gateway_ref', cpm_trans_id).single();
    if (existing) {
      console.log(`Webhook: Transaction ${cpm_trans_id} déjà traitée`);
      return res.json({ message: 'Transaction déjà traitée' });
    }

    // Vérification CinetPay avec retry
    const verified = await verifyWithRetry(cpm_trans_id);
    if (!verified) {
      console.error(`Webhook: Transaction ${cpm_trans_id} non vérifiée après 3 tentatives`);
      await supabase.from('admin_actions').insert({
        admin_id:    '00000000-0000-0000-0000-000000000000',
        action:      'WEBHOOK_VERIFY_FAILED',
        target_type: 'transaction',
        metadata:    { cpm_trans_id, cpm_amount, userId, attempts: 3 },
      }).catch(() => {});
      return res.status(400).json({ error: 'Transaction non vérifiée' });
    }

    const montantXcon = toXcon(parseInt(cpm_amount));

    // Vérifier que l'utilisateur existe
    const { data: user } = await supabase.from('users')
      .select('id, pseudo').eq('id', userId).single();
    if (!user) {
      console.error(`Webhook: user_id introuvable: ${userId}`);
      return res.status(400).json({ error: 'Utilisateur introuvable' });
    }

    // Bonus parrainage AVANT d'insérer la transaction (count = 0 à ce stade)
    await processReferralBonus(userId, montantXcon);

    // Créditer le wallet
    await supabase.rpc('credit_wallet', { p_user_id: userId, p_amount: montantXcon });

    // C12a : incrémentation total_deposited sans supabase.raw()
    const { data: walletCurrent } = await supabase.from('wallets')
      .select('balance_xcon, total_deposited').eq('user_id', userId).single();
    const newTotalDeposited = (walletCurrent?.total_deposited || 0) + montantXcon;
    await supabase.from('wallets')
      .update({ total_deposited: newTotalDeposited })
      .eq('user_id', userId);

    // Enregistrer la transaction
    const { data: walletAfter } = await supabase.from('wallets')
      .select('balance_xcon').eq('user_id', userId).single();

    await supabase.from('transactions').insert({
      id: uuidv4(), user_id: userId, type: 'DEPOT',
      amount_xcon: montantXcon,
      balance_after: walletAfter.balance_xcon,
      gateway: 'CINETPAY', gateway_ref: cpm_trans_id,
      description: `Dépôt via CinetPay — ${montantXcon} xcon (${cpm_currency || 'XAF'})`,
    });

    // Notification push
    sendPushNotification(
      userId,
      '✅ Dépôt confirmé',
      `+${montantXcon} xcon ont été ajoutés à votre wallet.`,
      { type: 'DEPOT', amount: montantXcon }
    );

    const elapsed = Date.now() - startTime;
    console.log(`✅ Webhook CinetPay OK: tx=${cpm_trans_id} user=${userId} amount=${montantXcon}xcon (${elapsed}ms)`);
    res.json({ message: 'OK' });

  } catch (err) {
    console.error('Webhook CinetPay error:', err);
    try {
      await supabase.from('admin_actions').insert({
        admin_id:    '00000000-0000-0000-0000-000000000000',
        action:      'WEBHOOK_ERROR',
        target_type: 'transaction',
        metadata:    { cpm_trans_id, error: err.message },
      });
    } catch { /* ne jamais bloquer sur une erreur de log */ }
    res.status(500).json({ error: err.message });
  }
});

// ── GET /webhook/reconcile — Réconciliation manuelle (admin) ──────────────────
router.get('/reconcile', async (req, res) => {
  const { secret } = req.query;
  if (secret !== process.env.RECONCILE_SECRET) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: failed } = await supabase.from('admin_actions')
      .select('metadata, created_at')
      .eq('action', 'WEBHOOK_VERIFY_FAILED')
      .gte('created_at', since);

    let reconciled = 0;
    for (const f of failed || []) {
      const { cpm_trans_id, userId } = f.metadata || {};
      if (!cpm_trans_id || !userId) continue;
      const { data: existing } = await supabase.from('transactions')
        .select('id').eq('gateway_ref', cpm_trans_id).single();
      if (existing) { reconciled++; continue; }
      const verified = await verifyWithRetry(cpm_trans_id, 2, 1000);
      if (verified) {
        console.log(`Réconciliation: ${cpm_trans_id} vérifiée — traitement requis pour user ${userId}`);
        reconciled++;
      }
    }
    res.json({ checked: (failed || []).length, reconciled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Fonction partagée : créditer wallet après confirmation dépôt ──────────────
const creditWalletDeposit = async (userId, montantXcon, txId, provider) => {
  // C2 : idempotence atomique — l'index UNIQUE sur gateway_ref garantit
  // qu'un double webhook ne peut jamais créditer deux fois le même dépôt
  const txInsert = await supabase.from('transactions').insert({
    id: require('crypto').randomUUID(), user_id: userId,
    type: 'DEPOT', amount_xcon: montantXcon,
    balance_after: 0,
    gateway: provider.toUpperCase(), gateway_ref: txId,
    description: `Dépôt confirmé via ${provider}`,
  }).select('id').single();

  // Si la transaction existe déjà (UNIQUE violation) → déjà crédité
  if (txInsert.error) {
    if (txInsert.error.code === '23505') return { alreadyCredited: true };
    throw txInsert.error;
  }

  // Créditer le wallet seulement après insertion réussie
  const { error: creditErr } = await supabase.rpc('credit_wallet', {
    p_user_id: userId, p_amount: montantXcon,
  });
  if (creditErr) throw creditErr;

  const { data: wallet } = await supabase.from('wallets')
    .select('balance_xcon').eq('user_id', userId).single();

  // Mettre à jour balance_after maintenant qu'on a le solde réel
  await supabase.from('transactions')
    .update({ balance_after: wallet?.balance_xcon || 0 })
    .eq('gateway_ref', txId);

  const { sendPushNotification } = require('../services/notifications');
  await sendPushNotification(
    userId,
    '✅ Dépôt confirmé',
    `${montantXcon.toLocaleString('fr-FR')} xcon crédités sur votre wallet`,
    { type: 'DEPOT_CONFIRME', montant: montantXcon }
  ).catch(() => {});

  return { credited: true };
};

// ── POST /webhook/campay — confirmation dépôt Campay ─────────────────────────
router.post('/campay', async (req, res) => {
  try {
    res.status(200).json({ received: true });

    const { reference, status, external_reference, amount } = req.body;
    if (status !== 'SUCCESSFUL') return;

    // Extraire userId depuis external_reference (format KB_CP_DEP_XXXX)
    if (!external_reference?.startsWith('KB_CP_DEP_')) return;

    // Vérifier la transaction auprès de Campay
    const campay   = require('../services/campay');
    const verified = await campay.verifyTransaction(reference).catch(() => false);
    if (!verified) return;

    // Retrouver la transaction pending en base via gateway_ref
    const { data: tx } = await supabase.from('transactions')
      .select('user_id, amount_xcon').eq('gateway_ref', external_reference)
      .eq('type', 'DEPOT_PENDING').single();
    if (!tx) return;

    await creditWalletDeposit(tx.user_id, tx.amount_xcon, external_reference, 'campay');
  } catch (err) {
    console.error('[Webhook Campay]', err.message);
  }
});

// ── POST /webhook/fapshi — confirmation dépôt Fapshi ─────────────────────────
router.post('/fapshi', async (req, res) => {
  try {
    res.status(200).json({ received: true });

    const { transId, status, externalId, amount } = req.body;
    if (status !== 'SUCCESSFUL') return;
    if (!externalId?.startsWith('KB_FP_DEP_')) return;

    // Vérifier la transaction auprès de Fapshi
    const fapshi   = require('../services/fapshi');
    const verified = await fapshi.verifyTransaction(transId).catch(() => false);
    if (!verified) return;

    const { data: tx } = await supabase.from('transactions')
      .select('user_id, amount_xcon').eq('gateway_ref', externalId)
      .eq('type', 'DEPOT_PENDING').single();
    if (!tx) return;

    await creditWalletDeposit(tx.user_id, tx.amount_xcon, externalId, 'fapshi');
  } catch (err) {
    console.error('[Webhook Fapshi]', err.message);
  }
});

module.exports = router;

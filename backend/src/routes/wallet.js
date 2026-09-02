// ============================================================
// KASOLIFE — Routes /wallet v1.0
// Adapté depuis KasoLife — jton/paris retirés
// Dépôt/retrait du wallet via Mobile Money (Campay/Fapshi/CinetPay)
// ============================================================
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authMiddleware, requireKYC, requireNotWalletFrozen } = require('../middleware/auth');
const { initDeposit, initPayout } = require('../services/payment');
const { encrypt, decrypt, encryptDeterministic } = require('../services/encryption');
const rateLimit = require('express-rate-limit');
const { sendSMS } = require('../services/sms');
const {
  WITHDRAWAL_COMMISSION_RATE,
  MIN_WALLET_BALANCE_XCON,
  KYC_LIMITS,
  RETRAIT_MAX_DAY_XCON,
  MOBILE_MONEY_MAX_PER_OPERATOR,
  MOBILE_MONEY_MAX_TOTAL,
  isValidE164,
} = require('../config/constants');

const mmRateLimit = rateLimit({ windowMs: 3600000, max: 10, message: { error: 'Trop de requêtes — réessayez dans 1 heure' } });
const depositLimit  = rateLimit({ windowMs: 3600000, max: 20, message: { error: 'Trop de tentatives de dépôt' } });
const withdrawLimit = rateLimit({ windowMs: 3600000, max: 10, message: { error: 'Trop de tentatives de retrait' } });

const router = express.Router();

const XCON_CREDIT_TYPES = ['DEPOT', 'REMBOURSEMENT', 'BONUS_PARRAINAGE'];
const XCON_DEBIT_TYPES = ['RETRAIT'];

// ── Helper config ─────────────────────────────────────────────────────────────
const getConfig = async (key, def) => {
  const { data } = await supabase.from('platform_config').select('value').eq('key', key).single();
  return data ? Number(data.value) : def;
};

// ── Helper : limites KYC unique (PENDING / VERIFIED) ─────────────────────────
const getKycLimits = async (kycStatus) => {
  const status   = kycStatus === 'VERIFIED' ? 'VERIFIED' : 'PENDING';
  const fallback = KYC_LIMITS[status] || KYC_LIMITS['PENDING'];
  const depot_max   = await getConfig(`KYC_${status}_DEPOT_MAX_MONTH`,   fallback.depot_max_month);
  const retrait_max = await getConfig(`KYC_${status}_RETRAIT_MAX_MONTH`, fallback.retrait_max_month);
  return { depot_max, retrait_max };
};

// ── Helper : cumul mensuel ────────────────────────────────────────────────────
const getMonthlyCumul = async (userId, type) => {
  const since = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { data } = await supabase.from('transactions')
    .select('amount_xcon').eq('user_id', userId).eq('type', type).gte('created_at', since);
  return (data || []).reduce((s, t) => s + t.amount_xcon, 0);
};

// ── Helper : cumul journalier retraits ────────────────────────────────────────
const getDailyCumul = async (userId) => {
  const since = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const { data } = await supabase.from('transactions')
    .select('amount_xcon').eq('user_id', userId).eq('type', 'RETRAIT').gte('created_at', since);
  return (data || []).reduce((s, t) => s + t.amount_xcon, 0);
};


// ── GET /wallet ───────────────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.from('wallets')
      .select('balance_xcon, pending_balance_xcon, total_deposited, total_withdrawn, total_earned')
      .eq('user_id', req.user.id).single();
    if (error) throw error;

    const { data: user } = await supabase.from('users')
      .select('kyc_status').eq('id', req.user.id).single();
    const limits       = await getKycLimits(user?.kyc_status);
    const depotMois    = await getMonthlyCumul(req.user.id, 'DEPOT');
    const retraitMois  = await getMonthlyCumul(req.user.id, 'RETRAIT');

    res.json({
      balance_xcon:         data.balance_xcon         ?? 0,
      pending_balance_xcon: data.pending_balance_xcon ?? 0,
      total_deposited:      data.total_deposited      ?? 0,
      total_withdrawn:      data.total_withdrawn      ?? 0,
      total_earned:         data.total_earned         ?? 0,
      kyc: {
        status:              user?.kyc_status || 'PENDING',
        depot_max_month:     limits.depot_max,
        retrait_max_month:   limits.retrait_max,
        depot_cumul_month:   depotMois,
        retrait_cumul_month: retraitMois,
        depot_restant:   limits.depot_max   === 0 ? null : Math.max(0, limits.depot_max   - depotMois),
        retrait_restant: limits.retrait_max === 0 ? null : Math.max(0, limits.retrait_max - retraitMois),
      },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ── POST /wallet/deposit ──────────────────────────────────────────────────────
router.post('/deposit', depositLimit, authMiddleware, requireKYC, requireNotWalletFrozen, async (req, res) => {
  try {
    const { montant_xcon, return_url } = req.body;
    const MIN_DEP = await getConfig('MIN_DEPOSIT_XCON', 2000);
    if (!montant_xcon || montant_xcon < MIN_DEP)
      return res.status(400).json({ error: `Montant minimum: ${MIN_DEP} xcon` });

    const { data: user } = await supabase.from('users')
      .select('kyc_status').eq('id', req.user.id).single();
    const limits = await getKycLimits(user?.kyc_status);

    // Vérification + réservation atomique du plafond (verrou DB, ferme la
    // course entre deux dépôts simultanés — voir migration 008)
    const { data: reservationId, error: kycErr } = await supabase.rpc('reserve_kyc_cumul', {
      p_user_id: req.user.id, p_type: 'DEPOT', p_pending_type: 'DEPOT_PENDING',
      p_amount: montant_xcon, p_max_month: limits.depot_max,
    });
    if (kycErr) {
      if (kycErr.message?.includes('KYC_LIMIT_EXCEEDED')) {
        return res.status(400).json({
          error: `Plafond dépôt mensuel atteint (${limits.depot_max} xcon). Complétez votre KYC pour des limites plus élevées.`,
          kyc_upgrade_required: true,
        });
      }
      throw kycErr;
    }

    // Point 3 : utiliser user_mobile_money (table officielle), mobile_money_id requis
    const { mobile_money_id: deposit_mm_id } = req.body;
    if (!deposit_mm_id)
      return res.status(400).json({ error: 'Sélectionnez un numéro Mobile Money depuis votre profil' });
    const { data: mmDep } = await supabase.from('user_mobile_money')
      .select('phone, operator, is_verified').eq('id', deposit_mm_id).eq('user_id', req.user.id).single();
    if (!mmDep) return res.status(404).json({ error: 'Numéro Mobile Money introuvable' });
    if (!mmDep.is_verified) return res.status(403).json({ error: 'Ce numéro n\'est pas encore vérifié' });
    let phone; try { phone = decrypt(mmDep.phone); } catch { phone = mmDep.phone; }
    const operator = mmDep.operator;

    // La ligne DEPOT_PENDING existe déjà (créée atomiquement par reserve_kyc_cumul
    // ci-dessus) — on la complète avec la référence agrégateur.
    const pendingTxId = reservationId;

    const result = await initDeposit(req.user.id, montant_xcon, phone, operator);

    // Mettre à jour le pending avec le vrai gateway_ref retourné par l'agrégateur
    if (result.txId) {
      await supabase.from('transactions')
        .update({ gateway_ref: result.txId, gateway: result.provider?.toUpperCase() || 'UNKNOWN' })
        .eq('id', pendingTxId);
    }

    res.json({
      txId: result.txId, paymentUrl: result.paymentUrl, montant_xcon,
      message: `Rediriger vers paymentUrl pour payer ${montant_xcon} xcon`,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ── POST /wallet/withdraw ─────────────────────────────────────────────────────
router.post('/withdraw', withdrawLimit, authMiddleware, requireKYC, requireNotWalletFrozen, async (req, res) => {
  try {
    const { montant_xcon, mobile_money_id } = req.body;
    const userId = req.user.id;

    if (!montant_xcon || montant_xcon < 500)
      return res.status(400).json({ error: 'Montant minimum: 500 xcon' });

    // Point 2 : mobile_money_id obligatoire — plus de texte libre
    if (!mobile_money_id)
      return res.status(400).json({ error: 'Sélectionnez un numéro Mobile Money depuis votre profil' });
    const { data: mm } = await supabase.from('user_mobile_money')
      .select('phone, operator, is_verified').eq('id', mobile_money_id).eq('user_id', userId).single();
    if (!mm) return res.status(404).json({ error: 'Numéro Mobile Money introuvable' });
    if (!mm.is_verified) return res.status(403).json({ error: 'Ce numéro n\'est pas encore vérifié' });
    let targetPhone; try { targetPhone = decrypt(mm.phone); } catch { targetPhone = mm.phone; }
    const targetOperator = mm.operator;

    // Limites KYC
    const { data: userKyc } = await supabase.from('users')
      .select('kyc_status').eq('id', userId).single();
    const limits = await getKycLimits(userKyc?.kyc_status);

    // Vérification + réservation atomique du plafond (verrou DB — migration 008)
    const { data: kycReservationId, error: kycErr } = await supabase.rpc('reserve_kyc_cumul', {
      p_user_id: userId, p_type: 'RETRAIT', p_pending_type: 'RETRAIT_PENDING',
      p_amount: montant_xcon, p_max_month: limits.retrait_max,
    });
    if (kycErr) {
      if (kycErr.message?.includes('KYC_LIMIT_EXCEEDED')) {
        return res.status(400).json({
          error: `Plafond retrait mensuel atteint (${limits.retrait_max} xcon). Complétez votre KYC pour des limites plus élevées.`,
          kyc_upgrade_required: true,
        });
      }
      throw kycErr;
    }
    // Annule la réservation si une étape suivante échoue avant la confirmation
    const releaseReservation = () => supabase.from('transactions').delete().eq('id', kycReservationId).then(() => {}, () => {});

    // Limite journalière
    const retraitMaxDay     = await getConfig('RETRAIT_MAX_DAY_XCON', RETRAIT_MAX_DAY_XCON);
    const retraitAujourdHui = await getDailyCumul(userId);
    if (retraitAujourdHui + montant_xcon > retraitMaxDay) {
      return res.status(400).json({
        error: `Plafond retrait journalier atteint. Plafond : ${retraitMaxDay} xcon. Déjà retiré : ${retraitAujourdHui} xcon.`,
      });
    }

    // Vérification délai 24h après changement de numéro Mobile Money
    const { data: userInfo } = await supabase.from('users')
      .select('phone_changed_at').eq('id', userId).single();
    if (userInfo?.phone_changed_at) {
      const hoursSinceChange = (Date.now() - new Date(userInfo.phone_changed_at).getTime()) / 3600000;
      if (hoursSinceChange < 24) {
        const remainingH = Math.ceil(24 - hoursSinceChange);
        return res.status(400).json({
          error: `Retraits bloqués ${remainingH}h après changement de numéro Mobile Money. Mesure de sécurité. Les dépôts restent disponibles.`,
          code: 'PHONE_CHANGE_DELAY',
          remaining_hours: remainingH,
        });
      }
    }

    const requiresManualValidation = false;
    const commission    = Math.round(montant_xcon * WITHDRAWAL_COMMISSION_RATE);
    const montant_verse = montant_xcon - commission;

    // Vérification solde
    // M10-Sc02 : la race condition sur retraits simultanés est protégée côté SQL
    // par SELECT FOR UPDATE dans debit_wallet — si deux retraits simultanés passent
    // les checks JS, le second échouera avec "Solde insuffisant" dans la fonction SQL atomique
    const { data: wallet } = await supabase.from('wallets')
      .select('balance_xcon, total_withdrawn').eq('user_id', userId).single();
    if (!wallet || wallet.balance_xcon < montant_xcon)
      return res.status(400).json({ error: 'Solde xcon insuffisant' });
    if (wallet.balance_xcon - montant_xcon < MIN_WALLET_BALANCE_XCON)
      return res.status(400).json({
        error: `Vous devez conserver au moins ${MIN_WALLET_BALANCE_XCON} xcon dans votre wallet`,
      });

    // Point 14 : vérification circulaire supprimée (trop coûteuse à chaque retrait)
    // Remplacée par un audit batch nocturne dans les jobs — le solde wallet est source de vérité via debit_wallet atomique

    if (requiresManualValidation) {
      return res.json({
        status:              'PENDING_VALIDATION',
        message:             `Retrait de ${montant_xcon} xcon en attente de validation administrateur`,
        commission_xcon:     commission,
        montant_verse_xcon:  montant_verse,
      });
    }

    // Récupérer le provider préféré du user si SUPERADMIN
    const preferredProvider = ['super_admin', 'root_admin'].includes(req.user?.role)
      ? (req.body.preferred_provider || null) : null;

    let payoutResult;
    try {
      payoutResult = await initPayout(targetPhone, montant_verse, targetOperator, userId, preferredProvider);
    } catch (payoutErr) {
      await releaseReservation();
      return res.status(502).json({
        error: `Passerelle de paiement indisponible. Votre solde n'a pas été modifié. Réessayez dans quelques minutes.`,
      });
    }

    // Débit wallet seulement si CinetPay a accepté
    const { error: debitErr } = await supabase.rpc('debit_wallet', {
      p_user_id: userId, p_amount: montant_xcon,
    });
    if (debitErr) {
      await releaseReservation();
      return res.status(400).json({ error: debitErr.message });
    }

    await supabase.from('platform_revenue').insert({
      source_type: 'COMMISSION_RETRAIT', amount_xcon: commission, user_id: userId,
    });

    const { data: walletAfter } = await supabase.from('wallets')
      .select('balance_xcon, total_withdrawn').eq('user_id', userId).single();

    // C12b : incrémentation total_withdrawn sans supabase.raw()
    // Point 11 : incrémentation atomique total_withdrawn
    await supabase.rpc('increment_total_withdrawn', { p_user_id: userId, p_amount: montant_xcon });

    // Convertit la réservation KYC (RETRAIT_PENDING) en transaction finale —
    // garde le même id pour que le plafond mensuel continue à la compter.
    await supabase.from('transactions')
      .update({
        type: 'RETRAIT',
        balance_after: walletAfter.balance_xcon,
        gateway:     (payoutResult.provider || 'cinetpay').toUpperCase(),
        gateway_ref: payoutResult.txId,
        description: `Retrait ${targetOperator} ${targetPhone}`,
      })
      .eq('id', kycReservationId);

    await supabase.from('transactions').insert({
      id: uuidv4(), user_id: userId, type: 'COMMISSION_RETRAIT',
      amount_xcon: commission,
      balance_after: walletAfter.balance_xcon,
    });

    res.json({
      success:            true,
      montant_xcon,
      commission_xcon:    commission,
      montant_verse_xcon: montant_verse,
      txId:               payoutResult.txId,
      message:            `${montant_verse} xcon envoyés vers ${targetOperator} ${targetPhone}`,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ── GET /wallet/history ───────────────────────────────────────────────────────
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const { limit = 30, offset = 0 } = req.query;
    const safeLmt = Math.min(Number(limit), 100); // M2 : cap pagination
    const { data } = await supabase.from('transactions')
      .select('*').eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + safeLmt - 1);
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ════════════════════════════════════════════════════════════════════════════════
// MOBILE MONEY MULTIPLES
// ════════════════════════════════════════════════════════════════════════════════

// ── GET /wallet/mobile-money ──────────────────────────────────────────────────
router.get('/mobile-money', mmRateLimit, authMiddleware, async (req, res) => {
  try {
    const { data } = await supabase.from('user_mobile_money')
      .select('id, operator, phone, is_default, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    const { data: account } = await supabase.from('users').select('phone').eq('id', req.user.id).single();

    const result = (data || []).map(mm => {
      let displayPhone = '****';
      let isLogin = false;
      try {
        const raw = decrypt(mm.phone);
        displayPhone = raw.slice(0, -4).replace(/./g, '*') + raw.slice(-4);
        isLogin = account?.phone === encryptDeterministic(raw);
      } catch {}
      const { phone, ...rest } = mm;
      return { ...rest, phone_masked: displayPhone, is_login: isLogin };
    });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /wallet/mobile-money/request-otp — étape 1 : envoyer OTP (Point 1) ──
router.post('/mobile-money/request-otp', mmRateLimit, authMiddleware, async (req, res) => {
  try {
    const { phone, operator } = req.body;
    if (!phone || !operator) return res.status(400).json({ error: 'phone et operator requis' });
    if (!isValidE164(phone)) return res.status(400).json({ error: 'Format de numéro invalide (ex: +237690000000)' });

    const opUpper = operator.toUpperCase();

    // Point 4 : limite par opérateur
    const { count: opCount } = await supabase.from('user_mobile_money')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id).eq('operator', opUpper);
    if (opCount >= MOBILE_MONEY_MAX_PER_OPERATOR)
      return res.status(400).json({ error: `Maximum ${MOBILE_MONEY_MAX_PER_OPERATOR} numéros ${opUpper} atteint` });

    // Point 12 : limite globale
    const { count: totalCount } = await supabase.from('user_mobile_money')
      .select('id', { count: 'exact', head: true }).eq('user_id', req.user.id);
    if (totalCount >= MOBILE_MONEY_MAX_TOTAL)
      return res.status(400).json({ error: `Maximum ${MOBILE_MONEY_MAX_TOTAL} numéros Mobile Money au total` });

    // Point 4 : unicité globale — un numéro ne peut appartenir qu'à un seul compte
    const encPhone = encrypt(phone);
    const { data: existing } = await supabase.from('user_mobile_money')
      .select('id').eq('phone', encPhone).neq('user_id', req.user.id).single();
    if (existing) return res.status(409).json({ error: 'Ce numéro est déjà associé à un autre compte' });

    // Générer et stocker OTP temporaire
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabase.from('phone_verification_tokens')
      .update({ used: true }).eq('phone', phone).eq('used', false);
    await supabase.from('phone_verification_tokens').insert({ phone, token: otp, expires_at });
    await sendSMS(phone, `KASOLIFE - Code vérification Mobile Money : ${otp}. Valable 10 minutes.`);
    res.json({ message: 'Code envoyé sur le numéro à enregistrer' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /wallet/mobile-money — étape 2 : vérifier OTP + enregistrer (Point 1) ──
router.post('/mobile-money', mmRateLimit, authMiddleware, async (req, res) => {
  try {
    const { phone, operator, otp } = req.body;
    if (!phone || !operator || !otp)
      return res.status(400).json({ error: 'phone, operator et otp requis' });
    if (!isValidE164(phone)) return res.status(400).json({ error: 'Format de numéro invalide' });

    // Vérifier OTP
    const { data: tokenRow } = await supabase.from('phone_verification_tokens')
      .select('*').eq('phone', phone).eq('token', otp).eq('used', false)
      .gt('expires_at', new Date().toISOString()).single();
    if (!tokenRow) return res.status(400).json({ error: 'Code invalide ou expiré' });
    await supabase.from('phone_verification_tokens').update({ used: true }).eq('id', tokenRow.id);

    const opUpper = operator.toUpperCase();
    const encryptedPhone = encrypt(phone);

    // Vérifications limites (double-check après OTP)
    const { count: opCount } = await supabase.from('user_mobile_money')
      .select('id', { count: 'exact', head: true }).eq('user_id', req.user.id).eq('operator', opUpper);
    if (opCount >= MOBILE_MONEY_MAX_PER_OPERATOR)
      return res.status(400).json({ error: `Maximum ${MOBILE_MONEY_MAX_PER_OPERATOR} numéros ${opUpper} atteint` });

    const { count: totalCount } = await supabase.from('user_mobile_money')
      .select('id', { count: 'exact', head: true }).eq('user_id', req.user.id);
    if (totalCount >= MOBILE_MONEY_MAX_TOTAL)
      return res.status(400).json({ error: `Maximum ${MOBILE_MONEY_MAX_TOTAL} numéros au total` });

    // Point 4 : unicité globale
    const { data: globalExist } = await supabase.from('user_mobile_money')
      .select('id').eq('phone', encryptedPhone).neq('user_id', req.user.id).single();
    if (globalExist) return res.status(409).json({ error: 'Ce numéro est déjà associé à un autre compte' });

    const isDefault = opCount === 0;
    const { data, error } = await supabase.from('user_mobile_money').insert({
      user_id: req.user.id, operator: opUpper,
      phone: encryptedPhone, is_default: isDefault, is_verified: true,
    }).select('id, operator, is_default, is_verified, created_at').single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Ce numéro est déjà enregistré' });
      throw error;
    }

    // Point 10 : délai 24h sur les retraits après ajout nouveau numéro
    await supabase.from('users').update({ phone_changed_at: new Date().toISOString() }).eq('id', req.user.id);

    // Point 18 : notification sécurité
    const raw = phone.slice(-4);
    await sendSMS(phone, `KASOLIFE — Numéro ****${raw} ajouté à votre compte. Si ce n'est pas vous, contactez le support immédiatement.`);

    res.status(201).json({ ...data, message: 'Numéro Mobile Money vérifié et ajouté' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /wallet/mobile-money/:id/default ─────────────────────────────────────
router.put('/mobile-money/:id/default', mmRateLimit, authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: mm } = await supabase.from('user_mobile_money')
      .select('operator').eq('id', id).eq('user_id', req.user.id).single();
    if (!mm) return res.status(404).json({ error: 'Numéro introuvable' });

    await supabase.from('user_mobile_money')
      .update({ is_default: false })
      .eq('user_id', req.user.id).eq('operator', mm.operator);

    await supabase.from('user_mobile_money')
      .update({ is_default: true }).eq('id', id);

    res.json({ message: 'Numéro défini comme défaut' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /wallet/mobile-money/:id ──────────────────────────────────────────
// C20 : si le numéro supprimé était le défaut, promouvoir le suivant automatiquement
router.delete('/mobile-money/:id', mmRateLimit, authMiddleware, async (req, res) => {
  try {
    // Récupérer les infos du numéro avant suppression
    const { data: mm } = await supabase.from('user_mobile_money')
      .select('id, operator, phone, is_default')
      .eq('id', req.params.id).eq('user_id', req.user.id).single();
    if (!mm) return res.status(404).json({ error: 'Numéro introuvable' });

    // Interdiction de supprimer le numéro utilisé pour se connecter au compte
    const { data: account } = await supabase.from('users').select('phone').eq('id', req.user.id).single();
    let mmPhonePlain; try { mmPhonePlain = decrypt(mm.phone); } catch { mmPhonePlain = null; }
    if (mmPhonePlain && account?.phone === encryptDeterministic(mmPhonePlain)) {
      return res.status(400).json({ error: 'Impossible de supprimer le numéro utilisé pour se connecter à votre compte' });
    }

    const { error } = await supabase.from('user_mobile_money')
      .delete().eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) throw error;

    // C20 : si c'était le numéro défaut, promouvoir le suivant du même opérateur
    if (mm.is_default) {
      const { data: remaining } = await supabase.from('user_mobile_money')
        .select('id')
        .eq('user_id', req.user.id)
        .eq('operator', mm.operator)
        .order('created_at', { ascending: true })
        .limit(1);

      if (remaining && remaining.length > 0) {
        await supabase.from('user_mobile_money')
          .update({ is_default: true })
          .eq('id', remaining[0].id);
      }
    }

    // Point 18 : notification sécurité suppression
    try {
      let rawPhone; try { rawPhone = decrypt(mm.phone); } catch { rawPhone = null; }
      if (rawPhone) await sendSMS(rawPhone, `KASOLIFE — Numéro ****${rawPhone.slice(-4)} supprimé de votre compte. Si ce n'est pas vous, contactez le support.`);
    } catch {}

    res.json({ message: 'Numéro supprimé' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

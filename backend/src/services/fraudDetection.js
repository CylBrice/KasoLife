// ============================================================
// KASOLIFE — Service de détection de fraude v1.0
// Heuristiques basées sur des règles (pas d'appel IA — plus fiable et
// moins coûteux pour la détection de patterns transactionnels).
// Exécuté périodiquement via cron (voir index.js).
//
// Toggle : AI_FRAUD_DETECTION_ENABLED (platform_config)
// ============================================================
'use strict';
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { getAIConfig } = require('./aiModeration');

// Seuils de détection
const RAPID_DEPOSIT_WITHDRAW_WINDOW_HOURS = 2;   // dépôt suivi d'un retrait < 2h
const RAPID_DEPOSIT_WITHDRAW_MIN_AMOUNT   = 5000; // FCFA — ignore les petits montants
const REFERRAL_ABUSE_MIN_REFERRALS_PER_DAY = 5;   // >5 filleuls/jour par un même parrain

/** Évite de recréer un flag identique pour le même utilisateur dans une fenêtre récente */
async function flagExists(userId, flagType, sinceHours = 24) {
  const since = new Date(Date.now() - sinceHours * 3600000).toISOString();
  const { data } = await supabase.from('fraud_flags')
    .select('id').eq('user_id', userId).eq('flag_type', flagType)
    .gte('created_at', since).limit(1);
  return (data || []).length > 0;
}

async function createFlag(userId, flagType, severity, details) {
  if (await flagExists(userId, flagType)) return;
  await supabase.from('fraud_flags').insert({
    id: uuidv4(), user_id: userId, flag_type: flagType, severity, details,
  });
}

// ── 1. Dépôt suivi d'un retrait rapide (pattern de blanchiment / abus bonus) ─
async function detectRapidDepositWithdraw() {
  const since = new Date(Date.now() - 24 * 3600000).toISOString();

  const { data: deposits } = await supabase.from('transactions')
    .select('id, user_id, amount_xcon, created_at')
    .eq('type', 'DEPOT')
    .gte('amount_xcon', RAPID_DEPOSIT_WITHDRAW_MIN_AMOUNT)
    .gte('created_at', since);

  for (const deposit of deposits || []) {
    const windowEnd = new Date(new Date(deposit.created_at).getTime() + RAPID_DEPOSIT_WITHDRAW_WINDOW_HOURS * 3600000).toISOString();

    const { data: withdrawals } = await supabase.from('transactions')
      .select('id, amount_xcon, created_at')
      .eq('user_id', deposit.user_id)
      .eq('type', 'RETRAIT')
      .gt('created_at', deposit.created_at)
      .lte('created_at', windowEnd)
      .limit(1);

    if ((withdrawals || []).length > 0) {
      await createFlag(deposit.user_id, 'RAPID_DEPOSIT_WITHDRAW', 'MEDIUM', {
        deposit_id: deposit.id,
        deposit_amount: deposit.amount_xcon,
        withdrawal_id: withdrawals[0].id,
        withdrawal_amount: Math.abs(withdrawals[0].amount_xcon),
        gap_minutes: Math.round((new Date(withdrawals[0].created_at) - new Date(deposit.created_at)) / 60000),
      });
    }
  }
}

// ── 2. Abus du programme de parrainage (volume anormal de filleuls) ──────────
async function detectReferralAbuse() {
  const since = new Date(Date.now() - 24 * 3600000).toISOString();

  const { data: referrals } = await supabase.from('referral_tracking')
    .select('parrain_id, created_at')
    .gte('created_at', since);

  const countByParrain = {};
  for (const r of referrals || []) {
    countByParrain[r.parrain_id] = (countByParrain[r.parrain_id] || 0) + 1;
  }

  for (const [parrainId, count] of Object.entries(countByParrain)) {
    if (count >= REFERRAL_ABUSE_MIN_REFERRALS_PER_DAY) {
      await createFlag(parrainId, 'REFERRAL_ABUSE', count >= REFERRAL_ABUSE_MIN_REFERRALS_PER_DAY * 2 ? 'HIGH' : 'MEDIUM', {
        referrals_last_24h: count,
        threshold: REFERRAL_ABUSE_MIN_REFERRALS_PER_DAY,
      });
    }
  }
}

// ── 3. Comptes liés — même numéro Mobile Money utilisé sur plusieurs comptes ─
async function detectLinkedAccounts() {
  const { data: rows } = await supabase.from('user_mobile_money')
    .select('user_id, phone, operator');

  // phone est chiffré de manière déterministe : même numéro → même ciphertext,
  // donc on peut grouper directement sans déchiffrer.
  const byPhone = {};
  for (const row of rows || []) {
    const key = `${row.operator}:${row.phone}`;
    if (!byPhone[key]) byPhone[key] = new Set();
    byPhone[key].add(row.user_id);
  }

  for (const [key, userIds] of Object.entries(byPhone)) {
    if (userIds.size > 1) {
      for (const userId of userIds) {
        await createFlag(userId, 'LINKED_ACCOUNTS', 'LOW', {
          shared_with_count: userIds.size - 1,
          operator: key.split(':')[0],
        });
      }
    }
  }
}

/** Lance l'ensemble des détections (appelé par cron) */
async function runFraudDetection() {
  const config = await getAIConfig();
  if (!config.AI_FRAUD_DETECTION_ENABLED) return { skipped: true };

  const results = await Promise.allSettled([
    detectRapidDepositWithdraw(),
    detectReferralAbuse(),
    detectLinkedAccounts(),
  ]);

  const errors = results.filter((r) => r.status === 'rejected').map((r) => r.reason?.message);
  if (errors.length > 0) console.error('[FraudDetection] Erreurs :', errors);

  return { skipped: false, errors };
}

module.exports = { runFraudDetection };

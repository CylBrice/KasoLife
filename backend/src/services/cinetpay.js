// ============================================================
// KASOLIFE — Service CinetPay v4 (corrigé)
// C5 : MTN_CI/ORANGE_CI → MTN_CM/ORANGE_CM (Cameroun)
// C6 : comparaison opérateur insensible à la casse
// ============================================================
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { toFCFA } = require('../config/constants');

const CINETPAY_API      = 'https://api-checkout.cinetpay.com/v2/payment';
const CINETPAY_VERIFY   = 'https://api-checkout.cinetpay.com/v2/payment/check';
const CINETPAY_TRANSFER = 'https://client.cinetpay.com/v1/transfer/money/send/contact';

// ── Initier un dépôt ──────────────────────────────────────────────────────────
const initDeposit = async (userId, montantXcon, returnUrl) => {
  const montantFCFA = toFCFA(montantXcon);
  const txId = `KB_DEP_${uuidv4().replace(/-/g, '').substring(0, 20)}`;

  const payload = {
    apikey:         process.env.CINETPAY_API_KEY,
    site_id:        process.env.CINETPAY_SITE_ID,
    transaction_id: txId,
    amount:         montantFCFA,
    currency:       'XAF',
    description:    'Dépôt KASOLIFE',
    notify_url:     process.env.CINETPAY_NOTIFY_URL,
    return_url:     returnUrl || `${process.env.FRONTEND_URL}/wallet?deposit=success`,
    customer_id:    userId,
    channels:       'ALL',
    lang:           'fr',
  };

  const { data } = await axios.post(CINETPAY_API, payload);
  return { txId, paymentUrl: data.data?.payment_url, data };
};

// ── Vérifier une transaction ──────────────────────────────────────────────────
// Retourne le montant/devise RÉELLEMENT confirmés par CinetPay (jamais ceux du
// webhook, falsifiables) — null si la transaction n'est pas ACCEPTED.
const verifyTransaction = async (txId) => {
  const { data } = await axios.post(CINETPAY_VERIFY, {
    apikey:         process.env.CINETPAY_API_KEY,
    site_id:        process.env.CINETPAY_SITE_ID,
    transaction_id: txId,
  });
  if (data.data?.status !== 'ACCEPTED') return null;
  return {
    amountFCFA: Number(data.data.amount),
    currency:   data.data.currency,
  };
};

// ── Initier un retrait vers Mobile Money ──────────────────────────────────────
// C5 : codes opérateurs Cameroun MTN_CM et ORANGE_CM
// C6 : normalisation en majuscules avant comparaison
const initPayout = async (mobileNumber, montantXcon, operateur, userId) => {
  const montantFCFA = toFCFA(montantXcon);
  const txId = `KB_RET_${uuidv4().replace(/-/g, '').substring(0, 20)}`;

  // C6 : normaliser en majuscules pour comparaison fiable
  const opUpper = (operateur || '').toUpperCase();

  // C5 : codes Cameroun (_CM) et non Côte d'Ivoire (_CI)
  let typePhone;
  if (opUpper === 'MTN') {
    typePhone = 'MTN_CM';
  } else if (opUpper === 'ORANGE') {
    typePhone = 'ORANGE_CM';
  } else {
    // Fallback pour tout autre opérateur non reconnu
    typePhone = `${opUpper}_CM`;
  }

  const payload = {
    apikey:         process.env.CINETPAY_API_KEY,
    site_id:        process.env.CINETPAY_SITE_ID,
    transaction_id: txId,
    amount:         montantFCFA,
    currency:       'XAF',
    phone_number:   mobileNumber,
    prefix:         '237', // Indicatif Cameroun
    type_phone:     typePhone,
    notify_url:     `${process.env.BACKEND_URL}/webhook/cinetpay/payout`,
    description:    `Retrait KASOLIFE - ${userId}`,
  };

  const { data } = await axios.post(CINETPAY_TRANSFER, payload);
  return { txId, data };
};

module.exports = { initDeposit, verifyTransaction, initPayout };

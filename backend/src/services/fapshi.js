// ============================================================
// KASOLIFE — Service Fapshi v1
// Agrégateur Mobile Money Cameroun (MTN + Orange)
// Env : FAPSHI_API_KEY, FAPSHI_API_USER, FAPSHI_ENV (live|sandbox)
// ============================================================
'use strict';
const axios   = require('axios');
const { v4: uuidv4 } = require('uuid');
const { toFCFA } = require('../config/constants');

const BASE_URL = process.env.FAPSHI_ENV === 'live'
  ? 'https://live.fapshi.com'
  : 'https://sandbox.fapshi.com';

const fapshiHeaders = () => ({
  'Content-Type': 'application/json',
  'apikey':  process.env.FAPSHI_API_KEY,
  'apiuser': process.env.FAPSHI_API_USER,
});

// ── Initier un dépôt (initiate pay) ──────────────────────────────────────────
const initDeposit = async (userId, montantXcon, phone, operator) => {
  const montantFCFA = toFCFA(montantXcon);
  const externalId  = `KP_FP_DEP_${uuidv4().replace(/-/g,'').substring(0,14)}`;

  const { data } = await axios.post(`${BASE_URL}/initiate-pay`, {
    amount:     montantFCFA,
    phone,
    medium:     'mobile money',
    name:       'KasoLife',
    userId:     userId,
    externalId,
    message:    'Dépôt KasoLife',
  }, { headers: fapshiHeaders(), timeout: 15000 });

  return {
    txId:      externalId,
    transId:   data.transId,
    link:      data.link,
    status:    data.status || 'PENDING',
    provider:  'fapshi',
    data,
  };
};

// ── Vérifier le statut d'une transaction ──────────────────────────────────────
const verifyTransaction = async (transId) => {
  const { data } = await axios.get(`${BASE_URL}/payment-status/${transId}`, {
    headers: fapshiHeaders(),
    timeout: 10000,
  });
  return data.status === 'SUCCESSFUL';
};

// ── Initier un retrait (payout) ───────────────────────────────────────────────
const initPayout = async (phone, montantXcon, operator, userId) => {
  const montantFCFA = toFCFA(montantXcon);
  const externalId  = `KP_FP_RET_${uuidv4().replace(/-/g,'').substring(0,14)}`;

  const { data } = await axios.post(`${BASE_URL}/payout`, {
    amount:     montantFCFA,
    phone,
    medium:     'mobile money',
    userId:     userId,
    externalId,
    message:    `Retrait KasoLife - ${userId}`,
  }, { headers: fapshiHeaders(), timeout: 15000 });

  return {
    txId:     externalId,
    transId:  data.transId,
    status:   data.status || 'PENDING',
    provider: 'fapshi',
    data,
  };
};

// ── Solde du compte Fapshi ────────────────────────────────────────────────────
const getBalance = async () => {
  try {
    const { data } = await axios.get(`${BASE_URL}/service-balance`, {
      headers: fapshiHeaders(), timeout: 8000,
    });
    return { available: true, balance: data.balance };
  } catch {
    return { available: false, balance: 0 };
  }
};

// ── Health check ──────────────────────────────────────────────────────────────
const healthCheck = async () => {
  const start = Date.now();
  try {
    await getBalance();
    return { available: true, latency: Date.now() - start, provider: 'fapshi' };
  } catch (e) {
    return { available: false, latency: Date.now() - start, provider: 'fapshi', error: e.message };
  }
};

module.exports = { initDeposit, verifyTransaction, initPayout, getBalance, healthCheck };

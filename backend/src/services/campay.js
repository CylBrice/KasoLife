// ============================================================
// KASOLIFE — Service Campay v1
// Agrégateur Mobile Money Cameroun (MTN + Orange)
// Frais : 2% flat sur toutes les transactions
// Env : CAMPAY_USERNAME, CAMPAY_PASSWORD, CAMPAY_ENV (PROD|TEST)
// ============================================================
'use strict';
const axios   = require('axios');
const { v4: uuidv4 } = require('uuid');
const { toFCFA } = require('../config/constants');

const BASE_URL = process.env.CAMPAY_ENV === 'PROD'
  ? 'https://campay.net/api'
  : 'https://demo.campay.net/api';

// ── Obtenir un token d'accès ──────────────────────────────────────────────────
let _token     = null;
let _tokenExp  = 0;

const getToken = async () => {
  if (_token && Date.now() < _tokenExp) return _token;
  const { data } = await axios.post(`${BASE_URL}/token/`, {
    username: process.env.CAMPAY_USERNAME,
    password: process.env.CAMPAY_PASSWORD,
  }, { timeout: 10000 });
  _token    = data.token;
  _tokenExp = Date.now() + 55 * 60 * 1000; // 55 min (expire à 60 min)
  return _token;
};

const headers = async () => ({
  Authorization: `Token ${await getToken()}`,
  'Content-Type': 'application/json',
});

// ── Initier un dépôt (collect) ────────────────────────────────────────────────
const initDeposit = async (userId, montantXcon, phone, operator) => {
  const montantFCFA = toFCFA(montantXcon);
  const externalRef = `KB_CP_DEP_${uuidv4().replace(/-/g,'').substring(0,16)}`;

  const { data } = await axios.post(`${BASE_URL}/collect/`, {
    amount:             String(montantFCFA),
    currency:           'XAF',
    from:               phone,
    description:        'Dépôt KasoLife',
    external_reference: externalRef,
  }, { headers: await headers(), timeout: 15000 });

  return {
    txId:      externalRef,
    reference: data.reference,
    status:    data.status,
    provider:  'campay',
    data,
  };
};

// ── Vérifier le statut d'une transaction ──────────────────────────────────────
const verifyTransaction = async (reference) => {
  const { data } = await axios.get(`${BASE_URL}/transaction/${reference}/`, {
    headers: await headers(),
    timeout: 10000,
  });
  return data.status === 'SUCCESSFUL';
};

// ── Initier un retrait (disburse) ─────────────────────────────────────────────
const initPayout = async (phone, montantXcon, operator, userId) => {
  const montantFCFA = toFCFA(montantXcon);
  const externalRef = `KB_CP_RET_${uuidv4().replace(/-/g,'').substring(0,16)}`;

  const { data } = await axios.post(`${BASE_URL}/disburse/`, {
    amount:             String(montantFCFA),
    currency:           'XAF',
    to:                 phone,
    description:        `Retrait KasoLife - ${userId}`,
    external_reference: externalRef,
  }, { headers: await headers(), timeout: 15000 });

  return {
    txId:      externalRef,
    reference: data.reference,
    status:    data.status,
    provider:  'campay',
    data,
  };
};

// ── Solde du compte Campay ────────────────────────────────────────────────────
const getBalance = async () => {
  try {
    const { data } = await axios.get(`${BASE_URL}/balance/`, {
      headers: await headers(), timeout: 8000,
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
    return { available: true, latency: Date.now() - start, provider: 'campay' };
  } catch (e) {
    return { available: false, latency: Date.now() - start, provider: 'campay', error: e.message };
  }
};

module.exports = { initDeposit, verifyTransaction, initPayout, getBalance, healthCheck };

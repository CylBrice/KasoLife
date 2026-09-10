// ============================================================
// KASOLIFE — Service de conversion des devises v2.0
// Taux stockés en DB (exchange_rates) + cache Redis 1h.
// Règle d'arrondi : Math.floor (entier inférieur) — jamais de centimes.
// USAGE SERVEUR UNIQUEMENT.
// ============================================================
'use strict';

const supabase = require('../config/supabase');
const redis    = require('../config/redis');

const CACHE_KEY = 'exchange_rates:all';
const CACHE_TTL = 3600; // 1 heure

// Taux de repli si DB et Redis sont indisponibles
const FALLBACK_RATES = {
  XAF:  { rate: 1,        symbol: 'FCFA', name: 'Franc CFA Afrique Centrale' },
  FCFA: { rate: 1,        symbol: 'FCFA', name: 'Franc CFA' },
  XOF:  { rate: 1,        symbol: 'FCFA', name: 'Franc CFA Afrique de l\'Ouest' },
  EUR:  { rate: 655.957,  symbol: '€',    name: 'Euro' },
  USD:  { rate: 615.0,    symbol: '$',    name: 'Dollar US' },
  GBP:  { rate: 785.0,    symbol: '£',    name: 'Livre sterling' },
  NGN:  { rate: 0.38,     symbol: '₦',    name: 'Naira nigérian' },
  GHS:  { rate: 42.0,     symbol: 'GH₵',  name: 'Cedi ghanéen' },
  KES:  { rate: 4.7,      symbol: 'KSh',  name: 'Shilling kenyan' },
  ZAR:  { rate: 33.0,     symbol: 'R',    name: 'Rand sud-africain' },
};

// ── Charger les taux depuis Redis → DB → fallback
const getRates = async () => {
  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  try {
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('currency, rate_to_xcon, symbol, name')
      .eq('is_active', true);

    if (!error && data && data.length > 0) {
      const rates = {};
      data.forEach(r => {
        rates[r.currency.toUpperCase()] = {
          rate:   parseFloat(r.rate_to_xcon),
          symbol: r.symbol || r.currency,
          name:   r.name   || r.currency,
        };
      });
      try { await redis.set(CACHE_KEY, JSON.stringify(rates), 'EX', CACHE_TTL); } catch (_) {}
      return rates;
    }
  } catch (_) {}

  console.warn('[currency] Fallback sur taux par défaut');
  return FALLBACK_RATES;
};

// ── Convertir un montant (devise quelconque) → xcon
// Arrondi : Math.floor (entier inférieur, jamais de centimes)
const toXcon = async (amount, currency = 'XAF') => {
  if (!amount || amount <= 0) return 0;
  const rates = await getRates();
  const key   = currency.toUpperCase();
  if (!rates[key]) throw new Error(`Devise non supportée : ${currency}`);
  return Math.floor(amount * rates[key].rate);
};

// ── Convertir xcon → montant dans une devise d'affichage
// Arrondi : Math.floor (entier inférieur)
const fromXcon = async (amountXcon, currency = 'XAF') => {
  if (!amountXcon || amountXcon <= 0) return 0;
  const rates = await getRates();
  const key   = currency.toUpperCase();
  if (!rates[key] || rates[key].rate === 0) throw new Error(`Devise non supportée : ${currency}`);
  return Math.floor(amountXcon / rates[key].rate);
};

// ── Formater un montant xcon pour affichage dans une devise
// Exemple : formatAmount(15000, 'EUR') → '22 €'
const formatAmount = async (amountXcon, currency = 'XAF') => {
  const rates     = await getRates();
  const key       = currency.toUpperCase();
  const rateInfo  = rates[key] || rates['XAF'];
  const converted = Math.floor(amountXcon / rateInfo.rate);
  return `${converted.toLocaleString('fr-FR')} ${rateInfo.symbol}`;
};

// ── Retourner tous les taux actifs (pour dashboard admin et affichage frontend)
const getAllRates = async () => {
  const rates  = await getRates();
  return Object.entries(rates).map(([currency, info]) => ({
    currency,
    rate_to_xcon: info.rate,
    symbol:       info.symbol,
    name:         info.name,
  }));
};

// ── Invalider le cache (appelé après mise à jour admin)
const invalidateCache = async () => {
  try { await redis.del(CACHE_KEY); } catch (_) {}
};

module.exports = { toXcon, fromXcon, formatAmount, getAllRates, invalidateCache, getRates };

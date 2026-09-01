// ============================================================
// KASOLIFE — Service de conversion des devises
// Taux fixes stockés en DB (exchange_rates) — modifiables sans redéploiement
// Règle : résultat toujours arrondi au multiple de 100 inférieur
// USAGE SERVEUR UNIQUEMENT — jamais exposé au client
// ============================================================
const supabase = require('../config/supabase');

// Cache local des taux (rechargé toutes les heures)
let ratesCache = null;
let ratesCacheAt = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 heure

/**
 * Charger les taux depuis la DB avec cache
 */
const getRates = async () => {
  const now = Date.now();
  if (ratesCache && ratesCacheAt && (now - ratesCacheAt) < CACHE_TTL_MS) {
    return ratesCache;
  }

  const { data, error } = await supabase
    .from('exchange_rates')
    .select('currency, rate_to_xcon')
    .eq('is_active', true);

  if (error || !data || data.length === 0) {
    // Fallback sur les taux par défaut si la DB est inaccessible
    console.warn('[currency] Impossible de charger les taux depuis la DB — fallback sur valeurs par défaut');
    return {
      FCFA: 1,
      USD:  500,
      EUR:  600,
    };
  }

  const rates = {};
  data.forEach(r => { rates[r.currency] = parseFloat(r.rate_to_xcon); });

  ratesCache   = rates;
  ratesCacheAt = now;
  return rates;
};

/**
 * Convertir un montant dans une devise en xcon
 * @param {number} amount    - Montant dans la devise source
 * @param {string} currency  - Devise source : 'FCFA' | 'USD' | 'EUR'
 * @returns {number}         - Montant en xcon, arrondi au multiple de 100 inférieur
 */
const toXcon = async (amount, currency) => {
  if (!amount || amount <= 0) return 0;

  const rates = await getRates();
  const curr  = (currency || 'FCFA').toUpperCase();

  if (!rates[curr]) {
    throw new Error(`Devise non supportée: ${currency}. Devises acceptées: FCFA, USD, EUR`);
  }

  const raw    = amount * rates[curr];
  // Arrondi au multiple de 100 inférieur
  const xcon   = Math.floor(raw / 100) * 100;
  return xcon;
};

/**
 * Obtenir les taux actuels (pour affichage dans le dashboard admin)
 */
const getCurrentRates = async () => {
  const rates = await getRates();
  return {
    FCFA: rates.FCFA || 1,
    USD:  rates.USD  || 500,
    EUR:  rates.EUR  || 600,
    note: 'Arrondi au multiple de 100 inférieur appliqué à la conversion',
  };
};

/**
 * Invalider le cache (appelé quand un admin met à jour les taux)
 */
const invalidateCache = () => {
  ratesCache   = null;
  ratesCacheAt = null;
};

module.exports = { toXcon, getCurrentRates, invalidateCache };

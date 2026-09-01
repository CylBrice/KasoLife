// ============================================================
// KASOLIFE — Payment Orchestrator v1
// Load balancing 33/33/33 weighted random
// Circuit breaker : 2 timeouts OU 3 erreurs 5xx en 5 min → indisponible
// Failover progressif : 5min → 15min → 30min → 1h
// Health check automatique
// ============================================================
'use strict';

const cinetpay = require('./cinetpay');
const campay   = require('./campay');
const fapshi   = require('./fapshi');
const supabase  = require('../config/supabase');

// ── Configuration des providers ───────────────────────────────────────────────
const PROVIDERS = {
  cinetpay: { service: cinetpay, name: 'cinetpay', weight: 33 },
  campay:   { service: campay,   name: 'campay',   weight: 33 },
  fapshi:   { service: fapshi,   name: 'fapshi',   weight: 34 },
};

// ── État du circuit breaker — M4 : persisté en base pour survivre aux redémarrages
const circuitState = {
  cinetpay: { disponible: true, erreurs: [], timeouts: [], nextCheck: 0, tentatives: 0 },
  campay:   { disponible: true, erreurs: [], timeouts: [], nextCheck: 0, tentatives: 0 },
  fapshi:   { disponible: true, erreurs: [], timeouts: [], nextCheck: 0, tentatives: 0 },
};

// M4 : charger l'état depuis la base au démarrage du process
const loadCircuitStateFromDB = async () => {
  try {
    const supabase = require('../config/supabase');
    const { data } = await supabase.from('circuit_breaker_state').select('*');
    if (!data) return;
    for (const row of data) {
      if (circuitState[row.provider]) {
        circuitState[row.provider] = {
          disponible: row.disponible,
          erreurs:    row.erreurs    || [],
          timeouts:   row.timeouts   || [],
          nextCheck:  row.next_check || 0,
          tentatives: row.tentatives || 0,
        };
      }
    }
    console.info('[Payment] Circuit breaker state chargé depuis la base');
  } catch (e) {
    console.warn('[Payment] Impossible de charger le circuit breaker depuis la base:', e.message);
  }
};

// M4 : persister l'état en base après chaque changement
const persistCircuitState = async (name) => {
  try {
    const supabase = require('../config/supabase');
    const state = circuitState[name];
    await supabase.from('circuit_breaker_state').upsert({
      provider:   name,
      disponible: state.disponible,
      erreurs:    state.erreurs,
      timeouts:   state.timeouts,
      next_check: state.nextCheck,
      tentatives: state.tentatives,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'provider' });
  } catch (e) {
    console.warn(`[Payment] Impossible de persister l'état circuit breaker ${name}:`, e.message);
  }
};

// Charger l'état au démarrage (non bloquant)
loadCircuitStateFromDB().catch(() => {});

// Délais de re-vérification progressifs selon le nombre de tentatives
const RETRY_DELAYS = [5, 15, 30, 60]; // minutes

// ── Vérifier si un provider est disponible ────────────────────────────────────
const isAvailable = (name) => {
  const state = circuitState[name];
  if (state.disponible) return true;
  if (Date.now() >= state.nextCheck) return true;
  return false;
};

// ── Marquer un provider comme défaillant ──────────────────────────────────────
const markFailure = (name, type) => {
  const state  = circuitState[name];
  const now    = Date.now();
  const window = 5 * 60 * 1000;

  if (type === 'timeout') {
    state.timeouts = state.timeouts.filter(t => now - t < window);
    state.timeouts.push(now);
  } else if (type === '5xx') {
    state.erreurs = state.erreurs.filter(t => now - t < window);
    state.erreurs.push(now);
  }

  const triggered = state.timeouts.length >= 2 || state.erreurs.length >= 3;
  if (triggered && state.disponible) {
    state.disponible = false;
    state.tentatives = Math.min(state.tentatives + 1, RETRY_DELAYS.length - 1);
    const delayMin   = RETRY_DELAYS[state.tentatives - 1] || 60;
    state.nextCheck  = now + delayMin * 60 * 1000;

    logProviderEvent(name, 'DOWN', `Circuit breaker déclenché — retry dans ${delayMin} min`);
    console.warn(`[Payment] ${name} marqué INDISPONIBLE — retry dans ${delayMin} min`);
    persistCircuitState(name).catch(() => {}); // M4 : persister
  }
};

// ── Marquer un provider comme disponible (succès) ─────────────────────────────
const markSuccess = (name) => {
  const state = circuitState[name];
  if (!state.disponible) {
    state.disponible = true;
    state.erreurs    = [];
    state.timeouts   = [];
    state.tentatives = 0;
    logProviderEvent(name, 'UP', 'Provider de nouveau disponible');
    console.info(`[Payment] ${name} de nouveau DISPONIBLE`);
    persistCircuitState(name).catch(() => {}); // M4 : persister
  }
};

// ── Sélection weighted random parmi les providers disponibles ─────────────────
const selectProvider = (preferredProvider = null) => {
  // Si un provider est explicitement demandé (ex: SUPERADMIN Coffre)
  if (preferredProvider && PROVIDERS[preferredProvider]) return preferredProvider;

  const available = Object.keys(PROVIDERS).filter(name => isAvailable(name));
  if (available.length === 0) return null;
  if (available.length === 1) return available[0];

  // Weighted random sur les providers disponibles
  const totalWeight = available.reduce((s, n) => s + PROVIDERS[n].weight, 0);
  let rand = Math.random() * totalWeight;
  for (const name of available) {
    rand -= PROVIDERS[name].weight;
    if (rand <= 0) return name;
  }
  return available[available.length - 1];
};

// ── Appel avec retry automatique ──────────────────────────────────────────────
const callWithRetry = async (providerName, fn, args) => {
  const TIMEOUT_MS = 10000;

  const withTimeout = (promise) => Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)
    ),
  ]);

  try {
    const result = await withTimeout(fn(...args));
    markSuccess(providerName);
    return { result, provider: providerName };
  } catch (err) {
    const isTimeout = err.message === 'TIMEOUT';
    const is5xx     = err.response?.status >= 500;
    markFailure(providerName, isTimeout ? 'timeout' : is5xx ? '5xx' : 'other');

    // Retry automatique après 30 secondes si c'est un timeout transitoire
    if (isTimeout || is5xx) {
      await new Promise(r => setTimeout(r, 30000));
      try {
        const result = await withTimeout(fn(...args));
        markSuccess(providerName);
        return { result, provider: providerName };
      } catch { /* retry échoué — continuer avec failover */ }
    }
    throw err;
  }
};

// ── Dépôt avec failover automatique ──────────────────────────────────────────
const initDeposit = async (userId, montantXcon, phone, operator, preferredProvider = null) => {
  const tried = new Set();
  let lastError;

  while (tried.size < Object.keys(PROVIDERS).length) {
    const name = selectProvider(preferredProvider && !tried.has(preferredProvider) ? preferredProvider : null);
    if (!name || tried.has(name)) break;
    tried.add(name);

    try {
      const { result, provider } = await callWithRetry(
        name,
        PROVIDERS[name].service.initDeposit,
        [userId, montantXcon, phone, operator]
      );
      await logTransaction(name, 'DEPOT', montantXcon, true);
      return { ...result, provider };
    } catch (err) {
      lastError = err;
      console.warn(`[Payment] ${name} échoué pour dépôt — tentative suivante`);
    }
  }
  throw lastError || new Error('Tous les agrégateurs sont indisponibles');
};

// ── Retrait avec failover automatique ────────────────────────────────────────
const initPayout = async (phone, montantXcon, operator, userId, preferredProvider = null) => {
  const tried = new Set();
  let lastError;

  while (tried.size < Object.keys(PROVIDERS).length) {
    const name = selectProvider(preferredProvider && !tried.has(preferredProvider) ? preferredProvider : null);
    if (!name || tried.has(name)) break;
    tried.add(name);

    try {
      const { result, provider } = await callWithRetry(
        name,
        PROVIDERS[name].service.initPayout,
        [phone, montantXcon, operator, userId]
      );
      await logTransaction(name, 'RETRAIT', montantXcon, true);
      return { ...result, provider };
    } catch (err) {
      lastError = err;
      console.warn(`[Payment] ${name} échoué pour retrait — tentative suivante`);
    }
  }
  throw lastError || new Error('Tous les agrégateurs sont indisponibles');
};

// ── Vérification transaction par provider ─────────────────────────────────────
const verifyTransaction = async (providerName, reference) => {
  const provider = PROVIDERS[providerName];
  if (!provider) throw new Error(`Provider inconnu : ${providerName}`);
  return provider.service.verifyTransaction(reference);
};

// ── État de tous les providers ────────────────────────────────────────────────
const getProvidersStatus = () => {
  const available = Object.keys(PROVIDERS).filter(n => isAvailable(n));
  const total     = Object.keys(PROVIDERS).length;
  const charge    = {};

  available.forEach(name => {
    charge[name] = Math.round(100 / available.length);
  });

  return {
    providers: Object.keys(PROVIDERS).map(name => ({
      name,
      disponible:     isAvailable(name),
      charge:         charge[name] || 0,
      tentatives:     circuitState[name].tentatives,
      prochainCheck:  circuitState[name].nextCheck > Date.now()
        ? new Date(circuitState[name].nextCheck).toISOString()
        : null,
    })),
    totalAvailable: available.length,
    total,
  };
};

// ── Health check manuel (déclenché par le cron) ───────────────────────────────
const runHealthChecks = async () => {
  const results = await Promise.allSettled(
    Object.keys(PROVIDERS).map(async (name) => {
      const state = circuitState[name];
      // Vérifier seulement si le délai est écoulé
      if (state.disponible || Date.now() < state.nextCheck) return;
      const check = await PROVIDERS[name].service.healthCheck();
      if (check.available) {
        markSuccess(name);
      } else {
        const delayMin = RETRY_DELAYS[Math.min(state.tentatives, RETRY_DELAYS.length - 1)];
        state.nextCheck = Date.now() + delayMin * 60 * 1000;
      }
      return check;
    })
  );
  return results;
};

// ── Logger événement provider en base ─────────────────────────────────────────
const logProviderEvent = async (provider, event, message) => {
  try {
    await supabase.from('payment_provider_logs').insert({
      provider, event, message, created_at: new Date().toISOString(),
    });
  } catch { /* non bloquant */ }
};

// ── Logger transaction en base ────────────────────────────────────────────────
const logTransaction = async (provider, type, amount_xcon, success) => {
  try {
    await supabase.from('payment_provider_logs').insert({
      provider,
      event:       success ? 'TX_SUCCESS' : 'TX_FAIL',
      type,
      amount_xcon,
      created_at:  new Date().toISOString(),
    });
  } catch { /* non bloquant */ }
};

module.exports = {
  initDeposit,
  initPayout,
  verifyTransaction,
  getProvidersStatus,
  runHealthChecks,
  circuitState,
};

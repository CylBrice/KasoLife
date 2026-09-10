// ============================================================
// KASOLIFE — ConfigService
// Lit les paramètres plateforme depuis platform_config (DB)
// avec cache Redis 5 minutes. Fallback sur constants.js si
// la DB est indisponible ou si la clé est absente.
// ============================================================
'use strict';

const supabase  = require('../config/supabase');
const redis     = require('../config/redis');
const constants = require('../config/constants');

const CACHE_PREFIX = 'platform_config:';
const CACHE_TTL_S  = 300; // 5 minutes

// ── Valeurs par défaut (fallback si DB indisponible)
const DEFAULTS = {
  commission_subscription:        constants.SUBSCRIPTION_COMMISSION_RATE,
  commission_tip:                 constants.TIP_COMMISSION_RATE,
  commission_ppv:                 constants.PPV_COMMISSION_RATE,
  commission_withdrawal:          constants.WITHDRAWAL_COMMISSION_RATE,
  commission_prerecorded:         0.15,
  commission_fanclub:             0.15,
  commission_referral:            0.10,
  commission_welcome_rate:        0.10,
  commission_welcome_days:        30,
  bonus_welcome_enabled:          false,
  bonus_welcome_threshold_1_xcon: 150000,
  bonus_welcome_amount_1_xcon:    25000,
  bonus_welcome_threshold_2_xcon: 500000,
  bonus_welcome_amount_2_xcon:    50000,
  bonus_welcome_period_2_days:    60,
  fanclub_level_1_min_price_xcon: 1500,
  fanclub_level_2_min_price_xcon: 4000,
  fanclub_level_3_min_price_xcon: 8000,
  watermark_visible_enabled:      true,
  watermark_invisible_enabled:    true,
};

// Convertit une valeur texte selon son type déclaré
const castValue = (raw, type) => {
  switch (type) {
    case 'float':   return parseFloat(raw);
    case 'integer': return parseInt(raw, 10);
    case 'boolean': return raw === 'true';
    default: {
      // Auto-détection si value_type absent ou 'string'
      if (raw === 'true')  return true;
      if (raw === 'false') return false;
      const n = Number(raw);
      if (!isNaN(n) && raw.trim() !== '') return n;
      return raw;
    }
  }
};

// ── Lecture d'une clé (cache → DB → fallback)
const get = async (key) => {
  try {
    const cached = await redis.get(`${CACHE_PREFIX}${key}`);
    if (cached !== null) return JSON.parse(cached);
  } catch (_) { /* Redis indisponible — on continue */ }

  try {
    const { data, error } = await supabase
      .from('platform_config')
      .select('value, value_type')
      .eq('key', key)
      .single();

    if (!error && data) {
      const value = castValue(data.value, data.value_type);
      try { await redis.set(`${CACHE_PREFIX}${key}`, JSON.stringify(value), 'EX', CACHE_TTL_S); } catch (_) {}
      return value;
    }
  } catch (_) { /* DB indisponible — fallback */ }

  return key in DEFAULTS ? DEFAULTS[key] : null;
};

// ── Lecture de toutes les clés (pour l'interface admin)
const getAll = async () => {
  try {
    const { data, error } = await supabase
      .from('platform_config')
      .select('key, value, value_type, description, updated_at, updated_by')
      .order('key');

    if (!error && data) return data.map(row => ({
      ...row,
      parsed_value: castValue(row.value, row.value_type),
    }));
  } catch (_) {}
  return [];
};

// ── Mise à jour d'une clé (admin uniquement — invalide le cache)
const set = async (key, value, updatedBy) => {
  const { data, error } = await supabase
    .from('platform_config')
    .update({ value: String(value), updated_at: new Date().toISOString(), updated_by: updatedBy })
    .eq('key', key)
    .select()
    .single();

  if (error) throw error;

  // Invalider le cache Redis pour cette clé
  try { await redis.del(`${CACHE_PREFIX}${key}`); } catch (_) {}

  return data;
};

// ── Raccourcis pour les taux de commission (usage fréquent dans les routes)
const getCommissionRate = async (type) => {
  const key = `commission_${type}`;
  const rate = await get(key);
  return typeof rate === 'number' ? rate : (DEFAULTS[key] ?? 0.20);
};

// ── Vérifie si le créateur bénéficie du taux bienvenue
// firstPublishedAt : Date ISO du premier contenu publié
const getWelcomeCommissionRate = async (firstPublishedAt) => {
  if (!firstPublishedAt) return null;

  const welcomeDays = await get('commission_welcome_days');
  const welcomeRate = await get('commission_welcome_rate');
  const daysSince   = (Date.now() - new Date(firstPublishedAt).getTime()) / (1000 * 60 * 60 * 24);

  return daysSince <= welcomeDays ? welcomeRate : null;
};

module.exports = { get, getAll, set, getCommissionRate, getWelcomeCommissionRate };

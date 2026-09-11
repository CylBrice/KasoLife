// ============================================================
// KASOLIFE — ToyConfigService
// Charge les paliers jouet imposés par plateforme depuis DB.
// Cache Redis 5 minutes. Fallback sur paliers par défaut.
// ============================================================
'use strict';

const supabase = require('../config/supabase');
const redis    = require('../config/redis');

const CACHE_KEY    = 'toy_paliers';
const CACHE_TTL_S  = 300; // 5 minutes

// Paliers par défaut (fallback si DB indisponible)
const DEFAULT_PALIERS = [
  { palier: 1, min: 1,    max: 9,      duration_s: 2,   intensity_min: 20,  intensity_max: 40  },
  { palier: 2, min: 10,   max: 24,     duration_s: 5,   intensity_min: 40,  intensity_max: 60  },
  { palier: 3, min: 25,   max: 99,     duration_s: 10,  intensity_min: 60,  intensity_max: 75  },
  { palier: 4, min: 100,  max: 499,    duration_s: 40,  intensity_min: 75,  intensity_max: 90  },
  { palier: 5, min: 500,  max: 899,    duration_s: 160, intensity_min: 80,  intensity_max: 100 },
  { palier: 6, min: 900,  max: 1299,   duration_s: 380, intensity_min: 90,  intensity_max: 100 },
  { palier: 7, min: 1300, max: 999999, duration_s: 600, intensity_min: 100, intensity_max: 100 },
];

// ── Récupère les paliers depuis DB (avec cache) ─────────────────
const getPaliers = async () => {
  try {
    // Essaie cache Redis
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.warn('[ToyConfigService] Redis cache miss, fallback to DB', err.message);
  }

  try {
    // Lit la version courante depuis toy_paliers_versions
    const { data: versions, error } = await supabase
      .from('toy_paliers_versions')
      .select('paliers_json')
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error || !versions) {
      console.warn('[ToyConfigService] DB read failed, using default paliers', error?.message);
      return DEFAULT_PALIERS;
    }

    const paliers = versions.paliers_json;

    // Cache en Redis
    try {
      await redis.setex(CACHE_KEY, CACHE_TTL_S, JSON.stringify(paliers));
    } catch (redisErr) {
      console.warn('[ToyConfigService] Redis setex failed, continuing without cache', redisErr.message);
    }

    return paliers;
  } catch (dbErr) {
    console.error('[ToyConfigService] DB query error', dbErr.message);
    return DEFAULT_PALIERS;
  }
};

// ── Trouve le palier pour un montant donné ──────────────────────
const getPalierForAmount = async (amount_xcon) => {
  const paliers = await getPaliers();
  const matching = paliers.find(p => amount_xcon >= p.min && amount_xcon <= p.max);
  return matching || paliers[paliers.length - 1]; // Default to last (highest)
};

// ── Récupère la config d'un palier spécifique ──────────────────
const getPalierById = async (palier_id) => {
  const paliers = await getPaliers();
  return paliers.find(p => p.palier === palier_id);
};

// ── Invalide le cache (appelé après admin update) ────────────────
const invalidateCache = async () => {
  try {
    await redis.del(CACHE_KEY);
  } catch (err) {
    console.warn('[ToyConfigService] Cache invalidation failed', err.message);
  }
};

module.exports = {
  getPaliers,
  getPalierForAmount,
  getPalierById,
  invalidateCache,
};

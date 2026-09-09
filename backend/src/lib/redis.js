'use strict';
const { Redis } = require('ioredis');

// Construit l'URL Redis depuis les variables d'environnement disponibles.
// Priorité : REDIS_URL complet > variables séparées (HOST + PORT + PASSWORD).
function buildRedisConfig() {
  if (process.env.REDIS_URL) {
    return { url: process.env.REDIS_URL };
  }

  const host     = process.env.REDIS_HOST || 'localhost';
  const port     = parseInt(process.env.REDIS_PORT || '6379', 10);
  const password = process.env.REDIS_PASSWORD || undefined;
  const tls      = process.env.REDIS_TLS === 'true' ? {} : undefined;

  return { host, port, password, tls };
}

const config = buildRedisConfig();

// Redis optionnel — une indisponibilité ne doit jamais planter le serveur.
// Le système bascule automatiquement sur Supabase si Redis est inaccessible.
const redis = config.url
  ? new Redis(config.url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 500, 3000)),
    })
  : new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      tls: config.tls,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 500, 3000)),
    });

let _ready = false;

redis.on('ready',   () => { _ready = true;  console.log('[Redis] connected'); });
redis.on('close',   () => { _ready = false; });
redis.on('error',   (err) => { if (_ready) console.error('[Redis]', err.message); });

// Tente la connexion au démarrage — non bloquant même si Redis est absent
redis.connect().catch(() => {});

// Wrapper sûr : retourne null si Redis est down, sans throw
redis.safeGet = async (key) => {
  if (!_ready) return null;
  try { return await redis.get(key); } catch { return null; }
};

redis.safeSetex = async (key, ttl, value) => {
  if (!_ready) return;
  try { await redis.setex(key, ttl, value); } catch { /* no-op */ }
};

redis.safeDel = async (key) => {
  if (!_ready) return;
  try { await redis.del(key); } catch { /* no-op */ }
};

module.exports = redis;

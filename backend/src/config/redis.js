'use strict';

// Client Redis avec dégradation silencieuse si Redis est indisponible.
// En local sans Redis, toutes les opérations deviennent des no-ops.
// En production sur le VPS, Redis est sur le port 6380 avec mot de passe.

let client;

try {
  const Redis = require('ioredis');

  const redisConfig = process.env.REDIS_URL
    ? process.env.REDIS_URL
    : {
        host:     process.env.REDIS_HOST     || '127.0.0.1',
        port:     parseInt(process.env.REDIS_PORT || '6380', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        lazyConnect:          true,
        enableOfflineQueue:   false,
        connectTimeout:       3000,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => (times > 2 ? null : 500), // abandonne après 2 tentatives
      };

  client = new Redis(redisConfig);

  client.on('error', () => {
    // Silencieux — Redis optionnel, configService a ses propres try/catch
  });

} catch (_) {
  // ioredis non installé ou erreur — stub no-op
  client = null;
}

// Stub no-op si Redis indisponible
const noop = async () => null;

module.exports = client
  ? client
  : { get: noop, set: noop, del: noop, on: () => {}, quit: noop };

-- ============================================================
-- KASOLIFE — Migration 0026 : Private Shows (vidéo 1-to-1 LiveKit)
--
-- Différent de Private Chat (messagerie) :
--   Private Show = session vidéo LiveKit forfaitée (15/30/45/60 min)
--   Types : STANDARD (spy autorisé) | PREMIUM (exclusif, pas de spy)
--
-- Spy mode : flux lecture seule (rôle subscriber LiveKit, même room)
-- Queue : enchère temps réel, tri par bid décroissant
-- Déconnexion involontaire : période de grâce Redis, timer pausé
-- AUCUN CRON — nettoyage à la connexion / reconnexion
-- ============================================================

-- ── Prix planchers plateforme ────────────────────────────────
-- Stockés dans platform_config (admin-configurables)
-- Format : private_show_min_<type>_<duration>min
INSERT INTO platform_config (key, value, value_type, description)
VALUES
  -- Standard
  ('private_show_min_standard_15min',  '6000',  'integer', 'Prix plancher Private Show Standard 15 min (XAF)'),
  ('private_show_min_standard_30min',  '10000', 'integer', 'Prix plancher Private Show Standard 30 min (XAF)'),
  ('private_show_min_standard_45min',  '14000', 'integer', 'Prix plancher Private Show Standard 45 min (XAF)'),
  ('private_show_min_standard_60min',  '18000', 'integer', 'Prix plancher Private Show Standard 60 min (XAF)'),
  -- Premium Private (pas de spy → tarif plancher plus élevé)
  ('private_show_min_premium_15min',   '9000',  'integer', 'Prix plancher Private Show Premium 15 min (XAF)'),
  ('private_show_min_premium_30min',   '16000', 'integer', 'Prix plancher Private Show Premium 30 min (XAF)'),
  ('private_show_min_premium_45min',   '22000', 'integer', 'Prix plancher Private Show Premium 45 min (XAF)'),
  ('private_show_min_premium_60min',   '28000', 'integer', 'Prix plancher Private Show Premium 60 min (XAF)'),
  -- Spy : prix plancher par minute
  ('private_show_spy_min_price_xcon',  '200',   'integer', 'Prix plancher spy par minute (XCon)'),
  -- Période de grâce reconnexion créateur (secondes)
  ('private_show_grace_period_seconds', '300',  'integer', 'Délai de grâce reconnexion créateur après déco réseau (s)'),
  -- Timeout max pour accepter une demande en queue
  ('private_show_request_timeout_min',  '10',   'integer', 'Délai max (min) pour accepter une demande de la queue')
ON CONFLICT (key) DO NOTHING;

-- ── Prix configurés par le créateur ─────────────────────────
-- Le créateur définit son tarif par type + durée (≥ plancher plateforme)
CREATE TABLE IF NOT EXISTS private_show_prices (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  show_type     VARCHAR(10) NOT NULL CHECK (show_type IN ('STANDARD', 'PREMIUM')),
  duration_min  INTEGER     NOT NULL CHECK (duration_min IN (15, 30, 45, 60)),
  price_xcon    INTEGER     NOT NULL CHECK (price_xcon > 0),
  spy_price_per_min_xcon INTEGER CHECK (spy_price_per_min_xcon > 0), -- NULL = pas de spy pour ce forfait
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (creator_id, show_type, duration_min)
);

CREATE INDEX IF NOT EXISTS idx_private_show_prices_creator
  ON private_show_prices (creator_id);

-- ── Sessions Private Show ─────────────────────────────────────
-- Workflow :
--   PENDING → ACTIVE → ENDED
--   PENDING → REJECTED | CANCELLED
CREATE TABLE IF NOT EXISTS private_shows (
  id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id              UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fan_id                  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  show_type               VARCHAR(10) NOT NULL CHECK (show_type IN ('STANDARD', 'PREMIUM')),
  status                  VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING','ACTIVE','ENDED','REJECTED','CANCELLED')),
  -- Forfait négocié
  package_minutes         INTEGER     NOT NULL CHECK (package_minutes IN (15, 30, 45, 60)),
  price_xcon              INTEGER     NOT NULL CHECK (price_xcon > 0),
  commission_xcon         INTEGER     NOT NULL DEFAULT 0,
  -- Room LiveKit (format : private-show-{uuid})
  livekit_room            VARCHAR(120) UNIQUE,
  -- Timestamps
  request_expires_at      TIMESTAMPTZ,
  started_at              TIMESTAMPTZ,
  ended_at                TIMESTAMPTZ,
  -- Durée réelle et remboursement prorata
  actual_duration_seconds INTEGER,
  refund_xcon             INTEGER     NOT NULL DEFAULT 0,
  -- Déconnexion involontaire
  -- TRUE = créateur a cliqué "Terminer" (pas de grâce)
  ended_voluntarily       BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Timestamp de la dernière déco réseau créateur (pour calcul grâce)
  creator_disconnected_at TIMESTAMPTZ,
  -- Nombre de reconnexions (audit)
  reconnect_count         INTEGER     NOT NULL DEFAULT 0,
  -- Motif refus/annulation
  rejection_reason        TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_private_shows_creator
  ON private_shows (creator_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_private_shows_fan
  ON private_shows (fan_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_private_shows_active
  ON private_shows (creator_id, status)
  WHERE status = 'ACTIVE';

-- ── File d'attente avec enchère temps réel ───────────────────
-- Un fan peut avoir au plus une entrée WAITING par créateur.
-- bid_xcon : montant que le fan propose (≥ prix du forfait demandé).
-- La file est triée par bid_xcon DESC côté application.
CREATE TABLE IF NOT EXISTS private_show_queue (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fan_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  show_type       VARCHAR(10) NOT NULL CHECK (show_type IN ('STANDARD', 'PREMIUM')),
  package_minutes INTEGER     NOT NULL CHECK (package_minutes IN (15, 30, 45, 60)),
  -- bid_xcon doit être ≥ prix du forfait correspondant dans private_show_prices
  bid_xcon        INTEGER     NOT NULL CHECK (bid_xcon > 0),
  status          VARCHAR(20) NOT NULL DEFAULT 'WAITING'
                    CHECK (status IN ('WAITING','ACCEPTED','REJECTED','EXPIRED','CANCELLED')),
  -- Wallet : montant bloqué = bid_xcon (retenu dès l'entrée en queue)
  wallet_blocked  BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Timestamp d'expiration si le créateur ne répond pas
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Un fan ne peut être qu'une seule fois en attente chez un créateur
  UNIQUE (creator_id, fan_id, status)
    DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX IF NOT EXISTS idx_private_show_queue_creator
  ON private_show_queue (creator_id, status, bid_xcon DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_private_show_queue_fan
  ON private_show_queue (fan_id, status);

-- ── Sessions spy ─────────────────────────────────────────────
-- Uniquement pour les shows STANDARD (vérifié au niveau applicatif).
-- Le fan spy rejoint la room LiveKit en subscriber-only.
CREATE TABLE IF NOT EXISTS private_show_spies (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  show_id       UUID        NOT NULL REFERENCES private_shows(id) ON DELETE CASCADE,
  fan_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price_xcon    INTEGER     NOT NULL CHECK (price_xcon > 0), -- total payé
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at       TIMESTAMPTZ,
  actual_minutes INTEGER,
  -- Pas de remboursement spy en cas de déco créateur (durée réelle facturée)
  UNIQUE (show_id, fan_id)
);

CREATE INDEX IF NOT EXISTS idx_private_show_spies_show
  ON private_show_spies (show_id);

CREATE INDEX IF NOT EXISTS idx_private_show_spies_fan
  ON private_show_spies (fan_id);

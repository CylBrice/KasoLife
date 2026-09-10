-- ============================================================
-- KASOLIFE — Migration 0022 : VIP Shows
-- Show privé : seuil 2 fans min, 5 min gratuites (grace),
-- ensuite chaque nouveau fan paie pour accéder.
-- Fans présents pendant la grace ont accès gratuit complet.
-- ============================================================

-- ── Table des VIP Shows ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS vip_shows (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Nom de room LiveKit (format : vip-show-{uuid})
  room_name        VARCHAR(100) UNIQUE,
  title            VARCHAR(200) NOT NULL,
  description      TEXT,
  -- Prix d'accès après la grace period (0 = gratuit pour tous)
  price_xcon       INTEGER      NOT NULL DEFAULT 0 CHECK (price_xcon >= 0),
  commission_xcon  INTEGER      NOT NULL DEFAULT 0,
  -- Seuil minimum de fans pour que le show démarre
  min_fans         INTEGER      NOT NULL DEFAULT 2,
  -- Durée de la grace period (min) — fans présents pendant ce temps ont accès gratuit
  grace_minutes    INTEGER      NOT NULL DEFAULT 5,
  -- Statut
  status           VARCHAR(20)  NOT NULL DEFAULT 'WAITING'
                     CHECK (status IN ('WAITING','LIVE','ENDED')),
  -- Timestamps
  grace_ends_at    TIMESTAMPTZ, -- calculé au démarrage : started_at + grace_minutes
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  -- Compteurs mis à jour en temps réel
  current_fans     INTEGER      NOT NULL DEFAULT 0,
  total_revenue_xcon INTEGER    NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Participants d'un VIP Show ───────────────────────────────
CREATE TABLE IF NOT EXISTS vip_show_participants (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  show_id               UUID        NOT NULL REFERENCES vip_shows(id) ON DELETE CASCADE,
  fan_id                UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- true = fan rejoint pendant la grace → accès gratuit
  joined_during_grace   BOOLEAN     NOT NULL DEFAULT FALSE,
  price_paid_xcon       INTEGER     NOT NULL DEFAULT 0,
  commission_xcon       INTEGER     NOT NULL DEFAULT 0,
  joined_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at               TIMESTAMPTZ,
  UNIQUE (show_id, fan_id)
);

-- ── Prix VIP Shows dans platform_config ─────────────────────
INSERT INTO platform_config (key, value, value_type, description)
VALUES
  ('vip_show_min_price_xcon', '2000',  'integer', 'Prix minimum d''accès à un VIP Show (XAF)'),
  ('vip_show_max_price_xcon', '50000', 'integer', 'Prix maximum d''accès à un VIP Show (XAF)')
ON CONFLICT (key) DO NOTHING;

-- ── Index ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vip_shows_creator
  ON vip_shows (creator_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vip_shows_live
  ON vip_shows (status, started_at DESC)
  WHERE status = 'LIVE';

CREATE INDEX IF NOT EXISTS idx_vip_show_participants_show
  ON vip_show_participants (show_id, joined_at);

CREATE INDEX IF NOT EXISTS idx_vip_show_participants_fan
  ON vip_show_participants (fan_id, joined_at DESC);

-- ============================================================
-- KASOLIFE — Migration 029 : Stream Goals & Ledger
--
-- Goals : défis créateur pendant live stream
-- Ledger : accumule TOUS les tips/paiements d'un stream
-- Finalisation : calcul 80/20 à fin du stream
-- ============================================================

-- ── Configuration platform (minimums goals) ──────────────────
INSERT INTO platform_config (key, value, value_type, description) VALUES
  ('stream_goal_min_amount_xcon', '1000', 'integer', 'Montant minimum pour créer un goal stream (XAF)')
ON CONFLICT (key) DO NOTHING;

-- ── Défis créateur pendant un stream ──────────────────────────
CREATE TABLE IF NOT EXISTS stream_goals (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id         UUID        NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  creator_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             TEXT        NOT NULL,
  target_amount_xcon INTEGER     NOT NULL CHECK (target_amount_xcon >= 1000),
  current_amount_xcon INTEGER    NOT NULL DEFAULT 0,
  status            VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
  can_edit          BOOLEAN     NOT NULL DEFAULT TRUE, -- FALSE dès qu'un tip reçu
  can_delete        BOOLEAN     NOT NULL DEFAULT TRUE, -- FALSE dès qu'un tip reçu
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_stream_goals_stream
  ON stream_goals (stream_id, status);

CREATE INDEX IF NOT EXISTS idx_stream_goals_creator
  ON stream_goals (creator_id, stream_id, status);

-- ── Ledger : accumule TOUS les paiements d'un stream ──────────
-- Appelé à la fin du stream pour un calcul 80/20 atomique
CREATE TABLE IF NOT EXISTS stream_ledger (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id         UUID        NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  fan_id            UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_xcon       INTEGER     NOT NULL CHECK (amount_xcon > 0),
  -- Type de transaction : TIP, PPV, PRIVATE_CHAT, PRIVATE_SHOW, GOAL_TIP, etc.
  transaction_type  VARCHAR(30) NOT NULL DEFAULT 'TIP',
  -- Si associé à un goal, référence
  goal_id           UUID        REFERENCES stream_goals(id) ON DELETE SET NULL,
  -- État : PENDING (en attente de finalisation) | FINALIZED (payé)
  status            VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING', 'FINALIZED', 'FAILED')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalized_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_stream_ledger_stream
  ON stream_ledger (stream_id, status);

CREATE INDEX IF NOT EXISTS idx_stream_ledger_fan
  ON stream_ledger (fan_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stream_ledger_goal
  ON stream_ledger (goal_id);

-- ── Historique finalisations stream (audit trail) ─────────────
CREATE TABLE IF NOT EXISTS stream_finalization_log (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id             UUID        NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  creator_id            UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_amount_xcon     INTEGER     NOT NULL,
  creator_share_xcon    INTEGER     NOT NULL,
  platform_share_xcon   INTEGER     NOT NULL,
  tip_count             INTEGER     NOT NULL DEFAULT 0,
  goal_completed        BOOLEAN     NOT NULL DEFAULT FALSE,
  finalized_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_finalization_stream
  ON stream_finalization_log (stream_id);

CREATE INDEX IF NOT EXISTS idx_stream_finalization_creator
  ON stream_finalization_log (creator_id, finalized_at DESC);

-- ── Stats derniers tippers (pour overlay) ────────────────────
-- Dénormalisé pour performance UI (plutôt que joindre à chaque fois)
CREATE TABLE IF NOT EXISTS stream_tip_stats (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id         UUID        NOT NULL UNIQUE REFERENCES live_streams(id) ON DELETE CASCADE,
  last_tipper_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  last_tipper_pseudo VARCHAR(100),
  last_tip_amount_xcon INTEGER,
  last_tip_at       TIMESTAMPTZ,
  top_tipper_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  top_tipper_pseudo VARCHAR(100),
  top_tip_amount_xcon INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_tip_stats_stream
  ON stream_tip_stats (stream_id);

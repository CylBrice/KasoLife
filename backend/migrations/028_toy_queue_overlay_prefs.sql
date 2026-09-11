-- ============================================================
-- KASOLIFE — Migration 028 : Toy Tip Queue & Overlay Preferences
--
-- Queue jouet : file d'attente des tips en temps réel.
-- Overlay prefs : préférences utilisateur pour masquer/afficher overlay.
-- ============================================================

-- ── File d'attente tips jouet (temps réel) ──────────────────────
-- Accumule les tips en attente de traitement.
-- Redis est utilisé en cache, cette table est pour audit trail.
CREATE TABLE IF NOT EXISTS toy_tip_queue (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  live_stream_id      UUID        NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  creator_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fan_id              UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_xcon         INTEGER     NOT NULL CHECK (amount_xcon > 0),
  palier_id           INTEGER     NOT NULL, -- 1-7
  duration_seconds    INTEGER     NOT NULL,
  intensity_min       INTEGER     NOT NULL,
  intensity_max       INTEGER     NOT NULL,
  -- État du tip
  status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'CANCELLED')),
  error_message       TEXT,
  -- Timestamps
  queued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_toy_tip_queue_live_stream
  ON toy_tip_queue (live_stream_id, status);

CREATE INDEX IF NOT EXISTS idx_toy_tip_queue_creator
  ON toy_tip_queue (creator_id, status);

CREATE INDEX IF NOT EXISTS idx_toy_tip_queue_fan
  ON toy_tip_queue (fan_id, created_at DESC);

-- ── Préférences d'affichage overlay (utilisateurs) ───────────────
-- Chaque utilisateur peut masquer/afficher l'overlay interactif
-- Par défaut : TRUE (affiche)
CREATE TABLE IF NOT EXISTS user_overlay_preferences (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  show_toy_overlay BOOLEAN     NOT NULL DEFAULT TRUE,
  -- Quand la préférence a été modifiée
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_overlay_preferences_user
  ON user_overlay_preferences (user_id);

-- ── Historique tips jouet (audit trail) ────────────────────────
-- Chaque tip jouet est enregistré pour l'historique créateur/plateforme
CREATE TABLE IF NOT EXISTS toy_tip_history (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  live_stream_id      UUID        NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  creator_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fan_id              UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_xcon         INTEGER     NOT NULL,
  palier_id           INTEGER     NOT NULL,
  duration_seconds    INTEGER     NOT NULL,
  intensity_sent      INTEGER     NOT NULL,
  -- Commission appliquée
  commission_xcon     INTEGER     NOT NULL DEFAULT 0,
  creator_net_xcon    INTEGER     NOT NULL DEFAULT 0,
  -- État de livraison
  status              VARCHAR(20) NOT NULL DEFAULT 'SENT'
                        CHECK (status IN ('SENT', 'FAILED')),
  -- Timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_toy_tip_history_live_stream
  ON toy_tip_history (live_stream_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_toy_tip_history_creator
  ON toy_tip_history (creator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_toy_tip_history_fan
  ON toy_tip_history (fan_id, created_at DESC);

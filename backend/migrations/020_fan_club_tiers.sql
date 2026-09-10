-- ============================================================
-- KASOLIFE — Migration 0020 : Fan Club multi-niveaux
-- 3 niveaux par créateur, prix plancher défini en admin.
-- Niveau sup = accès aux niveaux inférieurs (inclus).
-- Extension additive de la table subscriptions existante.
-- ============================================================

-- ── Ajouter le niveau fan club à subscriptions ──────────────
-- 0 = abonnement classique (pas de fan club)
-- 1 / 2 / 3 = niveaux fan club Bronze / Argent / Or
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS fan_club_tier INTEGER NOT NULL DEFAULT 0
    CHECK (fan_club_tier BETWEEN 0 AND 3);

-- ── Configuration des niveaux Fan Club par créateur ─────────
CREATE TABLE IF NOT EXISTS fan_club_tiers (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id   UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier         INTEGER      NOT NULL CHECK (tier BETWEEN 1 AND 3),
  name         VARCHAR(100) NOT NULL,         -- ex: "Soutien Bronze"
  description  TEXT,
  price_xcon   INTEGER      NOT NULL CHECK (price_xcon > 0),
  -- Avantages JSON (messages prioritaires, contenu exclusif, etc.)
  benefits     JSONB        NOT NULL DEFAULT '[]',
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (creator_id, tier)
);

-- ── Prix plancher par niveau (configurable en admin) ────────
-- Stocké dans platform_config avec les clés :
--   fan_club_floor_tier_1, fan_club_floor_tier_2, fan_club_floor_tier_3
-- (déjà insérés dans la migration 0016)

-- ── Index ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fan_club_tiers_creator
  ON fan_club_tiers (creator_id) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_subscriptions_tier
  ON subscriptions (creator_id, fan_club_tier)
  WHERE status = 'ACTIVE' AND fan_club_tier > 0;

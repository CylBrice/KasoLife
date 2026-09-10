-- ============================================================
-- KASOLIFE — Migration 0024 : Snapshots payants
-- Prise manuelle par le créateur (pendant live ou hors live).
-- Achat fan → accès permanent → visible dans "Mes achats".
-- Contenu streamé uniquement, jamais téléchargeable.
-- ============================================================

-- ── Table des snapshots ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS snapshots (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Référence optionnelle au live pendant lequel le snapshot a été pris
  live_stream_id  UUID        REFERENCES live_streams(id) ON DELETE SET NULL,
  media_url       TEXT        NOT NULL,
  thumbnail_url   TEXT,
  title           VARCHAR(200),
  description     TEXT,
  -- Prix (0 = gratuit pour abonnés)
  price_xcon      INTEGER     NOT NULL DEFAULT 0 CHECK (price_xcon >= 0),
  -- FREE | SUBSCRIBERS | PPV
  access_level    VARCHAR(20) NOT NULL DEFAULT 'PPV'
                    CHECK (access_level IN ('FREE', 'SUBSCRIBERS', 'PPV')),
  is_published    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Achats de snapshots ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS snapshot_purchases (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_id      UUID        NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  price_paid_xcon  INTEGER     NOT NULL CHECK (price_paid_xcon >= 0),
  commission_xcon  INTEGER     NOT NULL DEFAULT 0,
  purchased_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (buyer_id, snapshot_id)
);

-- ── Prix plancher snapshot dans platform_config ──────────────
INSERT INTO platform_config (key, value, value_type, description)
VALUES
  ('snapshot_min_price_xcon', '500',  'integer', 'Prix minimum d''un snapshot payant (XAF)'),
  ('snapshot_max_price_xcon', '50000','integer', 'Prix maximum d''un snapshot payant (XAF)')
ON CONFLICT (key) DO NOTHING;

-- ── Index ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_snapshots_creator
  ON snapshots (creator_id, is_published, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_snapshots_live
  ON snapshots (live_stream_id)
  WHERE live_stream_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_snapshot_purchases_buyer
  ON snapshot_purchases (buyer_id, purchased_at DESC);

CREATE INDEX IF NOT EXISTS idx_snapshot_purchases_snapshot
  ON snapshot_purchases (snapshot_id, buyer_id);

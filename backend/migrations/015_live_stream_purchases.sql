-- ============================================================
-- KASOLIFE — Migration 015 : Directs payants (PPV live)
-- Ajoute un prix optionnel sur live_streams et une table
-- d'achat live_stream_purchases (copie structurelle de post_purchases).
-- ============================================================

-- Prix optionnel sur live_streams (NULL = direct gratuit)
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS price_xcon INTEGER DEFAULT NULL;
COMMENT ON COLUMN live_streams.price_xcon IS 'Prix en XCON pour accéder au direct (NULL = gratuit)';

-- Table d'achat d'accès à un direct payant
CREATE TABLE IF NOT EXISTS live_stream_purchases (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  live_stream_id  UUID        NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  buyer_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price_xcon      INTEGER     NOT NULL,
  commission_xcon INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(live_stream_id, buyer_id)
);

COMMENT ON TABLE live_stream_purchases IS 'Achats de tickets d''accès à un direct payant';

CREATE INDEX IF NOT EXISTS idx_lsp_buyer  ON live_stream_purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_lsp_stream ON live_stream_purchases(live_stream_id);

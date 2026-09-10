-- ============================================================
-- KASOLIFE — Migration 0023 : Custom Requests
-- Fan soumet une demande de contenu avec budget proposé.
-- Créateur accepte, contre-propose ou refuse.
-- Wallet fan débité à la soumission, crédité créateur à la confirmation.
-- Litiges → résolution manuelle admin uniquement.
-- ============================================================

-- ── Statuts possibles ─────────────────────────────────────────
-- PENDING          : demande soumise, en attente de réponse créateur
-- COUNTER_PROPOSED : créateur a fait une contre-proposition
-- ACCEPTED         : prix accepté (fan ou créateur)
-- REJECTED         : refusé par créateur → remboursement automatique
-- CANCELLED        : annulé par le fan avant acceptation → remboursement
-- IN_PROGRESS      : créateur en cours de création
-- DELIVERED        : contenu livré, attente confirmation fan (72h max)
-- CONFIRMED        : fan a confirmé → paiement créateur libéré
-- DISPUTED         : litige ouvert → résolution admin manuelle
-- REFUNDED         : remboursé par admin

CREATE TABLE IF NOT EXISTS custom_requests (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  fan_id               UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Description de ce que le fan veut
  description          TEXT        NOT NULL,
  -- Prix proposé par le fan (débité immédiatement)
  budget_xcon          INTEGER     NOT NULL CHECK (budget_xcon > 0),
  -- Contre-proposition du créateur
  counter_price_xcon   INTEGER     CHECK (counter_price_xcon > 0),
  -- Prix final accepté par les deux parties
  agreed_price_xcon    INTEGER     CHECK (agreed_price_xcon > 0),
  -- Commission retenue sur le prix final
  commission_xcon      INTEGER     NOT NULL DEFAULT 0,
  status               VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                         CHECK (status IN (
                           'PENDING','COUNTER_PROPOSED','ACCEPTED','REJECTED',
                           'CANCELLED','IN_PROGRESS','DELIVERED','CONFIRMED',
                           'DISPUTED','REFUNDED'
                         )),
  -- Expiration de la demande si créateur ne répond pas
  expires_at           TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  -- Métadonnées de livraison
  delivered_at         TIMESTAMPTZ,
  confirmed_at         TIMESTAMPTZ,
  -- Auto-confirmation 72h après livraison si fan ne répond pas
  auto_confirm_at      TIMESTAMPTZ,
  -- Motif de refus/litige
  rejection_reason     TEXT,
  dispute_reason       TEXT,
  disputed_by          VARCHAR(10) CHECK (disputed_by IN ('fan', 'creator')),
  -- Résolution admin
  admin_resolution     TEXT,
  resolved_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at          TIMESTAMPTZ,
  -- Timestamps
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Livraisons de contenu par le créateur ────────────────────
CREATE TABLE IF NOT EXISTS custom_request_deliveries (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id   UUID        NOT NULL REFERENCES custom_requests(id) ON DELETE CASCADE,
  media_url    TEXT        NOT NULL,
  thumbnail_url TEXT,
  message      TEXT,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Config platform ──────────────────────────────────────────
INSERT INTO platform_config (key, value, value_type, description)
VALUES
  ('custom_request_min_price_xcon',    '1000',  'integer', 'Prix minimum d''une custom request (XAF)'),
  ('custom_request_max_price_xcon',    '500000','integer', 'Prix maximum d''une custom request (XAF)'),
  ('custom_request_expiry_days',       '7',     'integer', 'Délai en jours avant expiration d''une demande sans réponse'),
  ('custom_request_auto_confirm_hours','72',    'integer', 'Délai en heures avant auto-confirmation après livraison')
ON CONFLICT (key) DO NOTHING;

-- ── Index ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_custom_requests_fan
  ON custom_requests (fan_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_custom_requests_creator
  ON custom_requests (creator_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_custom_requests_pending
  ON custom_requests (creator_id, created_at DESC)
  WHERE status IN ('PENDING','COUNTER_PROPOSED');

CREATE INDEX IF NOT EXISTS idx_custom_requests_disputed
  ON custom_requests (status, created_at DESC)
  WHERE status = 'DISPUTED';

CREATE INDEX IF NOT EXISTS idx_custom_request_deliveries
  ON custom_request_deliveries (request_id);

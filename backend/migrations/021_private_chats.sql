-- ============================================================
-- KASOLIFE — Migration 0021 : Private Chat 1-to-1
-- Forfaits fixes (15/30/45/60 min), pas de facturation à la minute.
-- Débit total au départ → remboursement prorata si session courte.
-- Cam2Cam : fan doit activer sa webcam, créateur peut refuser sinon.
-- AUCUN CRON — sessions nettoyées à la connexion / reconnexion.
-- ============================================================

-- ── Table des sessions Private Chat ─────────────────────────
CREATE TABLE IF NOT EXISTS private_chats (
  id                     UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fan_id                 UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Nom de room LiveKit (format : private-chat-{uuid})
  room_name              VARCHAR(100) UNIQUE,
  -- Forfait choisi (minutes)
  package_minutes        INTEGER      NOT NULL CHECK (package_minutes IN (15, 30, 45, 60)),
  price_xcon             INTEGER      NOT NULL CHECK (price_xcon > 0),
  price_per_minute_xcon  INTEGER      NOT NULL CHECK (price_per_minute_xcon > 0),
  commission_xcon        INTEGER      NOT NULL DEFAULT 0,
  -- Workflow : PENDING → ACTIVE → ENDED
  --            PENDING → REJECTED | CANCELLED (timeout ou annulation fan)
  status                 VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                           CHECK (status IN ('PENDING','ACTIVE','ENDED','REJECTED','CANCELLED')),
  -- Cam2Cam
  cam2cam_required       BOOLEAN      NOT NULL DEFAULT FALSE,
  fan_cam_active_at      TIMESTAMPTZ,  -- premier instant où la webcam fan a été détectée active
  -- Timestamps
  request_expires_at     TIMESTAMPTZ, -- le créateur doit accepter avant cette date
  started_at             TIMESTAMPTZ,
  ended_at               TIMESTAMPTZ,
  -- Durée et remboursement
  actual_duration_seconds INTEGER,
  refund_xcon            INTEGER      NOT NULL DEFAULT 0,
  -- Motif de refus/annulation
  rejection_reason       TEXT,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Prix des forfaits dans platform_config ───────────────────
-- Stockés comme clés admin-configurables (prix plancher) :
--   private_chat_price_15min, _30min, _45min, _60min
INSERT INTO platform_config (key, value, value_type, description)
VALUES
  ('private_chat_price_15min', '5000',  'integer', 'Prix forfait Private Chat 15 min (XAF)'),
  ('private_chat_price_30min', '9000',  'integer', 'Prix forfait Private Chat 30 min (XAF)'),
  ('private_chat_price_45min', '12500', 'integer', 'Prix forfait Private Chat 45 min (XAF)'),
  ('private_chat_price_60min', '15000', 'integer', 'Prix forfait Private Chat 60 min (XAF)'),
  ('private_chat_request_timeout_min', '5', 'integer', 'Délai (minutes) pour qu''un créateur accepte une demande'),
  ('private_chat_cam2cam_grace_seconds', '30', 'integer', 'Délai (s) accordé au fan pour activer sa cam en mode Cam2Cam')
ON CONFLICT (key) DO NOTHING;

-- ── Index ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_private_chats_creator
  ON private_chats (creator_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_private_chats_fan
  ON private_chats (fan_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_private_chats_pending
  ON private_chats (creator_id, request_expires_at)
  WHERE status = 'PENDING';

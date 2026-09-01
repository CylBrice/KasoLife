-- ============================================================
-- Migration 005: Broadcasts (mass messaging/PPV)
-- Phase 1 - Feature 5: Creator broadcast messaging
-- ============================================================

CREATE TABLE IF NOT EXISTS broadcasts (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id      UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(100) NOT NULL,
  content         TEXT    NOT NULL CHECK (char_length(content) <= 1000),
  broadcast_type  VARCHAR(20) NOT NULL CHECK (broadcast_type IN ('FREE', 'SUBSCRIBERS_ONLY', 'PPV')),
  price_xcon      BIGINT  DEFAULT 0,
  recipient_count INTEGER DEFAULT 0,
  sent_count      INTEGER DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED')),
  scheduled_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  broadcast_id    UUID    NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  recipient_id    UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'OPENED')),
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(broadcast_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_creator ON broadcasts(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON broadcasts(status) WHERE status IN ('SCHEDULED', 'SENDING');
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_broadcast ON broadcast_recipients(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_status ON broadcast_recipients(status);

COMMENT ON TABLE broadcasts IS 'Mass messaging/PPV broadcasts from creators to subscribers';
COMMENT ON COLUMN broadcasts.broadcast_type IS 'FREE=all followers, SUBSCRIBERS_ONLY=paid subscribers, PPV=paid individually';

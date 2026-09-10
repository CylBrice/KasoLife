-- ============================================================
-- Migration 014 : Direct (livestream) — MVP
-- Une room LiveKit par direct ; les cadeaux en direct réutilisent
-- la table tips existante (même sémantique qu'un pourboire sur un
-- post, origine différente) plutôt qu'une nouvelle table dédiée.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE live_stream_status AS ENUM ('LIVE','ENDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS live_streams (
  id            UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id    UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_name     VARCHAR(80) NOT NULL UNIQUE,
  title         VARCHAR(120),
  status        live_stream_status NOT NULL DEFAULT 'LIVE',
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at      TIMESTAMPTZ,
  peak_viewers  INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_streams_status ON live_streams(status) WHERE status = 'LIVE';
CREATE INDEX IF NOT EXISTS idx_live_streams_creator ON live_streams(creator_id);

-- Cadeaux envoyés pendant un direct = pourboires avec une origine "live"
ALTER TABLE tips ADD COLUMN IF NOT EXISTS live_stream_id UUID REFERENCES live_streams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tips_live_stream ON tips(live_stream_id) WHERE live_stream_id IS NOT NULL;

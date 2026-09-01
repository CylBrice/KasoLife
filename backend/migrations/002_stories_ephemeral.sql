-- ============================================================
-- Migration 002: Stories (ephemeral 24h content)
-- Phase 1 - Feature 2: Stories with auto-delete + analytics
-- ============================================================

-- Create stories table
CREATE TABLE IF NOT EXISTS stories (
  id            UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id    UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_url     TEXT    NOT NULL,
  media_type    post_media_type NOT NULL DEFAULT 'IMAGE',
  thumbnail_url TEXT,
  caption       TEXT,
  access_level  post_access_level NOT NULL DEFAULT 'SUBSCRIBERS',
  price_xcon    BIGINT  NOT NULL DEFAULT 0,
  views_count   INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + interval '24 hours'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create story views tracking
CREATE TABLE IF NOT EXISTS story_views (
  id        UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id  UUID    NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id   UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(story_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_stories_creator ON stories(creator_id, created_at DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_story_views_story ON story_views(story_id);
CREATE INDEX IF NOT EXISTS idx_story_views_user ON story_views(user_id);

-- Trigger to update stories.views_count when view is added
CREATE OR REPLACE FUNCTION update_story_views_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE stories SET views_count = views_count + 1 WHERE id = NEW.story_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_story_views_count
AFTER INSERT ON story_views
FOR EACH ROW
EXECUTE FUNCTION update_story_views_count();

-- Function to auto-expire stories (run via cron job)
CREATE OR REPLACE FUNCTION expire_old_stories()
RETURNS TABLE (expired_count INTEGER) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE stories
  SET is_active = false
  WHERE expires_at <= NOW() AND is_active = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE stories IS 'Ephemeral 24h content. Auto-expires and marked inactive.';
COMMENT ON COLUMN stories.expires_at IS 'Automatic expiration timestamp (NOW + 24 hours)';
COMMENT ON COLUMN stories.is_active IS 'Set to false by expire_old_stories() cron job';
COMMENT ON TABLE story_views IS 'Tracks which users have viewed each story for analytics';
COMMENT ON FUNCTION expire_old_stories() IS 'Call via cron job: SELECT expire_old_stories();';

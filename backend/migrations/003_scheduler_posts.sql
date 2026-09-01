-- ============================================================
-- Migration 003: Post Scheduler (publish at scheduled time)
-- Phase 1 - Feature 3: Scheduled posts
-- ============================================================

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- Index simple sur scheduled_at pour accélérer le cron job
CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts(scheduled_at)
WHERE is_published = false AND scheduled_at IS NOT NULL;

COMMENT ON COLUMN posts.scheduled_at IS 'If set, post is published automatically at this time. Null = publish immediately.';

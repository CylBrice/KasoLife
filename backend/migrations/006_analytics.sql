-- ============================================================
-- Migration 006: Advanced analytics
-- Phase 1 - Feature 6: Creator analytics dashboard
-- ============================================================

-- Materialized view for daily aggregates (creator stats)
CREATE MATERIALIZED VIEW IF NOT EXISTS creator_daily_stats AS
SELECT
  c.user_id as creator_id,
  DATE(p.created_at) as date,
  COUNT(DISTINCT p.id) as posts_created,
  COALESCE(SUM(p.likes_count), 0) as likes_total,
  COALESCE(SUM(p.comments_count), 0) as comments_total,
  COUNT(DISTINCT pl.user_id) as unique_likers,
  COALESCE(COUNT(DISTINCT s.fan_id), 0) as new_subscriptions,
  COALESCE(SUM(CASE WHEN pp.id IS NOT NULL THEN pp.price_xcon ELSE 0 END), 0) as ppv_revenue,
  COALESCE(SUM(CASE WHEN t.type = 'TIP_RECEIVED' THEN t.amount_xcon ELSE 0 END), 0) as tips_revenue
FROM creator_profiles c
LEFT JOIN posts p ON c.user_id = p.creator_id AND p.is_published = true
LEFT JOIN post_likes pl ON p.id = pl.post_id
LEFT JOIN subscriptions s ON c.user_id = s.creator_id AND DATE(s.created_at) = DATE(p.created_at)
LEFT JOIN post_purchases pp ON p.id = pp.post_id
LEFT JOIN transactions t ON c.user_id = t.related_user_id AND t.type = 'TIP_RECEIVED' AND DATE(t.created_at) = DATE(p.created_at)
GROUP BY c.user_id, DATE(p.created_at);

CREATE INDEX IF NOT EXISTS idx_creator_daily_stats_creator ON creator_daily_stats(creator_id, date DESC);

-- View for retention metrics
CREATE OR REPLACE VIEW creator_retention_metrics AS
SELECT
  c.user_id as creator_id,
  COUNT(DISTINCT s.fan_id) as total_subscribers,
  COALESCE(SUM(CASE WHEN s.status = 'ACTIVE' THEN 1 ELSE 0 END), 0) as active_subscribers,
  COALESCE(SUM(CASE WHEN s.status IN ('CANCELLED', 'EXPIRED') THEN 1 ELSE 0 END), 0) as churned_subscribers,
  ROUND(100.0 * SUM(CASE WHEN s.status = 'ACTIVE' THEN 1 ELSE 0 END) / NULLIF(COUNT(DISTINCT s.fan_id), 0), 2) as retention_rate
FROM creator_profiles c
LEFT JOIN subscriptions s ON c.user_id = s.creator_id
GROUP BY c.user_id;

-- Table for analytics snapshots (used for historical reports)
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id                UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id        UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start      DATE    NOT NULL,
  period_end        DATE    NOT NULL,
  posts_count       INTEGER NOT NULL DEFAULT 0,
  likes_count       INTEGER NOT NULL DEFAULT 0,
  comments_count    INTEGER NOT NULL DEFAULT 0,
  subscriptions_new INTEGER NOT NULL DEFAULT 0,
  subscriptions_churned INTEGER NOT NULL DEFAULT 0,
  revenue_ppv       BIGINT  NOT NULL DEFAULT 0,
  revenue_tips      BIGINT  NOT NULL DEFAULT 0,
  revenue_subscriptions BIGINT NOT NULL DEFAULT 0,
  top_post_id       UUID    REFERENCES posts(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(creator_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_creator ON analytics_snapshots(creator_id, period_start DESC);

COMMENT ON MATERIALIZED VIEW creator_daily_stats IS 'Daily aggregates for creator performance. Refresh regularly via cron.';
COMMENT ON VIEW creator_retention_metrics IS 'Current retention & churn metrics for each creator';
COMMENT ON TABLE analytics_snapshots IS 'Historical analytics snapshots for reporting (weekly/monthly)';

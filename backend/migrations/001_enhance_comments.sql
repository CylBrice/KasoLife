-- ============================================================
-- Migration 001: Enhance post_comments for threading and likes
-- Phase 1 - Feature 1: Comments with threading support
-- ============================================================

-- Add parent_id for threaded replies
ALTER TABLE post_comments
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Create table for comment likes (similar to post_likes)
CREATE TABLE IF NOT EXISTS comment_likes (
  id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID    NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
  user_id    UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_comments_parent ON post_comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_post_comments_user ON post_comments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user ON comment_likes(user_id);

-- Create trigger to update posts.comments_count when comment is added/deleted
CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_post_comments_count
AFTER INSERT OR DELETE ON post_comments
FOR EACH ROW
EXECUTE FUNCTION update_post_comments_count();

-- Create function to get comment thread (comment + all replies flattened)
CREATE OR REPLACE FUNCTION get_comment_thread(p_comment_id UUID)
RETURNS TABLE (
  id UUID,
  post_id UUID,
  user_id UUID,
  parent_id UUID,
  content TEXT,
  likes_count INTEGER,
  is_pinned BOOLEAN,
  is_flagged BOOLEAN,
  created_at TIMESTAMPTZ,
  depth INTEGER,
  user_pseudo VARCHAR,
  user_avatar_url TEXT
) AS $$
  WITH RECURSIVE comment_tree AS (
    -- Base case: the comment itself
    SELECT c.*, u.pseudo, u.avatar_url, 0 as depth
    FROM post_comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.id = p_comment_id

    UNION ALL

    -- Recursive case: replies to this comment
    SELECT c.*, u.pseudo, u.avatar_url, ct.depth + 1
    FROM post_comments c
    JOIN users u ON c.user_id = u.id
    JOIN comment_tree ct ON c.parent_id = ct.id
    WHERE ct.depth < 10 -- Limit nesting to avoid infinite loops
  )
  SELECT
    comment_tree.id,
    comment_tree.post_id,
    comment_tree.user_id,
    comment_tree.parent_id,
    comment_tree.content,
    comment_tree.likes_count,
    comment_tree.is_pinned,
    comment_tree.is_flagged,
    comment_tree.created_at,
    comment_tree.depth,
    comment_tree.pseudo,
    comment_tree.avatar_url
  FROM comment_tree
  ORDER BY created_at ASC;
$$ LANGUAGE SQL;

COMMENT ON TABLE post_comments IS 'Posts comments with threading support. parent_id enables nested replies.';
COMMENT ON COLUMN post_comments.parent_id IS 'If set, this comment is a reply to another comment (threading)';
COMMENT ON COLUMN post_comments.is_pinned IS 'If true, creator pinned this comment to the top';
COMMENT ON TABLE comment_likes IS 'Likes on individual comments, separate from post likes';
COMMENT ON FUNCTION get_comment_thread(UUID) IS 'Recursively fetches a comment and all its replies in a thread';

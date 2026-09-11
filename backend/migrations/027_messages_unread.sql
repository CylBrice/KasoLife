-- Migration 027 : indicateur messages non lus
-- Ajoute is_read sur messages + index pour comptage rapide

ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;

-- Les messages envoyés par soi-même sont considérés "lus" d'emblée
UPDATE messages SET is_read = TRUE WHERE sender_id = receiver_id;

CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON messages (receiver_id, is_read)
  WHERE is_read = FALSE;

-- ============================================================
-- Migration 010 : Ajout colonne fcm_token pour notifications web FCM
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT;

COMMENT ON COLUMN users.fcm_token IS 'Token FCM Firebase pour notifications push web';

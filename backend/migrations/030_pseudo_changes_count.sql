-- ============================================================
-- Migration 030 : compteur de changements de pseudo
-- Limite : 5 changements max à vie pour les utilisateurs standard
-- Les rôles super_admin et root_admin sont exemptés
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pseudo_changes_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN users.pseudo_changes_count IS
  'Nombre de fois que le pseudo a été changé. Max 5 pour les utilisateurs standard (super_admin et root_admin exemptés).';

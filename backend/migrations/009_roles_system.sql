-- ============================================================
-- Migration 009 — Système de rôles KasoLife
-- Remplace USER/CREATOR/ADMIN/SUPERADMIN par
-- user / influencer / admin / super_admin / root_admin
-- ============================================================

-- 1. Créer le nouveau type enum
CREATE TYPE user_role_new AS ENUM (
  'user',
  'influencer',
  'admin',
  'super_admin',
  'root_admin'
);

-- 2. Ajouter colonne temporaire avec le nouveau type
ALTER TABLE users ADD COLUMN role_new user_role_new;

-- 3. Migrer les valeurs existantes
UPDATE users SET role_new = CASE
  WHEN role = 'USER'       THEN 'user'::user_role_new
  WHEN role = 'CREATOR'    THEN 'influencer'::user_role_new
  WHEN role = 'ADMIN'      THEN 'admin'::user_role_new
  WHEN role = 'SUPERADMIN' THEN 'super_admin'::user_role_new
  ELSE 'user'::user_role_new
END;

-- 4. Remplacer l'ancienne colonne
ALTER TABLE users DROP COLUMN role;
ALTER TABLE users RENAME COLUMN role_new TO role;
ALTER TABLE users ALTER COLUMN role SET NOT NULL;
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';

-- 5. Supprimer l'ancien enum si existait
DROP TYPE IF EXISTS user_role;

-- 6. Renommer le nouveau type
ALTER TYPE user_role_new RENAME TO user_role;

-- 7. Index sur le rôle (utile pour les requêtes admin)
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 8. Seed du compte root_admin unique
-- Mot de passe : KasoLife@Root2026! (bcrypt 12 rounds) — à changer après première connexion
INSERT INTO users (
  id,
  email,
  phone,
  pseudo,
  name,
  password_hash,
  role,
  birth_date,
  country_iso,
  language,
  is_active,
  kyc_status,
  kyc_attempts,
  email_confirmed,
  email_notifs,
  twofa_enabled,
  created_at,
  updated_at
)
SELECT
  '5e1ba0cc-da93-4f02-8483-dd25f6901460',
  'root@kasolife.com',
  '+237000000001',
  'root_admin',
  'Root Admin',
  '$2a$12$pK81d2wSiXtP2cIRmMt8i.LLacC1H1UO94eP2KutIKXBe3yUpID1y',
  'root_admin',
  '1990-01-01',
  'CM',
  'fr',
  true,
  'VERIFIED',
  0,
  true,
  true,
  false,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE role = 'root_admin'
);

-- 9. Contrainte d'unicité : un seul root_admin
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_root_admin_unique
  ON users(role)
  WHERE role = 'root_admin';

-- 10. Mise à jour des logs d'audit (uniquement si la table existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    UPDATE audit_logs SET
      details = REPLACE(details::text, '"USER"',       '"user"')::jsonb,
      details = REPLACE(details::text, '"CREATOR"',    '"influencer"')::jsonb,
      details = REPLACE(details::text, '"ADMIN"',      '"admin"')::jsonb,
      details = REPLACE(details::text, '"SUPERADMIN"', '"super_admin"')::jsonb
    WHERE details IS NOT NULL;
  END IF;
END $$;

-- ============================================================
-- Vérification post-migration
-- ============================================================
-- SELECT role, COUNT(*) FROM users GROUP BY role ORDER BY role;
-- SELECT * FROM users WHERE role = 'root_admin';

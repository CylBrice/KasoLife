-- ============================================================
-- KASOLIFE — Schéma de base de données (PostgreSQL / Supabase)
-- Version 1.0 — adapté depuis KasoLife
-- Plateforme de créateurs de contenu — catégories "safe" uniquement
-- ============================================================


-- ============================================================
-- 0. EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- 1. TYPES ENUM
-- ============================================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('USER','CREATOR','ADMIN','SUPERADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE kyc_status_type AS ENUM ('PENDING','VERIFIED','FAILED','SUPPORT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM (
    'DEPOT','DEPOT_PENDING','RETRAIT','RETRAIT_PENDING',
    'SUBSCRIPTION_PAYMENT','SUBSCRIPTION_INCOME',
    'TIP_SENT','TIP_RECEIVED',
    'PPV_PAYMENT','PPV_INCOME',
    'COMMISSION_PLATEFORME','COMMISSION_RETRAIT',
    'REMBOURSEMENT','BONUS_PARRAINAGE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE post_access_level AS ENUM ('FREE','SUBSCRIBERS','PPV');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE post_media_type AS ENUM ('TEXT','IMAGE','VIDEO','AUDIO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('ACTIVE','CANCELLED','EXPIRED','PAST_DUE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payout_status AS ENUM ('PENDING','PROCESSING','PAID','FAILED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE maintenance_status AS ENUM ('ACTIF','READ_ONLY','MAINTENANCE','FORCE_MAINTENANCE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE creator_application_status AS ENUM ('PENDING','APPROVED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- 2. UTILISATEURS & SÉCURITÉ
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id                      UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone                   VARCHAR(255)  UNIQUE NOT NULL,
  name                    VARCHAR(255)  NOT NULL,
  password_hash           TEXT          NOT NULL,
  pseudo                  VARCHAR(20)   UNIQUE NOT NULL,
  avatar_url              TEXT,
  banner_url              TEXT,
  bio                     TEXT,
  country_iso             CHAR(2)       NOT NULL,
  language                CHAR(2)       NOT NULL DEFAULT 'fr',
  role                    user_role     NOT NULL DEFAULT 'USER',
  is_active               BOOLEAN       NOT NULL DEFAULT true,
  birth_date              DATE          NOT NULL, -- vérification majorité (>=18 ans) obligatoire
  referred_by             UUID          REFERENCES users(id) ON DELETE SET NULL,
  expo_push_token         TEXT,
  last_active             TIMESTAMPTZ   DEFAULT NOW(),
  -- KYC — requis pour devenir CREATOR (paiements/retraits)
  kyc_status              kyc_status_type NOT NULL DEFAULT 'PENDING',
  kyc_attempts            INTEGER       NOT NULL DEFAULT 0,
  kyc_verified_at         TIMESTAMPTZ,
  kyc_didit_ref           VARCHAR(128),
  kyc_document_url        TEXT,
  kyc_validated_at        TIMESTAMPTZ,
  kyc_validated_by        UUID          REFERENCES users(id) ON DELETE SET NULL,
  -- Email
  email                   VARCHAR(255),
  email_confirmed         BOOLEAN       NOT NULL DEFAULT false,
  email_confirmed_at      TIMESTAMPTZ,
  email_notifs            BOOLEAN       NOT NULL DEFAULT true,
  -- Mobile Money (legacy/quickref)
  mobile_money_phone      TEXT,
  mobile_money_op         VARCHAR(20),
  -- Sécurité
  phone_changed_at        TIMESTAMPTZ,
  twofa_method            VARCHAR(10)   CHECK (twofa_method IN ('sms','email')),
  twofa_enabled           BOOLEAN       NOT NULL DEFAULT false,
  -- Suspension / modération
  suspension_reason       VARCHAR(255),
  suspended_by            UUID          REFERENCES users(id) ON DELETE SET NULL,
  suspended_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN users.kyc_status IS 'PENDING = non vérifié | VERIFIED = pièce validée | FAILED = échec | SUPPORT = traitement manuel';
COMMENT ON COLUMN users.phone IS 'Chiffré AES-256-GCM côté serveur avant insertion';
COMMENT ON COLUMN users.name  IS 'Chiffré AES-256-GCM côté serveur avant insertion';
COMMENT ON COLUMN users.role  IS 'USER=fan | CREATOR=créateur de contenu | ADMIN=modérateur | SUPERADMIN=accès total';


CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(64) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent  TEXT,
  ip_address  VARCHAR(45),
  device_hash VARCHAR(32)
);


CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      VARCHAR(6)  NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS phone_verification_tokens (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      VARCHAR(255) NOT NULL,
  token      VARCHAR(6)   NOT NULL,
  expires_at TIMESTAMPTZ  NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email      VARCHAR(255) NOT NULL,
  token      VARCHAR(6)   NOT NULL,
  expires_at TIMESTAMPTZ  NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS user_mobile_money (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operator   VARCHAR(20) NOT NULL,
  phone      TEXT    NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_mobile_money_user_op_phone UNIQUE (user_id, operator, phone)
);


-- ============================================================
-- 3. WALLET & TRANSACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS wallets (
  id                  UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID    UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance_xcon        BIGINT  NOT NULL DEFAULT 0 CHECK (balance_xcon >= 0), -- solde disponible (FCFA)
  pending_balance_xcon BIGINT NOT NULL DEFAULT 0 CHECK (pending_balance_xcon >= 0), -- revenus créateur en attente de déblocage
  total_deposited     BIGINT  NOT NULL DEFAULT 0,
  total_withdrawn     BIGINT  NOT NULL DEFAULT 0,
  total_earned        BIGINT  NOT NULL DEFAULT 0, -- cumul revenus créateur (brut)
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS transactions (
  id            UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID             NOT NULL REFERENCES users(id),
  type          transaction_type NOT NULL,
  amount_xcon   BIGINT           NOT NULL DEFAULT 0,
  balance_after BIGINT           NOT NULL DEFAULT 0,
  description   TEXT,
  gateway_ref   VARCHAR(100),
  gateway       VARCHAR(20),
  related_user_id UUID           REFERENCES users(id), -- ex: l'abonné qui paie / le créateur qui reçoit
  related_post_id UUID,
  status        VARCHAR(20)      DEFAULT 'SUCCESS',
  created_at    TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS platform_revenue (
  id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_type  VARCHAR(30) NOT NULL, -- COMMISSION_ABONNEMENT | COMMISSION_TIP | COMMISSION_PPV | COMMISSION_RETRAIT
  amount_xcon  BIGINT  NOT NULL,
  reference_id UUID,
  user_id      UUID    REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS payouts (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id      UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_xcon     BIGINT  NOT NULL CHECK (amount_xcon > 0),
  commission_xcon BIGINT  NOT NULL DEFAULT 0,
  net_amount_xcon BIGINT  NOT NULL,
  method          VARCHAR(20) NOT NULL CHECK (method IN ('MOBILE_MONEY','BANK')),
  operator        VARCHAR(20),
  phone           TEXT,
  status          payout_status NOT NULL DEFAULT 'PENDING',
  gateway_ref     VARCHAR(100),
  processed_by    UUID    REFERENCES users(id) ON DELETE SET NULL,
  processed_at    TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 4. CATÉGORIES & PROFILS CRÉATEURS
-- ============================================================

CREATE TABLE IF NOT EXISTS categories (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(50) NOT NULL UNIQUE,
  slug        VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  icon        VARCHAR(50),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Catégories "safe" par défaut
INSERT INTO categories (name, slug, description, icon) VALUES
  ('Fitness & Sport',   'fitness',   'Programmes d''entraînement, nutrition, motivation',     'dumbbell'),
  ('Musique',           'musique',   'Morceaux exclusifs, sessions, tutoriels',               'music'),
  ('Coaching & Formation','coaching','Cours, mentorat, développement personnel',              'graduation-cap'),
  ('Art & Design',      'art',       'Illustrations, processus créatif, tutoriels',           'palette'),
  ('Cuisine',           'cuisine',   'Recettes, techniques culinaires',                       'chef-hat'),
  ('Mode & Beauté',     'mode',      'Tendances, conseils, looks',                            'sparkles'),
  ('Gaming',            'gaming',    'Gameplay, astuces, contenu exclusif',                   'gamepad-2'),
  ('Business & Tech',   'business',  'Entrepreneuriat, conseils business, tech',              'briefcase')
ON CONFLICT (slug) DO NOTHING;


CREATE TABLE IF NOT EXISTS creator_profiles (
  id                  UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID    UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id         UUID    NOT NULL REFERENCES categories(id),
  display_name        VARCHAR(100) NOT NULL,
  subscription_price_xcon BIGINT NOT NULL DEFAULT 1000 CHECK (subscription_price_xcon >= 0),
  welcome_message     TEXT,
  is_verified_badge   BOOLEAN NOT NULL DEFAULT false, -- badge "vérifié" affiché publiquement
  subscribers_count   INTEGER NOT NULL DEFAULT 0,
  posts_count         INTEGER NOT NULL DEFAULT 0,
  total_likes         INTEGER NOT NULL DEFAULT 0,
  is_accepting_subs   BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS creator_applications (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id     UUID    NOT NULL REFERENCES categories(id),
  display_name    VARCHAR(100) NOT NULL,
  motivation      TEXT,
  status          creator_application_status NOT NULL DEFAULT 'PENDING',
  reviewed_by     UUID    REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 5. CONTENU (POSTS)
-- ============================================================

CREATE TABLE IF NOT EXISTS posts (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id      UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id     UUID    NOT NULL REFERENCES categories(id),
  caption         TEXT,
  media_type      post_media_type NOT NULL DEFAULT 'TEXT',
  media_url       TEXT,
  thumbnail_url   TEXT,
  access_level    post_access_level NOT NULL DEFAULT 'SUBSCRIBERS',
  price_xcon      BIGINT  NOT NULL DEFAULT 0 CHECK (price_xcon >= 0), -- prix si PPV
  likes_count     INTEGER NOT NULL DEFAULT 0,
  comments_count  INTEGER NOT NULL DEFAULT 0,
  is_published    BOOLEAN NOT NULL DEFAULT true,
  is_flagged      BOOLEAN NOT NULL DEFAULT false, -- signalé par modération
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_creator ON posts(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category_id) WHERE is_published = true;


CREATE TABLE IF NOT EXISTS post_likes (
  id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    UUID    NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);


CREATE TABLE IF NOT EXISTS post_comments (
  id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    UUID    NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT    NOT NULL CHECK (char_length(content) <= 1000),
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS post_purchases (
  id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    UUID    NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  buyer_id   UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price_xcon BIGINT  NOT NULL,
  commission_xcon BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, buyer_id)
);


-- ============================================================
-- 6. ABONNEMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  fan_id          UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id      UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price_xcon      BIGINT  NOT NULL,
  status          subscription_status NOT NULL DEFAULT 'ACTIVE',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,
  cancelled_at    TIMESTAMPTZ,
  auto_renew      BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(fan_id, creator_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_creator ON subscriptions(creator_id) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_subscriptions_renewal ON subscriptions(current_period_end) WHERE status = 'ACTIVE' AND auto_renew = true;


-- ============================================================
-- 7. MESSAGERIE & TIPS
-- ============================================================

CREATE TABLE IF NOT EXISTS messages (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id   UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT,
  media_url   TEXT,
  price_xcon  BIGINT  NOT NULL DEFAULT 0, -- 0 = gratuit, >0 = PPV
  is_paid     BOOLEAN NOT NULL DEFAULT false,
  paid_by     UUID    REFERENCES users(id) ON DELETE SET NULL,
  is_flagged  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, receiver_id, created_at);


CREATE TABLE IF NOT EXISTS tips (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id   UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id     UUID    REFERENCES posts(id) ON DELETE SET NULL,
  amount_xcon BIGINT  NOT NULL CHECK (amount_xcon > 0),
  commission_xcon BIGINT NOT NULL DEFAULT 0,
  message     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 8. MODÉRATION, ADMIN, SUPPORT
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_actions (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID    NOT NULL REFERENCES users(id),
  action      VARCHAR(50) NOT NULL,
  target_type VARCHAR(30),
  target_id   UUID,
  reason      TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS content_reports (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('POST','COMMENT','MESSAGE','USER')),
  target_id   UUID    NOT NULL,
  reason      TEXT    NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 300),
  status      VARCHAR(20) NOT NULL DEFAULT 'PENDING'
              CHECK (status IN ('PENDING','REVIEWED','DISMISSED','ACTIONED')),
  reviewed_by UUID    REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS notifications (
  id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID    NOT NULL REFERENCES users(id),
  title      TEXT    NOT NULL,
  message    TEXT    NOT NULL,
  type       VARCHAR(30) DEFAULT 'INFO',
  is_read    BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS support_messages (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role     VARCHAR(20) NOT NULL CHECK (sender_role IN ('USER','ADMIN')),
  admin_id        UUID    REFERENCES users(id) ON DELETE SET NULL,
  parent_id       UUID    REFERENCES support_messages(id) ON DELETE SET NULL,
  message         TEXT    NOT NULL CHECK (char_length(message) <= 500),
  status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING','READ','REPLIED')),
  conv_status     VARCHAR(10) NOT NULL DEFAULT 'OPEN'
                  CHECK (conv_status IN ('OPEN','CLOSED')),
  priority        VARCHAR(10) NOT NULL DEFAULT 'LOW'
                  CHECK (priority IN ('LOW','MEDIUM','HIGH','URGENT')),
  is_auto         BOOLEAN     NOT NULL DEFAULT false,
  auto_response_id VARCHAR(10),
  conv_closed_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 9. PLATEFORME : config, maintenance, logs paiement
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_config (
  key         VARCHAR(60) PRIMARY KEY,
  value       TEXT        NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID        REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO platform_config (key, value, description) VALUES
  ('MAINTENANCE_STATUS', 'ACTIF', 'Statut de maintenance global'),
  ('SUBSCRIPTION_COMMISSION_RATE', '0.20', 'Commission plateforme sur abonnements'),
  ('TIP_COMMISSION_RATE', '0.20', 'Commission plateforme sur pourboires'),
  ('PPV_COMMISSION_RATE', '0.20', 'Commission plateforme sur contenu payant à l''unité'),
  ('AI_CONTENT_MODERATION_ENABLED', 'false', 'Scan IA des médias uploadés (détection contenu inapproprié)'),
  ('AI_TEXT_MODERATION_ENABLED', 'true', 'Modération IA des messages et commentaires (spam/harcèlement)'),
  ('AI_REPORT_TRIAGE_ENABLED', 'true', 'Triage IA automatique des signalements par gravité'),
  ('AI_AUTO_TAGGING_ENABLED', 'true', 'Génération IA de mots-clés/tags sur les nouveaux posts'),
  ('AI_FRAUD_DETECTION_ENABLED', 'true', 'Détection IA d''anomalies sur les transactions')
ON CONFLICT (key) DO NOTHING;


CREATE TABLE IF NOT EXISTS platform_maintenance (
  id                     UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  status                 TEXT    NOT NULL DEFAULT 'ACTIF'
                         CHECK (status IN ('ACTIF','READ_ONLY','MAINTENANCE','FORCE_MAINTENANCE')),
  triggered_by           UUID    REFERENCES users(id) ON DELETE SET NULL,
  triggered_at           TIMESTAMPTZ,
  restored_by            UUID    REFERENCES users(id) ON DELETE SET NULL,
  restored_at            TIMESTAMPTZ,
  is_emergency           BOOLEAN NOT NULL DEFAULT false,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS maintenance_history (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  type         VARCHAR(20) NOT NULL CHECK (type IN ('NORMALE','URGENCE','AUTO')),
  from_status  TEXT    NOT NULL,
  to_status    TEXT    NOT NULL,
  triggered_by UUID    REFERENCES users(id) ON DELETE SET NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  restored_at  TIMESTAMPTZ,
  notes        TEXT
);


CREATE TABLE IF NOT EXISTS exchange_rates (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  currency     VARCHAR(5)    NOT NULL UNIQUE,
  rate_to_xcon NUMERIC(10,4) NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_by   UUID    REFERENCES users(id) ON DELETE SET NULL
);


CREATE TABLE IF NOT EXISTS cinetpay_logs (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  direction   VARCHAR(10) NOT NULL CHECK (direction IN ('IN','OUT')),
  type        VARCHAR(30) NOT NULL,
  gateway_ref TEXT,
  amount_fcfa BIGINT,
  user_id     UUID    REFERENCES users(id) ON DELETE SET NULL,
  status      VARCHAR(20),
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 10. PARRAINAGE
-- ============================================================

CREATE TABLE IF NOT EXISTS influencer_codes (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code             VARCHAR(30) NOT NULL UNIQUE,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  uses_total       INTEGER     NOT NULL DEFAULT 0,
  uses_today       INTEGER     NOT NULL DEFAULT 0,
  uses_today_reset DATE        NOT NULL DEFAULT CURRENT_DATE,
  max_uses_day     INTEGER     NOT NULL DEFAULT 25,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS referral_tracking (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  parrain_id           UUID        NOT NULL REFERENCES users(id),
  filleul_id           UUID        NOT NULL REFERENCES users(id),
  code                 VARCHAR(30) NOT NULL,
  bonus_filleul_given  BOOLEAN     NOT NULL DEFAULT false,
  bonus_parrain_given  BOOLEAN     NOT NULL DEFAULT false,
  first_deposit_at     TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(filleul_id)
);


-- ============================================================
-- 11. FAVORIS / BOOKMARKS
-- ============================================================

CREATE TABLE IF NOT EXISTS creator_bookmarks (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, creator_id)
);


-- ============================================================
-- FIN DU SCHÉMA
-- ============================================================

-- ============================================================
-- 12. FONCTIONS RPC — opérations wallet atomiques
-- ============================================================

-- Débit du solde disponible (paiement abonnement, tip, ppv, retrait)
CREATE OR REPLACE FUNCTION debit_wallet(p_user_id UUID, p_amount BIGINT)
RETURNS BIGINT AS $$
DECLARE v_balance BIGINT;
BEGIN
  SELECT balance_xcon INTO v_balance FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Wallet introuvable : %', p_user_id; END IF;
  IF v_balance < p_amount THEN RAISE EXCEPTION 'Solde insuffisant : % dispo, % requis', v_balance, p_amount; END IF;
  UPDATE wallets SET balance_xcon = balance_xcon - p_amount, updated_at = NOW() WHERE user_id = p_user_id;
  RETURN v_balance - p_amount;
END;
$$ LANGUAGE plpgsql;


-- Crédit du solde disponible (dépôt, remboursement)
CREATE OR REPLACE FUNCTION credit_wallet(p_user_id UUID, p_amount BIGINT)
RETURNS BIGINT AS $$
DECLARE v_balance BIGINT;
BEGIN
  SELECT balance_xcon INTO v_balance FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Wallet introuvable : %', p_user_id; END IF;
  UPDATE wallets SET balance_xcon = balance_xcon + p_amount, updated_at = NOW()
  WHERE user_id = p_user_id RETURNING balance_xcon INTO v_balance;
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql;


-- Crédit du solde "en attente" créateur (revenus abonnements/tips/ppv avant déblocage)
CREATE OR REPLACE FUNCTION credit_pending_balance(p_user_id UUID, p_amount BIGINT)
RETURNS BIGINT AS $$
DECLARE v_balance BIGINT;
BEGIN
  UPDATE wallets
  SET pending_balance_xcon = pending_balance_xcon + p_amount,
      total_earned = total_earned + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id RETURNING pending_balance_xcon INTO v_balance;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Wallet introuvable : %', p_user_id; END IF;
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql;


-- Transfert pending -> disponible (déblocage périodique des revenus créateur)
CREATE OR REPLACE FUNCTION release_pending_balance(p_user_id UUID, p_amount BIGINT)
RETURNS BIGINT AS $$
DECLARE v_pending BIGINT;
BEGIN
  SELECT pending_balance_xcon INTO v_pending FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_pending IS NULL THEN RAISE EXCEPTION 'Wallet introuvable : %', p_user_id; END IF;
  IF v_pending < p_amount THEN RAISE EXCEPTION 'Solde en attente insuffisant : % dispo, % requis', v_pending, p_amount; END IF;
  UPDATE wallets
  SET pending_balance_xcon = pending_balance_xcon - p_amount,
      balance_xcon = balance_xcon + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;
  RETURN v_pending - p_amount;
END;
$$ LANGUAGE plpgsql;


-- Incrémente total_deposited après dépôt confirmé
CREATE OR REPLACE FUNCTION increment_total_deposited(p_user_id UUID, p_amount BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE wallets SET total_deposited = total_deposited + p_amount, updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;


-- Incrémente total_withdrawn après retrait confirmé
CREATE OR REPLACE FUNCTION increment_total_withdrawn(p_user_id UUID, p_amount BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE wallets SET total_withdrawn = total_withdrawn + p_amount, updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;


-- Incrémente le compteur d'abonnés d'un créateur
CREATE OR REPLACE FUNCTION increment_subscribers_count(p_creator_id UUID, p_delta INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE creator_profiles SET subscribers_count = GREATEST(0, subscribers_count + p_delta), updated_at = NOW()
  WHERE user_id = p_creator_id;
END;
$$ LANGUAGE plpgsql;


-- Incrémente le compteur de posts d'un créateur
CREATE OR REPLACE FUNCTION increment_posts_count(p_creator_id UUID, p_delta INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE creator_profiles SET posts_count = GREATEST(0, posts_count + p_delta), updated_at = NOW()
  WHERE user_id = p_creator_id;
END;
$$ LANGUAGE plpgsql;


-- Incrémente likes/comments sur un post
CREATE OR REPLACE FUNCTION increment_post_likes(p_post_id UUID, p_delta INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE posts SET likes_count = GREATEST(0, likes_count + p_delta) WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_post_comments(p_post_id UUID, p_delta INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE posts SET comments_count = GREATEST(0, comments_count + p_delta) WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 13. SUPABASE STORAGE — Buckets requis (à créer manuellement
-- via Dashboard → Storage, ou via l'API Storage)
-- ============================================================
-- Buckets : avatars (public), banners (public), thumbnails (public), posts (public)
-- Politique recommandée pour chaque bucket :
--   - SELECT (lecture) : public (true) — le contenu PPV/SUBSCRIBERS est protégé
--     au niveau applicatif (URL signée non générée tant que has_access=false côté API)
--   - INSERT/UPDATE/DELETE : authenticated, limité au préfixe {auth.uid()}/...
--
-- Exemple de policy SQL (à exécuter dans Storage → Policies) :
--
-- CREATE POLICY "Public read avatars" ON storage.objects
--   FOR SELECT USING (bucket_id = 'avatars');
--
-- CREATE POLICY "Users upload own avatar" ON storage.objects
--   FOR INSERT WITH CHECK (
--     bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
--   );
--
-- Répéter pour banners, thumbnails, posts.

-- ============================================================
-- 14. FONCTIONNALITÉS IA
-- ============================================================

-- Tags générés automatiquement pour amélioration de la recherche/recommandation
ALTER TABLE posts ADD COLUMN IF NOT EXISTS ai_tags TEXT[] DEFAULT '{}';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'NOT_SCANNED'
  CHECK (moderation_status IN ('NOT_SCANNED', 'APPROVED', 'FLAGGED', 'REJECTED'));
ALTER TABLE posts ADD COLUMN IF NOT EXISTS moderation_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_posts_ai_tags ON posts USING GIN (ai_tags);

-- Triage automatique des signalements (gravité estimée par IA)
ALTER TABLE content_reports ADD COLUMN IF NOT EXISTS ai_severity TEXT
  CHECK (ai_severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));
ALTER TABLE content_reports ADD COLUMN IF NOT EXISTS ai_summary TEXT;

-- Signalements automatiques de transactions suspectes (détection d'anomalies)
CREATE TABLE IF NOT EXISTS fraud_flags (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flag_type   TEXT    NOT NULL, -- ex: RAPID_DEPOSIT_WITHDRAW, REFERRAL_ABUSE, LINKED_ACCOUNTS
  severity    TEXT    NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  details     JSONB   NOT NULL DEFAULT '{}',
  status      TEXT    NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REVIEWED', 'DISMISSED', 'ACTIONED')),
  reviewed_by UUID    REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_flags_status ON fraud_flags(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_user ON fraud_flags(user_id);

-- ============================================================
-- 15. AUTOMATISATIONS IA — PHASE 2
-- ============================================================

-- Toggles supplémentaires
INSERT INTO platform_config (key, value, description) VALUES
  ('AI_FAN_REMINDERS_ENABLED', 'true', 'Rappels IA aux fans inactifs (nouveaux contenus de leurs créateurs)'),
  ('AI_CHURN_PREDICTION_ENABLED', 'true', 'Détection IA de désabonnement imminent (fans) et de créateurs en perte de vitesse'),
  ('AI_CREATOR_DIGEST_ENABLED', 'true', 'Résumés hebdomadaires IA pour les créateurs'),
  ('AI_TRANSLATION_ENABLED', 'true', 'Traduction à la demande des messages/commentaires'),
  ('AI_DISTRESS_DETECTION_ENABLED', 'true', 'Détection IA de langage de détresse dans les messages'),
  ('AI_CATEGORY_CONSISTENCY_ENABLED', 'true', 'Vérification IA de cohérence catégorie/contenu des posts'),
  ('AI_DUPLICATE_CONTENT_ENABLED', 'true', 'Détection IA de contenu dupliqué/volé'),
  ('AI_THUMBNAIL_AB_TESTING_ENABLED', 'false', 'Test A/B automatique des vignettes vidéo (sélection optimale)'),
  ('AI_SENTIMENT_ANALYSIS_ENABLED', 'true', 'Analyse de sentiment des commentaires pour les créateurs'),
  ('AI_KYC_CONSISTENCY_ENABLED', 'true', 'Détection IA d''incohérences KYC (pays déclaré vs usage)'),
  ('AI_CHARGEBACK_DETECTION_ENABLED', 'true', 'Détection IA de réclamations PPV abusives')
ON CONFLICT (key) DO NOTHING;

-- Rappels fans inactifs — éviter les doublons/spam de notifications
CREATE TABLE IF NOT EXISTS fan_reminders (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fan_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL, -- ex: NEW_CONTENT, RENEWAL_SOON
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(fan_id, creator_id, reason, sent_at)
);
CREATE INDEX IF NOT EXISTS idx_fan_reminders_fan ON fan_reminders(fan_id, sent_at DESC);

-- Score de risque de désabonnement par abonnement
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS churn_risk TEXT
  CHECK (churn_risk IN ('LOW', 'MEDIUM', 'HIGH'));
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS churn_risk_updated_at TIMESTAMPTZ;

-- Score de risque de désengagement créateur
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS activity_risk TEXT
  CHECK (activity_risk IN ('LOW', 'MEDIUM', 'HIGH'));
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS activity_risk_updated_at TIMESTAMPTZ;

-- Résumés hebdomadaires créateurs
CREATE TABLE IF NOT EXISTS creator_digests (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  stats       JSONB NOT NULL DEFAULT '{}',
  summary_text TEXT,
  suggestions  TEXT[],
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(creator_id, period_start)
);
CREATE INDEX IF NOT EXISTS idx_creator_digests_creator ON creator_digests(creator_id, period_start DESC);

-- Vérification de cohérence catégorie/contenu — signalements
ALTER TABLE posts ADD COLUMN IF NOT EXISTS category_mismatch BOOLEAN NOT NULL DEFAULT false;

-- Détection de contenu dupliqué — empreinte perceptuelle simplifiée (hash)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS content_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_posts_content_hash ON posts(content_hash) WHERE content_hash IS NOT NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES posts(id) ON DELETE SET NULL;

-- A/B testing de vignettes
CREATE TABLE IF NOT EXISTS thumbnail_variants (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  thumbnail_url TEXT NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks      INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_thumbnail_variants_post ON thumbnail_variants(post_id);

-- Analyse de sentiment des commentaires
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS sentiment TEXT
  CHECK (sentiment IN ('POSITIVE', 'NEUTRAL', 'NEGATIVE'));

-- Incohérences KYC détectées
CREATE TABLE IF NOT EXISTS kyc_consistency_flags (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  details     JSONB NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REVIEWED', 'DISMISSED')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kyc_consistency_status ON kyc_consistency_flags(status, created_at DESC);

-- Réclamations PPV abusives
CREATE TABLE IF NOT EXISTS chargeback_flags (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  details     JSONB NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REVIEWED', 'DISMISSED', 'ACTIONED')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chargeback_flags_status ON chargeback_flags(status, created_at DESC);

-- Réclamations PPV (table de support si non existante — un fan peut "réclamer" un achat PPV)
CREATE TABLE IF NOT EXISTS ppv_disputes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fan_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id     UUID REFERENCES posts(id) ON DELETE SET NULL,
  message_id  UUID REFERENCES messages(id) ON DELETE SET NULL,
  reason      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ppv_disputes_fan ON ppv_disputes(fan_id, created_at DESC);

-- Coûts des appels IA (Claude) — suivi des dépenses API
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature       VARCHAR(60),          -- ex: MODERATE_IMAGE, GENERATE_CAPTION, TRIAGE_REPORT
  model         VARCHAR(30) NOT NULL DEFAULT 'claude-haiku-4-5',
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd      NUMERIC(10,6) NOT NULL DEFAULT 0,
  triggered_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created ON ai_usage_log(created_at DESC);

-- ============================================================
-- KASOLIFE — Migration 0016 : Extension platform_config
-- La table platform_config existe déjà. On ajoute :
--   1. Colonne value_type pour le casting côté service
--   2. Mise à jour des value_type des clés existantes
--   3. Nouvelles clés commission + bonus bienvenue + Fan Club + watermark
-- ============================================================

-- 1. Ajouter la colonne value_type si elle n'existe pas encore
ALTER TABLE platform_config
  ADD COLUMN IF NOT EXISTS value_type VARCHAR(20) NOT NULL DEFAULT 'string';

-- 2. Mettre à jour le value_type des clés existantes
UPDATE platform_config SET value_type = 'float'   WHERE key IN (
  'SUBSCRIPTION_COMMISSION_RATE', 'TIP_COMMISSION_RATE', 'PPV_COMMISSION_RATE'
);
UPDATE platform_config SET value_type = 'boolean' WHERE key IN (
  'AI_CONTENT_MODERATION_ENABLED', 'AI_TEXT_MODERATION_ENABLED',
  'AI_REPORT_TRIAGE_ENABLED',       'AI_AUTO_TAGGING_ENABLED',
  'AI_FRAUD_DETECTION_ENABLED'
);

-- 3. Nouvelles clés commission (snake_case, compatibles ConfigService)
INSERT INTO platform_config (key, value, value_type, description) VALUES
  ('commission_subscription',    '0.20',  'float',   'Commission sur abonnements (%)'),
  ('commission_tip',             '0.20',  'float',   'Commission sur pourboires (%)'),
  ('commission_ppv',             '0.20',  'float',   'Commission sur contenu PPV (%)'),
  ('commission_withdrawal',      '0.015', 'float',   'Commission sur retraits créateurs (%)'),
  ('commission_prerecorded',     '0.15',  'float',   'Commission sur contenu pré-enregistré / albums (%)'),
  ('commission_fanclub',         '0.15',  'float',   'Commission sur Fan Club (%)'),
  ('commission_referral',        '0.10',  'float',   'Commission sur parrainage membres (%)'),
  ('commission_welcome_rate',    '0.10',  'float',   'Taux commission pendant la période de bienvenue (%)'),
  ('commission_welcome_days',    '30',    'integer', 'Durée période de bienvenue (jours depuis 1er contenu publié)')
ON CONFLICT (key) DO NOTHING;

-- 4. Bonus bienvenue créateur
INSERT INTO platform_config (key, value, value_type, description) VALUES
  ('bonus_welcome_enabled',          'false',  'boolean', 'Activer les bonus bienvenue créateur'),
  ('bonus_welcome_threshold_1_xcon', '150000', 'integer', 'Gains bruts seuil 1 pour déclencher le bonus (XAF)'),
  ('bonus_welcome_amount_1_xcon',    '25000',  'integer', 'Montant bonus seuil 1 crédité sur wallet créateur (XAF)'),
  ('bonus_welcome_threshold_2_xcon', '500000', 'integer', 'Gains bruts seuil 2 pour déclencher le bonus (XAF)'),
  ('bonus_welcome_amount_2_xcon',    '50000',  'integer', 'Montant bonus seuil 2 crédité sur wallet créateur (XAF)'),
  ('bonus_welcome_period_2_days',    '60',     'integer', 'Délai max pour atteindre le seuil 2 (jours depuis 1er contenu)')
ON CONFLICT (key) DO NOTHING;

-- 5. Prix planchers Fan Club
INSERT INTO platform_config (key, value, value_type, description) VALUES
  ('fanclub_level_1_min_price_xcon', '1500', 'integer', 'Prix minimum Fan Club niveau 1 (XAF)'),
  ('fanclub_level_2_min_price_xcon', '4000', 'integer', 'Prix minimum Fan Club niveau 2 (XAF)'),
  ('fanclub_level_3_min_price_xcon', '8000', 'integer', 'Prix minimum Fan Club niveau 3 (XAF)')
ON CONFLICT (key) DO NOTHING;

-- 6. Watermark (utilisé en Phase 1 étapes 1.4/1.5)
INSERT INTO platform_config (key, value, value_type, description) VALUES
  ('watermark_visible_enabled',   'true', 'boolean', 'Activer le watermark visible (ID user + timestamp)'),
  ('watermark_invisible_enabled', 'true', 'boolean', 'Activer le watermark invisible (stéganographie)')
ON CONFLICT (key) DO NOTHING;

-- Index si pas encore présent
CREATE INDEX IF NOT EXISTS idx_platform_config_key ON platform_config(key);

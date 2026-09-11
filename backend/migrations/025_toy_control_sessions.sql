-- ============================================================
-- KASOLIFE — Migration 025 : Toy Control Sessions & Paliers
--
-- Remplace le registre in-mémoire (toyRegistry Map) par persistance DB.
-- Paliers imposés par plateforme (anti-abus).
-- Sessions créateur : active/inactive avec config.
-- ============================================================

-- ── Paliers imposés par plateforme ──────────────────────────
-- Format : toy_palier_<N>_<prop>
-- Chaque palier : montant_min, montant_max, durée_s, intensité_min, intensité_max
INSERT INTO platform_config (key, value, value_type, description) VALUES
  -- Palier 1 : 1-9 XAF → 2s, intensité 20-40%
  ('toy_palier_1_amount_min_xcon',    '1',    'integer', 'Palier 1 : montant minimum (XAF)'),
  ('toy_palier_1_amount_max_xcon',    '9',    'integer', 'Palier 1 : montant maximum (XAF)'),
  ('toy_palier_1_duration_seconds',   '2',    'integer', 'Palier 1 : durée vibration (secondes)'),
  ('toy_palier_1_intensity_min',      '20',   'integer', 'Palier 1 : intensité minimum (%)'),
  ('toy_palier_1_intensity_max',      '40',   'integer', 'Palier 1 : intensité maximum (%)'),

  -- Palier 2 : 10-24 XAF → 5s, intensité 40-60%
  ('toy_palier_2_amount_min_xcon',    '10',   'integer', 'Palier 2 : montant minimum (XAF)'),
  ('toy_palier_2_amount_max_xcon',    '24',   'integer', 'Palier 2 : montant maximum (XAF)'),
  ('toy_palier_2_duration_seconds',   '5',    'integer', 'Palier 2 : durée vibration (secondes)'),
  ('toy_palier_2_intensity_min',      '40',   'integer', 'Palier 2 : intensité minimum (%)'),
  ('toy_palier_2_intensity_max',      '60',   'integer', 'Palier 2 : intensité maximum (%)'),

  -- Palier 3 : 25-99 XAF → 10s, intensité 60-75%
  ('toy_palier_3_amount_min_xcon',    '25',   'integer', 'Palier 3 : montant minimum (XAF)'),
  ('toy_palier_3_amount_max_xcon',    '99',   'integer', 'Palier 3 : montant maximum (XAF)'),
  ('toy_palier_3_duration_seconds',   '10',   'integer', 'Palier 3 : durée vibration (secondes)'),
  ('toy_palier_3_intensity_min',      '60',   'integer', 'Palier 3 : intensité minimum (%)'),
  ('toy_palier_3_intensity_max',      '75',   'integer', 'Palier 3 : intensité maximum (%)'),

  -- Palier 4 : 100-499 XAF → 40s, intensité 75-90%
  ('toy_palier_4_amount_min_xcon',    '100',  'integer', 'Palier 4 : montant minimum (XAF)'),
  ('toy_palier_4_amount_max_xcon',    '499',  'integer', 'Palier 4 : montant maximum (XAF)'),
  ('toy_palier_4_duration_seconds',   '40',   'integer', 'Palier 4 : durée vibration (secondes)'),
  ('toy_palier_4_intensity_min',      '75',   'integer', 'Palier 4 : intensité minimum (%)'),
  ('toy_palier_4_intensity_max',      '90',   'integer', 'Palier 4 : intensité maximum (%)'),

  -- Palier 5 : 500-899 XAF → 160s, intensité 80-100%
  ('toy_palier_5_amount_min_xcon',    '500',  'integer', 'Palier 5 : montant minimum (XAF)'),
  ('toy_palier_5_amount_max_xcon',    '899',  'integer', 'Palier 5 : montant maximum (XAF)'),
  ('toy_palier_5_duration_seconds',   '160',  'integer', 'Palier 5 : durée vibration (secondes)'),
  ('toy_palier_5_intensity_min',      '80',   'integer', 'Palier 5 : intensité minimum (%)'),
  ('toy_palier_5_intensity_max',      '100',  'integer', 'Palier 5 : intensité maximum (%)'),

  -- Palier 6 : 900-1299 XAF → 380s, intensité 90-100%
  ('toy_palier_6_amount_min_xcon',    '900',  'integer', 'Palier 6 : montant minimum (XAF)'),
  ('toy_palier_6_amount_max_xcon',    '1299', 'integer', 'Palier 6 : montant maximum (XAF)'),
  ('toy_palier_6_duration_seconds',   '380',  'integer', 'Palier 6 : durée vibration (secondes)'),
  ('toy_palier_6_intensity_min',      '90',   'integer', 'Palier 6 : intensité minimum (%)'),
  ('toy_palier_6_intensity_max',      '100',  'integer', 'Palier 6 : intensité maximum (%)'),

  -- Palier 7 : 1300+ XAF → 600s, intensité max
  ('toy_palier_7_amount_min_xcon',    '1300', 'integer', 'Palier 7 : montant minimum (XAF)'),
  ('toy_palier_7_amount_max_xcon',    '999999', 'integer', 'Palier 7 : montant maximum (XAF)'),
  ('toy_palier_7_duration_seconds',   '600',  'integer', 'Palier 7 : durée vibration (secondes)'),
  ('toy_palier_7_intensity_min',      '100',  'integer', 'Palier 7 : intensité minimum (%)'),
  ('toy_palier_7_intensity_max',      '100',  'integer', 'Palier 7 : intensité maximum (%)')
ON CONFLICT (key) DO NOTHING;

-- ── Sessions jouet créateur ────────────────────────────────────
-- Créateur active/désactive pendant un live
-- Persiste la config pour l'historique
CREATE TABLE IF NOT EXISTS toy_sessions (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id            UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  live_stream_id        UUID        REFERENCES live_streams(id) ON DELETE SET NULL,
  is_active             BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Config au moment de l'activation (snapshot des paliers appliqués)
  palier_config_version INTEGER     NOT NULL DEFAULT 1,
  -- Historique
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at              TIMESTAMPTZ,
  tips_count            INTEGER     NOT NULL DEFAULT 0,
  tips_total_xcon       INTEGER     NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_toy_sessions_creator
  ON toy_sessions (creator_id, is_active);

CREATE INDEX IF NOT EXISTS idx_toy_sessions_live_stream
  ON toy_sessions (live_stream_id, is_active);

-- ── Référence des paliers (historique versionnage) ──────────────
-- En cas de changement admin des paliers, on crée une nouvelle version
-- pour audit trail
CREATE TABLE IF NOT EXISTS toy_paliers_versions (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  version       INTEGER     NOT NULL UNIQUE,
  paliers_json  JSONB       NOT NULL, -- [{min, max, duration_s, intensity_min, intensity_max}, ...]
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Version initiale (v1)
INSERT INTO toy_paliers_versions (version, paliers_json) VALUES
  (1, '[
    {"palier":1,"min":1,"max":9,"duration_s":2,"intensity_min":20,"intensity_max":40},
    {"palier":2,"min":10,"max":24,"duration_s":5,"intensity_min":40,"intensity_max":60},
    {"palier":3,"min":25,"max":99,"duration_s":10,"intensity_min":60,"intensity_max":75},
    {"palier":4,"min":100,"max":499,"duration_s":40,"intensity_min":75,"intensity_max":90},
    {"palier":5,"min":500,"max":899,"duration_s":160,"intensity_min":80,"intensity_max":100},
    {"palier":6,"min":900,"max":1299,"duration_s":380,"intensity_min":90,"intensity_max":100},
    {"palier":7,"min":1300,"max":999999,"duration_s":600,"intensity_min":100,"intensity_max":100}
  ]'::jsonb)
ON CONFLICT DO NOTHING;

-- Index
CREATE INDEX IF NOT EXISTS idx_toy_paliers_versions_version
  ON toy_paliers_versions (version DESC);

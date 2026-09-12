-- ============================================================
-- Migration 031 — Nouvelles clés platform_config : limites
-- montants, contenu, utilisateurs (précédemment hardcodés)
-- ============================================================

INSERT INTO platform_config (key, value, value_type, description) VALUES
  -- ── Montants financiers ────────────────────────────────
  ('subscription_price_min',        '500',    'integer', 'Prix abonnement mensuel minimum (FCFA)'),
  ('subscription_price_max',        '100000', 'integer', 'Prix abonnement mensuel maximum (FCFA)'),
  ('tip_min',                       '100',    'integer', 'Montant minimum d''un pourboire (FCFA)'),
  ('tip_max',                       '500000', 'integer', 'Montant maximum d''un pourboire (FCFA)'),
  ('ppv_price_min',                 '100',    'integer', 'Prix minimum contenu PPV (FCFA)'),
  ('ppv_price_max',                 '200000', 'integer', 'Prix maximum contenu PPV (FCFA)'),
  ('min_payout_amount',             '5000',   'integer', 'Retrait minimum pour les Lifeurs (FCFA)'),
  ('min_wallet_withdraw_xcon',      '500',    'integer', 'Retrait minimum wallet utilisateur (FCFA)'),
  ('min_deposit_xcon',              '2000',   'integer', 'Dépôt minimum (FCFA)'),
  ('retrait_max_day_xcon',          '1000000','integer', 'Retrait maximum par jour (FCFA)'),
  ('default_subscription_price',    '1000',   'integer', 'Prix d''abonnement par défaut à la création d''un profil Lifeur'),
  ('referral_bonus_fcfa',           '500',    'integer', 'Bonus de parrainage (FCFA)'),
  ('referral_max_per_day',          '25',     'integer', 'Nombre maximum de filleuls comptabilisés par jour'),

  -- ── Limites utilisateur ────────────────────────────────
  ('pseudo_max_changes',            '5',      'integer', 'Nombre maximum de changements de pseudo à vie'),
  ('otp_expiry_minutes',            '10',     'integer', 'Durée de validité des codes OTP SMS (minutes)'),
  ('mobile_money_max_per_operator', '3',      'integer', 'Nombre maximum de numéros MM par opérateur'),
  ('mobile_money_max_total',        '6',      'integer', 'Nombre maximum de numéros MM au total'),
  ('story_duration_hours',          '24',     'integer', 'Durée de vie d''une story (heures)'),

  -- ── Limites de contenu ─────────────────────────────────
  ('max_upload_avatar_mb',          '5',      'integer', 'Taille maximale d''un avatar (Mo)'),
  ('max_upload_banner_mb',          '8',      'integer', 'Taille maximale d''une bannière (Mo)'),
  ('max_upload_image_mb',           '15',     'integer', 'Taille maximale d''une image de post (Mo)'),
  ('max_upload_video_mb',           '200',    'integer', 'Taille maximale d''une vidéo de post (Mo)'),
  ('max_upload_audio_mb',           '50',     'integer', 'Taille maximale d''un audio de post (Mo)'),
  ('max_caption_chars',             '2000',   'integer', 'Longueur maximale d''une légende de post (caractères)'),
  ('max_message_chars',             '2000',   'integer', 'Longueur maximale d''un message privé (caractères)'),
  ('max_comment_chars',             '1000',   'integer', 'Longueur maximale d''un commentaire (caractères)')

ON CONFLICT (key) DO NOTHING;

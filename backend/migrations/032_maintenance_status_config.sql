-- Migration 032 : ajouter la clé maintenance_status dans platform_config
-- La clé était référencée dans le frontend mais absente de la base

INSERT INTO platform_config (key, value, type, description)
VALUES (
  'maintenance_status',
  'false',
  'boolean',
  'Mode maintenance global — désactive l''accès à la plateforme pour les utilisateurs non-admin'
)
ON CONFLICT (key) DO NOTHING;

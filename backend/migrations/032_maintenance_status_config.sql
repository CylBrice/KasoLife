-- Migration 032 : ajouter la cle MAINTENANCE_STATUS dans platform_config
INSERT INTO platform_config (key, value, value_type, description)
VALUES (
  'MAINTENANCE_STATUS',
  'false',
  'boolean',
  'Mode maintenance global'
)
ON CONFLICT (key) DO NOTHING;

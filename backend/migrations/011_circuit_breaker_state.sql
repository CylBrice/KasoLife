-- ============================================================
-- Migration 011 : Circuit breaker state table
-- Persiste l'état des providers de paiement entre les redémarrages
-- ============================================================

CREATE TABLE IF NOT EXISTS circuit_breaker_state (
  provider    VARCHAR(20) PRIMARY KEY,
  disponible  BOOLEAN     NOT NULL DEFAULT true,
  erreurs     JSONB       NOT NULL DEFAULT '[]',
  timeouts    JSONB       NOT NULL DEFAULT '[]',
  next_check  BIGINT      NOT NULL DEFAULT 0,
  tentatives  INTEGER     NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insérer les 3 providers par défaut
INSERT INTO circuit_breaker_state (provider) VALUES
  ('cinetpay'), ('campay'), ('fapshi')
ON CONFLICT (provider) DO NOTHING;

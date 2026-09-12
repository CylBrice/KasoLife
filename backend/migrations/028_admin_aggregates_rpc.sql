-- Migration 028: RPC functions pour agrégats admin (évite charger millions de lignes)

-- Fonction 1: SUM revenue total
CREATE OR REPLACE FUNCTION get_platform_revenue_total()
RETURNS TABLE(total_amount BIGINT) LANGUAGE SQL STABLE AS $$
  SELECT COALESCE(SUM(amount_xcon), 0)::BIGINT as total_amount
  FROM platform_revenue;
$$;

-- Fonction 2: SUM wallets totals
CREATE OR REPLACE FUNCTION get_wallets_totals()
RETURNS TABLE(total_balance BIGINT, total_pending BIGINT) LANGUAGE SQL STABLE AS $$
  SELECT
    COALESCE(SUM(balance_xcon), 0)::BIGINT as total_balance,
    COALESCE(SUM(pending_balance_xcon), 0)::BIGINT as total_pending
  FROM wallets;
$$;

-- Fonction 3: Revenue breakdown par source (agrégé)
CREATE OR REPLACE FUNCTION get_revenue_breakdown(since TIMESTAMPTZ DEFAULT NULL)
RETURNS TABLE(source_type TEXT, total_amount BIGINT) LANGUAGE SQL STABLE AS $$
  SELECT
    source_type,
    COALESCE(SUM(amount_xcon), 0)::BIGINT as total_amount
  FROM platform_revenue
  WHERE since IS NULL OR created_at >= since
  GROUP BY source_type
  ORDER BY total_amount DESC;
$$;

-- Fonction 4: Daily revenue breakdown (pour graphiques)
CREATE OR REPLACE FUNCTION get_daily_revenue_breakdown(since TIMESTAMPTZ DEFAULT NULL)
RETURNS TABLE(date DATE, source_type TEXT, total_amount BIGINT) LANGUAGE SQL STABLE AS $$
  SELECT
    DATE(created_at) as date,
    source_type,
    COALESCE(SUM(amount_xcon), 0)::BIGINT as total_amount
  FROM platform_revenue
  WHERE since IS NULL OR created_at >= since
  GROUP BY DATE(created_at), source_type
  ORDER BY date DESC, total_amount DESC;
$$;

-- ============================================================
-- KASOLIFE — Migration 008 : Plafonds KYC atomiques
-- Corrige une race condition (TOCTOU) : le cumul mensuel dépôt/
-- retrait était lu en JS sans verrou, permettant à deux requêtes
-- concurrentes de dépasser le plafond KYC en même temps.
--
-- Stratégie : verrou consultatif Postgres par (user, type) + une
-- ligne de "réservation" (*_PENDING) insérée atomiquement dans la
-- même transaction que la vérification du plafond. Le retrait
-- réservé compte immédiatement dans le cumul, fermant la course.
-- Si l'opération échoue ensuite (passerelle indisponible), la
-- réservation est supprimée par le backend.
-- ============================================================

CREATE OR REPLACE FUNCTION reserve_kyc_cumul(
  p_user_id      UUID,
  p_type         VARCHAR,   -- 'DEPOT' ou 'RETRAIT'
  p_pending_type VARCHAR,   -- 'DEPOT_PENDING' ou 'RETRAIT_PENDING'
  p_amount       BIGINT,
  p_max_month    BIGINT     -- 0 = illimité
) RETURNS UUID AS $$
DECLARE
  v_since  TIMESTAMPTZ := date_trunc('month', now());
  v_cumul  BIGINT;
  v_id     UUID := gen_random_uuid();
BEGIN
  -- Verrou par utilisateur+type : sérialise les requêtes concurrentes
  -- pour la durée de cette transaction (durée de l'appel RPC).
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || p_type));

  SELECT COALESCE(SUM(amount_xcon), 0) INTO v_cumul
  FROM transactions
  WHERE user_id = p_user_id
    AND type IN (p_type, p_pending_type)
    AND created_at >= v_since;

  IF p_max_month > 0 AND v_cumul + p_amount > p_max_month THEN
    RAISE EXCEPTION 'KYC_LIMIT_EXCEEDED: cumul=% max=%', v_cumul, p_max_month
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO transactions (id, user_id, type, amount_xcon, balance_after, description)
  VALUES (v_id, p_user_id, p_pending_type, p_amount, 0, 'Réservation plafond KYC');

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION reserve_kyc_cumul TO authenticated, service_role;

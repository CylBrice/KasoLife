-- ============================================================
-- KASOLIFE — Migration 007 : Idempotence atomique des dépôts
-- Corrige une faille critique : sans contrainte UNIQUE sur
-- gateway_ref, deux webhooks concurrents (retry CinetPay/Campay/
-- Fapshi) peuvent passer le check SELECT-puis-INSERT en même
-- temps et doubler le crédit du wallet (race condition TOCTOU).
-- ============================================================

-- Un gateway_ref ne doit jamais être utilisé deux fois (par gateway,
-- car deux providers différents pourraient théoriquement générer la
-- même référence). NULL autorisé pour les transactions internes
-- (bonus, achats, tips) qui n'ont pas de gateway_ref.
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_gateway_ref_unique
  ON transactions (gateway, gateway_ref)
  WHERE gateway_ref IS NOT NULL;

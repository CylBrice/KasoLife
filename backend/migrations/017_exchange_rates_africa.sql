-- ============================================================
-- KASOLIFE — Migration 0017 : Devises africaines et mondiales
-- La table exchange_rates existe déjà (currency, rate_to_xcon,
-- is_active, updated_at, updated_by).
-- On insère les devises manquantes avec les taux de référence 2026.
-- rate_to_xcon = nombre de XAF pour 1 unité de la devise.
-- Arrondi appliqué côté service : Math.floor (entier inférieur).
-- ============================================================

-- Devises CFA déjà présentes ou à ajouter
INSERT INTO exchange_rates (currency, rate_to_xcon) VALUES
  ('XAF',  1.0000),   -- Franc CFA Afrique Centrale (base interne)
  ('FCFA', 1.0000),   -- Alias FCFA = XAF
  ('XOF',  1.0000)    -- Franc CFA Afrique de l'Ouest (parité fixe avec XAF)
ON CONFLICT (currency) DO UPDATE SET rate_to_xcon = EXCLUDED.rate_to_xcon, updated_at = NOW();

-- Devises mondiales
INSERT INTO exchange_rates (currency, rate_to_xcon) VALUES
  ('EUR', 655.9570),  -- Taux fixe CFA/EUR (institutionnel)
  ('USD', 615.0000),  -- Dollar US (approximation 2026)
  ('GBP', 785.0000)   -- Livre sterling (approximation 2026)
ON CONFLICT (currency) DO UPDATE SET rate_to_xcon = EXCLUDED.rate_to_xcon, updated_at = NOW();

-- Devises africaines prioritaires
INSERT INTO exchange_rates (currency, rate_to_xcon) VALUES
  ('NGN', 0.3800),    -- Naira nigérian (1 NGN ≈ 0.38 XAF)
  ('GHS', 42.0000),   -- Cedi ghanéen   (1 GHS ≈ 42 XAF)
  ('KES', 4.7000),    -- Shilling kenyan (1 KES ≈ 4.7 XAF)
  ('ZAR', 33.0000)    -- Rand sud-africain (1 ZAR ≈ 33 XAF)
ON CONFLICT (currency) DO UPDATE SET rate_to_xcon = EXCLUDED.rate_to_xcon, updated_at = NOW();

-- Ajouter colonne symbol si elle n'existe pas (affichage frontend)
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS symbol VARCHAR(10) DEFAULT '';
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS name   VARCHAR(60) DEFAULT '';

-- Mettre à jour les symboles et noms pour l'affichage
UPDATE exchange_rates SET symbol = 'FCFA', name = 'Franc CFA Afrique Centrale' WHERE currency IN ('XAF', 'FCFA');
UPDATE exchange_rates SET symbol = 'FCFA', name = 'Franc CFA Afrique de l''Ouest' WHERE currency = 'XOF';
UPDATE exchange_rates SET symbol = '€',    name = 'Euro'                          WHERE currency = 'EUR';
UPDATE exchange_rates SET symbol = '$',    name = 'Dollar US'                     WHERE currency = 'USD';
UPDATE exchange_rates SET symbol = '£',    name = 'Livre sterling'                WHERE currency = 'GBP';
UPDATE exchange_rates SET symbol = '₦',    name = 'Naira nigérian'               WHERE currency = 'NGN';
UPDATE exchange_rates SET symbol = 'GH₵',  name = 'Cedi ghanéen'                 WHERE currency = 'GHS';
UPDATE exchange_rates SET symbol = 'KSh',  name = 'Shilling kenyan'              WHERE currency = 'KES';
UPDATE exchange_rates SET symbol = 'R',    name = 'Rand sud-africain'            WHERE currency = 'ZAR';

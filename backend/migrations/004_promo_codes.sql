-- ============================================================
-- Migration 004: Promo codes & discounts
-- Phase 1 - Feature 4: Creator promo management
-- ============================================================

-- Table for promo codes (created by creators)
CREATE TABLE IF NOT EXISTS promo_codes (
  id               UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id       UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code             VARCHAR(20) NOT NULL,
  discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  discount_amount  BIGINT,  -- Alternative to percent (in FCFA)
  max_uses         INTEGER,  -- NULL = unlimited
  uses_count       INTEGER NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  applies_to       post_access_level NOT NULL DEFAULT 'SUBSCRIBERS', -- SUBSCRIBERS or PPV
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(creator_id, code)
);

-- Table to track promo usage
CREATE TABLE IF NOT EXISTS promo_uses (
  id            UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  promo_code_id UUID    NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id       UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  used_for_type VARCHAR(20) NOT NULL, -- SUBSCRIPTION, PPV_POST, TIP
  amount_saved  BIGINT  NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(promo_code_id, user_id) -- One use per promo per user
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_promo_codes_creator ON promo_codes(creator_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_promo_uses_promo ON promo_uses(promo_code_id);
CREATE INDEX IF NOT EXISTS idx_promo_uses_user ON promo_uses(user_id);

-- Function to validate and apply promo code
CREATE OR REPLACE FUNCTION validate_promo_code(p_code VARCHAR, p_user_id UUID, p_amount BIGINT)
RETURNS TABLE (
  is_valid BOOLEAN,
  discount_amount BIGINT,
  final_amount BIGINT,
  promo_id UUID
) AS $$
DECLARE
  v_promo promo_codes%ROWTYPE;
  v_discount BIGINT;
  v_final BIGINT;
BEGIN
  -- Find active promo code
  SELECT * INTO v_promo FROM promo_codes
  WHERE code = p_code AND is_active = true
  AND (expires_at IS NULL OR expires_at > NOW())
  AND (max_uses IS NULL OR uses_count < max_uses)
  LIMIT 1;

  IF v_promo.id IS NULL THEN
    RETURN QUERY SELECT false, 0::BIGINT, p_amount, NULL::UUID;
    RETURN;
  END IF;

  -- Check if user already used this code
  IF EXISTS (SELECT 1 FROM promo_uses WHERE promo_code_id = v_promo.id AND user_id = p_user_id) THEN
    RETURN QUERY SELECT false, 0::BIGINT, p_amount, NULL::UUID;
    RETURN;
  END IF;

  -- Calculate discount
  IF v_promo.discount_percent IS NOT NULL THEN
    v_discount := (p_amount * v_promo.discount_percent) / 100;
  ELSE
    v_discount := LEAST(v_promo.discount_amount, p_amount);
  END IF;

  v_final := GREATEST(0, p_amount - v_discount);

  RETURN QUERY SELECT true, v_discount, v_final, v_promo.id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE promo_codes IS 'Creator-managed promo codes for subscriptions/PPV discounts';
COMMENT ON COLUMN promo_codes.discount_percent IS 'Percentage discount (e.g., 20 = 20% off)';
COMMENT ON COLUMN promo_codes.discount_amount IS 'Fixed amount discount in FCFA (alternative to percent)';
COMMENT ON FUNCTION validate_promo_code(VARCHAR, UUID, BIGINT) IS 'Validates and calculates discount for a promo code';

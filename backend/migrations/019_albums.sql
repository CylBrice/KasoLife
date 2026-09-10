-- ============================================================
-- KASOLIFE — Migration 0019 : Albums payants
-- Albums photo ou vidéo vendus par les créateurs.
-- Achat = accès permanent à l'état courant de l'album.
-- Vente à l'album entier OU à la pièce isolée.
-- ============================================================

-- ── Table principale des albums ─────────────────────────────
CREATE TABLE IF NOT EXISTS albums (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id   UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        VARCHAR(200) NOT NULL,
  description  TEXT,
  type         VARCHAR(10)  NOT NULL CHECK (type IN ('PHOTO', 'VIDEO')),
  cover_url    TEXT,
  -- Prix de l'album entier en xcon (0 = accès selon access_level sans surcoût)
  price_xcon   INTEGER      NOT NULL DEFAULT 0 CHECK (price_xcon >= 0),
  access_level VARCHAR(20)  NOT NULL DEFAULT 'PPV'
                CHECK (access_level IN ('FREE', 'SUBSCRIBERS', 'PPV')),
  is_published BOOLEAN      NOT NULL DEFAULT FALSE,
  items_count  INTEGER      NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Éléments d'un album (photos ou vidéos) ──────────────────
CREATE TABLE IF NOT EXISTS album_items (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id      UUID        NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  creator_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_url     TEXT        NOT NULL,
  thumbnail_url TEXT,
  title         VARCHAR(200),
  position      INTEGER     NOT NULL DEFAULT 0,
  -- Prix pièce isolée (0 = non vendu individuellement)
  price_xcon    INTEGER     NOT NULL DEFAULT 0 CHECK (price_xcon >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Achats (album entier ou pièce isolée) ───────────────────
CREATE TABLE IF NOT EXISTS album_purchases (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- L'un des deux doit être non-NULL
  album_id         UUID        REFERENCES albums(id) ON DELETE SET NULL,
  item_id          UUID        REFERENCES album_items(id) ON DELETE SET NULL,
  price_paid_xcon  INTEGER     NOT NULL CHECK (price_paid_xcon >= 0),
  commission_xcon  INTEGER     NOT NULL DEFAULT 0,
  purchased_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_album_or_item CHECK (album_id IS NOT NULL OR item_id IS NOT NULL)
);

-- ── Index ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_albums_creator
  ON albums (creator_id, is_published, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_album_items_album
  ON album_items (album_id, position);

CREATE INDEX IF NOT EXISTS idx_album_purchases_buyer
  ON album_purchases (buyer_id, purchased_at DESC);

CREATE INDEX IF NOT EXISTS idx_album_purchases_album
  ON album_purchases (album_id, buyer_id);

CREATE INDEX IF NOT EXISTS idx_album_purchases_item
  ON album_purchases (item_id, buyer_id);

-- ── Trigger : maintenir items_count à jour ──────────────────
CREATE OR REPLACE FUNCTION update_album_items_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE albums SET items_count = items_count + 1, updated_at = NOW()
    WHERE id = NEW.album_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE albums SET items_count = GREATEST(items_count - 1, 0), updated_at = NOW()
    WHERE id = OLD.album_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_album_items_count ON album_items;
CREATE TRIGGER trg_album_items_count
  AFTER INSERT OR DELETE ON album_items
  FOR EACH ROW EXECUTE FUNCTION update_album_items_count();

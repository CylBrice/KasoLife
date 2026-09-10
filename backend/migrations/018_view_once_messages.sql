-- ============================================================
-- KASOLIFE — Migration 0018 : Vue unique messagerie
-- Ajoute le mode "view_once" (WhatsApp-like) aux messages.
-- Les médias en vue unique disparaissent après la première ouverture.
-- ============================================================

-- Colonne pour activer le mode vue unique sur un message
ALTER TABLE messages ADD COLUMN IF NOT EXISTS view_once         BOOLEAN   DEFAULT FALSE;

-- Horodatage de la première ouverture (NULL = jamais vu)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS view_once_opened_at TIMESTAMPTZ DEFAULT NULL;

-- Index pour retrouver rapidement les messages view_once non encore ouverts
CREATE INDEX IF NOT EXISTS idx_messages_view_once
  ON messages (view_once, view_once_opened_at)
  WHERE view_once = TRUE;

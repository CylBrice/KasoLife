-- Ajout colonne gender manquante référencée par auth.js
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS gender character(1)
    CHECK (gender IN ('M', 'F'));

-- Migration 012 : Ajout des champs date de naissance et genre sur les utilisateurs
-- Requis pour la conformité App Store (profil complet) et KYC renforcé

ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(1) CHECK (gender IN ('M', 'F'));

COMMENT ON COLUMN users.birth_date IS 'Date de naissance (vérification 18+ côté serveur)';
COMMENT ON COLUMN users.gender IS 'Genre : M = Masculin, F = Féminin';

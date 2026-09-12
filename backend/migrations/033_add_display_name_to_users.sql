-- Migration 033 : ajouter display_name dans la table users (disponible pour tous les utilisateurs)
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);

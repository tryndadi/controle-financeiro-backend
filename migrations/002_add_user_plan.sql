BEGIN;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS plano TEXT NOT NULL DEFAULT 'free';

ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_plano_check;

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_plano_check
  CHECK (plano IN ('free', 'pro'));

COMMIT;

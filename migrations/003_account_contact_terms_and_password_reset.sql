BEGIN;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS termos_aceitos_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS termos_versao TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_usuarios_reset_token_hash
  ON usuarios(reset_token_hash);

COMMIT;

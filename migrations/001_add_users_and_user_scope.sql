BEGIN;

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE transacoes
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE;

ALTER TABLE limites_cartao
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE;

ALTER TABLE limites_cartao
  DROP CONSTRAINT IF EXISTS limites_cartao_cartao_key;

DROP INDEX IF EXISTS limites_cartao_cartao_key;

CREATE INDEX IF NOT EXISTS idx_transacoes_user_id
  ON transacoes(user_id);

CREATE INDEX IF NOT EXISTS idx_limites_cartao_user_id
  ON limites_cartao(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS limites_cartao_user_cartao_key
  ON limites_cartao(user_id, cartao);

COMMIT;

-- Registros antigos ficam com user_id NULL e nao aparecem para usuarios logados.
-- Se quiser migrar dados antigos para uma conta especifica:
-- UPDATE transacoes SET user_id = <id_do_usuario> WHERE user_id IS NULL;
-- UPDATE limites_cartao SET user_id = <id_do_usuario> WHERE user_id IS NULL;

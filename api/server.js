const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const pool = require("../db");
const path = require("path");
const { authRequired, signToken } = require("./auth");

const app = express();
const PASSWORD_SALT_ROUNDS = 12;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function serializeUser(row) {
  return {
    id: row.id,
    name: row.nome,
    email: row.email,
    plan: row.plano || "free",
  };
}

function serializeTransaction(row) {
  return {
    id: row.id,
    description: row.descricao,
    amount: row.valor,
    type: row.tipo,
    date: row.data,
    origin: row.origem,
  };
}

function validateTransactionPayload(body) {
  const amount = Number(body.valor);
  const validTypes = ["receita", "despesa"];

  if (
    !body.descricao ||
    !body.tipo ||
    !body.data ||
    !Number.isFinite(amount) ||
    !validTypes.includes(body.tipo)
  ) {
    return null;
  }

  return {
    descricao: body.descricao,
    valor: amount,
    tipo: body.tipo,
    origem: body.origem || null,
    data: body.data,
  };
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const nome = String(req.body.nome || "").trim();
    const email = normalizeEmail(req.body.email);
    const senha = String(req.body.senha || "");

    if (!nome || !email || senha.length < 6) {
      return res.status(400).json({
        error: "Informe nome, email e uma senha com pelo menos 6 caracteres",
      });
    }

    const senhaHash = await bcrypt.hash(senha, PASSWORD_SALT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO usuarios (nome, email, senha_hash)
       VALUES ($1, $2, $3)
       RETURNING id, nome, email, plano`,
      [nome, email, senhaHash],
    );

    const user = serializeUser(result.rows[0]);

    return res.status(201).json({
      user,
      token: signToken(user),
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        error: "Este email ja esta cadastrado",
      });
    }

    console.error("Erro ao cadastrar usuario:", error);

    return res.status(500).json({
      error: "Erro ao cadastrar usuario",
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const senha = String(req.body.senha || "");

    if (!email || !senha) {
      return res.status(400).json({
        error: "Informe email e senha",
      });
    }

    const result = await pool.query(
      `SELECT id, nome, email, senha_hash, plano
       FROM usuarios
       WHERE email=$1`,
      [email],
    );

    const userRow = result.rows[0];
    const passwordMatches =
      userRow && (await bcrypt.compare(senha, userRow.senha_hash));

    if (!passwordMatches) {
      return res.status(401).json({
        error: "Email ou senha invalidos",
      });
    }

    const user = serializeUser(userRow);

    return res.json({
      user,
      token: signToken(user),
    });
  } catch (error) {
    console.error("Erro ao fazer login:", error);

    return res.status(500).json({
      error: "Erro ao fazer login",
    });
  }
});

app.get("/api/auth/me", authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nome, email, plano
       FROM usuarios
       WHERE id=$1`,
      [req.user.id],
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        error: "Sessao invalida ou expirada",
      });
    }

    return res.json({
      user: serializeUser(result.rows[0]),
    });
  } catch (error) {
    console.error("Erro ao buscar usuario autenticado:", error);

    return res.status(500).json({
      error: "Erro ao buscar usuario autenticado",
    });
  }
});

app.get("/api/categorias/:tipo", async (req, res) => {
  const { tipo } = req.params;

  const result = await pool.query(
    "SELECT * FROM categorias WHERE tipo=$1 ORDER BY nome",
    [tipo],
  );

  res.json(result.rows);
});

app.get("/api/transacoes", authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      `
            SELECT
                id,
                descricao AS description,
                valor AS amount,
                tipo AS type,
                data::date AS date,
                origem AS origin
            FROM transacoes
            WHERE user_id=$1
            ORDER BY id DESC
        `,
      [req.user.id],
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar transacoes:", error);

    res.status(500).json({
      error: "Erro ao buscar transacoes",
    });
  }
});

app.post("/api/transacoes", authRequired, async (req, res) => {
  const payload = validateTransactionPayload(req.body);

  if (!payload) {
    return res.status(400).json({
      error: "Dados invalidos",
    });
  }

  const result = await pool.query(
    `INSERT INTO transacoes
        (user_id, descricao, valor, tipo, origem, data)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING *`,
    [
      req.user.id,
      payload.descricao,
      payload.valor,
      payload.tipo,
      payload.origem,
      payload.data,
    ],
  );

  res.json(serializeTransaction(result.rows[0]));
});

app.delete("/api/transacoes/:id", authRequired, async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    "DELETE FROM transacoes WHERE id=$1 AND user_id=$2 RETURNING id",
    [id, req.user.id],
  );

  if (result.rowCount === 0) {
    return res.status(404).json({
      error: "Transacao nao encontrada",
    });
  }

  res.status(200).json({ success: true });
});

app.get("/api/limites", authRequired, async (req, res) => {
  const result = await pool.query(
    "SELECT cartao, limite FROM limites_cartao WHERE user_id=$1 ORDER BY cartao",
    [req.user.id],
  );

  res.json(result.rows);
});

app.post("/api/limites", authRequired, async (req, res) => {
  const { cartao, limite } = req.body;
  const numericLimit = Number(limite);

  if (!cartao || !Number.isFinite(numericLimit)) {
    return res.status(400).json({
      error: "Dados invalidos",
    });
  }

  await pool.query(
    `
        INSERT INTO limites_cartao (user_id, cartao, limite)
        VALUES ($1,$2,$3)
        ON CONFLICT (user_id, cartao)
        DO UPDATE SET limite = EXCLUDED.limite
    `,
    [req.user.id, cartao, numericLimit],
  );

  res.json({ success: true });
});

app.put("/api/transacoes/:id", authRequired, async (req, res) => {
  const { id } = req.params;
  const payload = validateTransactionPayload(req.body);

  if (!payload) {
    return res.status(400).json({
      error: "Dados invalidos",
    });
  }

  const result = await pool.query(
    `UPDATE transacoes
         SET descricao=$1,
             valor=$2,
             tipo=$3,
             origem=$4,
             data=$5
         WHERE id=$6 AND user_id=$7
         RETURNING *`,
    [
      payload.descricao,
      payload.valor,
      payload.tipo,
      payload.origem,
      payload.data,
      id,
      req.user.id,
    ],
  );

  if (result.rowCount === 0) {
    return res.status(404).json({
      error: "Transacao nao encontrada",
    });
  }

  res.json(serializeTransaction(result.rows[0]));
});

module.exports = app;

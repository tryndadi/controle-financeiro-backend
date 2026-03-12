const express = require("express");
const cors = require("cors");
const pool = require("../db");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.get("/api/categorias/:tipo", async (req, res) => {
  const { tipo } = req.params;

  const result = await pool.query(
    "SELECT * FROM categorias WHERE tipo=$1 ORDER BY nome",
    [tipo],
  );

  res.json(result.rows);
});

app.get("/api/transacoes", async (req, res) => {
  try {
    const result = await pool.query(`
            SELECT 
                id,
                descricao AS description,
                valor AS amount,
                tipo AS type,
                data::date AS date,
                origem AS origin
            FROM transacoes
            ORDER BY id DESC
        `);

    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar transações:", error);

    res.status(500).json({
      error: "Erro ao buscar transações",
    });
  }
});

app.post("/api/transacoes", async (req, res) => {
  const { descricao, valor, tipo, origem, data } = req.body;

  if (!descricao || !valor || !tipo || !data) {
    return res.status(400).json({
      error: "Dados inválidos",
    });
  }

  const result = await pool.query(
    `INSERT INTO transacoes
        (descricao, valor, tipo, origem, data)
        VALUES ($1,$2,$3,$4,$5)
        RETURNING *`,
    [descricao, valor, tipo, origem, data],
  );

  const row = result.rows[0];

  res.json({
    id: row.id,
    description: row.descricao,
    amount: row.valor,
    type: row.tipo,
    date: row.data,
    origin: row.origem,
  });
});

app.delete("/api/transacoes/:id", async (req, res) => {
  const { id } = req.params;

  await pool.query("DELETE FROM transacoes WHERE id=$1", [id]);

  res.status(200).json({ success: true });
});
// BUSCAR limites
app.get("/api/limites", async (req, res) => {
  const result = await pool.query("SELECT * FROM limites_cartao");

  res.json(result.rows);
});

// SALVAR ou ATUALIZAR limite
app.post("/api/limites", async (req, res) => {
  const { cartao, limite } = req.body;

  await pool.query(
    `
        INSERT INTO limites_cartao (cartao, limite)
        VALUES ($1,$2)
        ON CONFLICT (cartao)
        DO UPDATE SET limite = EXCLUDED.limite
    `,
    [cartao, limite],
  );

  res.json({ success: true });
});

app.put("/api/transacoes/:id", async (req, res) => {
  const { id } = req.params;

  const { descricao, valor, tipo, origem, data } = req.body;

  if (!descricao || !valor || !tipo || !data) {
    return res.status(400).json({
      error: "Dados inválidos",
    });
  }

  const result = await pool.query(
    `UPDATE transacoes
         SET descricao=$1,
             valor=$2,
             tipo=$3,
             origem=$4,
             data=$5
         WHERE id=$6
         RETURNING *`,
    [descricao, valor, tipo, origem, data, id],
  );

  const row = result.rows[0];

  res.json({
    id: row.id,
    description: row.descricao,
    amount: row.valor,
    type: row.tipo,
    date: row.data,
    origin: row.origem,
  });
});

module.exports = app;

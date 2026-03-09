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

app.get("/transacoes", (req, res) => {
    res.json([]);
});

app.get("/api/categorias/:tipo", async (req, res) => {

    const { tipo } = req.params;

    const result = await pool.query(
        "SELECT * FROM categorias WHERE tipo=$1 ORDER BY nome",
        [tipo]
    );

    res.json(result.rows);
});

app.get("/api/transacoes", async (req, res) => {

    const result = await pool.query(
        "SELECT * FROM transacoes ORDER BY id DESC"
    );

    res.json(result.rows);
});

app.post("/api/transacoes", async (req, res) => {

    const { descricao, valor, tipo, origem, data } = req.body;

    const result = await pool.query(
        "INSERT INTO transacoes (descricao, valor, tipo, origem, data) VALUES ($1,$2,$3,$4,$5) RETURNING *",
        [descricao, valor, tipo, origem, data]
    );

    res.json(result.rows[0]);
});

app.delete("/api/transacoes/:id", async (req, res) => {

    const { id } = req.params;

    await pool.query("DELETE FROM transacoes WHERE id=$1", [id]);

    res.json({ success: true });

});
// BUSCAR limites
app.get("/api/limites", async (req, res) => {

    const result = await pool.query(
        "SELECT * FROM limites_cartao"
    );

    res.json(result.rows);

});


// SALVAR ou ATUALIZAR limite
app.post("/api/limites", async (req, res) => {

    const { cartao, limite } = req.body;

    await pool.query(`
        INSERT INTO limites_cartao (cartao, limite)
        VALUES ($1,$2)
        ON CONFLICT (cartao)
        DO UPDATE SET limite = EXCLUDED.limite
    `, [cartao, limite]);

    res.json({ success: true });

});

module.exports = app;
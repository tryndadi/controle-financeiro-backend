const express = require("express");
const cors = require("cors");
const pool = require("./db");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

// Servir arquivos estáticos (HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

// =========================
// ROTAS DA API
// =========================

app.get("/categorias/:tipo", async (req, res) => {
    const { tipo } = req.params;

    const result = await pool.query(
        "SELECT * FROM categorias WHERE tipo=$1 ORDER BY nome",
        [tipo]
    );

    res.json(result.rows);
});

app.get("/transacoes", async (req, res) => {
    const result = await pool.query(
        "SELECT * FROM transacoes ORDER BY id DESC"
    );

    res.json(result.rows);
});

app.post("/transacoes", async (req, res) => {
    try {

        const { descricao, valor, tipo, origem, data } = req.body;

        const result = await pool.query(
            "INSERT INTO transacoes (descricao, valor, tipo, origem, data) VALUES ($1,$2,$3,$4,$5) RETURNING *",
            [descricao, valor, tipo, origem, data]
        );

        res.json(result.rows[0]);

    } catch (error) {

        console.error(error);
        res.status(500).send("Erro ao salvar transação");

    }
});

app.delete("/transacoes/:id", async (req, res) => {

    const { id } = req.params;

    await pool.query(
        "DELETE FROM transacoes WHERE id=$1",
        [id]
    );

    res.json({ message: "Deletado" });

});

// =========================
// FRONTEND
// =========================

app.get("/*", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("Servidor rodando na porta", PORT);
});

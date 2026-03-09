const result = await pool.query("SELECT * FROM limites_cartao");
res.json(result.rows);

await pool.query(`
INSERT INTO limites_cartao (cartao, limite)
VALUES ($1,$2)
ON CONFLICT (cartao)
DO UPDATE SET limite = EXCLUDED.limite
`, [cartao, limite]);
require("dotenv").config();

const { Client } = require("pg");

async function run() {
  const email = String(process.argv[2] || "")
    .trim()
    .toLowerCase();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL nao configurada no .env ou no ambiente");
  }

  if (!process.env.DATABASE_URL.startsWith("postgres")) {
    throw new Error(
      "DATABASE_URL deve ser a string de conexao do PostgreSQL, nao a URL publica do app no Vercel",
    );
  }

  if (!email) {
    throw new Error("Informe o email do usuario: node scripts/assign-legacy-data.js email@exemplo.com");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  await client.connect();

  try {
    const userResult = await client.query(
      "SELECT id, email FROM usuarios WHERE email=$1",
      [email],
    );

    if (userResult.rowCount === 0) {
      throw new Error("Usuario nao encontrado. Crie a conta no app antes de migrar dados antigos.");
    }

    const userId = userResult.rows[0].id;

    await client.query("BEGIN");

    const transactions = await client.query(
      "UPDATE transacoes SET user_id=$1 WHERE user_id IS NULL RETURNING id",
      [userId],
    );

    const cardLimits = await client.query(
      "UPDATE limites_cartao SET user_id=$1 WHERE user_id IS NULL RETURNING cartao",
      [userId],
    );

    await client.query("COMMIT");

    console.log(`Transacoes associadas: ${transactions.rowCount}`);
    console.log(`Limites associados: ${cardLimits.rowCount}`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

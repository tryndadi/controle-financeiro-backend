require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const migrationsDir = path.join(__dirname, "..", "migrations");

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL nao configurada no .env ou no ambiente");
  }

  if (!process.env.DATABASE_URL.startsWith("postgres")) {
    throw new Error(
      "DATABASE_URL deve ser a string de conexao do PostgreSQL, nao a URL publica do app no Vercel",
    );
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  await client.connect();

  try {
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");

      console.log(`Rodando migration: ${file}`);
      await client.query(sql);
    }

    console.log("Migrations concluidas com sucesso.");
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

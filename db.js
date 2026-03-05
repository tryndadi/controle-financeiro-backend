const { Pool } = require("pg");

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "controle_financeiro",
    password: "Sp@cex666",
    port: 5432,
});

module.exports = pool;
require("dotenv").config();

const app = require("./api/server");

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Controle Financeiro rodando em http://localhost:${port}`);
});

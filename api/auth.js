const jwt = require("jsonwebtoken");
const pool = require("../db");

const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "90d";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET precisa estar configurado em producao");
  }

  return secret || "controle-financeiro-dev-secret";
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      sv: Number(user.sessionVersion || 0),
    },
    getJwtSecret(),
    {
      expiresIn: TOKEN_EXPIRES_IN,
    },
  );
}

async function authRequired(req, res, next) {
  const authorization = req.headers.authorization || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      error: "Sessao invalida ou expirada",
    });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    const userId = Number(payload.sub);

    if (!Number.isInteger(userId)) {
      return res.status(401).json({
        error: "Sessao invalida ou expirada",
      });
    }

    const result = await pool.query(
      `SELECT id, email, COALESCE(session_version, 0) AS session_version
       FROM usuarios
       WHERE id=$1`,
      [userId],
    );

    const user = result.rows[0];
    const tokenSessionVersion = Number(payload.sv || 0);

    if (!user || Number(user.session_version || 0) !== tokenSessionVersion) {
      return res.status(401).json({
        error: "Sessao invalida ou expirada",
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      error: "Sessao invalida ou expirada",
    });
  }
}

module.exports = {
  authRequired,
  signToken,
};

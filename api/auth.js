const jwt = require("jsonwebtoken");

const TOKEN_EXPIRES_IN = "7d";

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
    },
    getJwtSecret(),
    {
      expiresIn: TOKEN_EXPIRES_IN,
    },
  );
}

function authRequired(req, res, next) {
  const authorization = req.headers.authorization || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      error: "Sessao invalida ou expirada",
    });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());

    req.user = {
      id: Number(payload.sub),
      email: payload.email,
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

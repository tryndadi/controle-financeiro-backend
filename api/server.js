const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const pool = require("../db");
const path = require("path");
const { authRequired, signToken } = require("./auth");

const app = express();
const PASSWORD_SALT_ROUNDS = 12;
const TERMS_VERSION = "2026-05-22";
const PASSWORD_RESET_MINUTES = 30;
const MIN_PASSWORD_LENGTH = 8;

const DEFAULT_ALLOWED_ORIGINS = [
  "https://controle-financeiro-backend-wkzj.vercel.app",
  "https://localhost",
  "https://127.0.0.1",
  "http://localhost",
  "http://127.0.0.1",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "capacitor://localhost",
  "ionic://localhost",
];

const authRateLimitStore = new Map();

function getAllowedOrigins() {
  const extraOrigins = String(process.env.APP_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...extraOrigins]);
}

function isAllowedOrigin(origin) {
  if (!origin) return true;

  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true;
  }

  return getAllowedOrigins().has(origin);
}

function getClientIp(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "");

  return forwardedFor.split(",")[0].trim() || req.ip || "unknown";
}

function createRateLimiter({ keyPrefix, windowMs, max, message }) {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${keyPrefix}:${getClientIp(req)}`;
    const current = authRateLimitStore.get(key);

    if (authRateLimitStore.size > 5000) {
      for (const [storedKey, value] of authRateLimitStore.entries()) {
        if (value.resetAt <= now) {
          authRateLimitStore.delete(storedKey);
        }
      }
    }

    if (!current || current.resetAt <= now) {
      authRateLimitStore.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });

      return next();
    }

    if (current.count >= max) {
      const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);

      res.setHeader("Retry-After", String(retryAfterSeconds));

      return res.status(429).json({
        error: message,
      });
    }

    current.count += 1;
    authRateLimitStore.set(key, current);

    return next();
  };
}

const registerRateLimit = createRateLimiter({
  keyPrefix: "auth-register",
  windowMs: 60 * 60 * 1000,
  max: 8,
  message: "Muitas tentativas de cadastro. Tente novamente mais tarde.",
});

const loginRateLimit = createRateLimiter({
  keyPrefix: "auth-login",
  windowMs: 15 * 60 * 1000,
  max: 12,
  message: "Muitas tentativas de login. Tente novamente em alguns minutos.",
});

const forgotPasswordRateLimit = createRateLimiter({
  keyPrefix: "auth-forgot-password",
  windowMs: 60 * 60 * 1000,
  max: 5,
  message:
    "Muitas solicitações de redefinição. Aguarde alguns minutos e tente novamente.",
});

const resetPasswordRateLimit = createRateLimiter({
  keyPrefix: "auth-reset-password",
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Muitas tentativas de redefinição. Tente novamente em alguns minutos.",
});

app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' https://controle-financeiro-backend-wkzj.vercel.app",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join("; "),
  );

  next();
});

app.use(
  cors({
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin));
    },
  }),
);
app.use(express.json());

app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function normalizeOptionalText(value) {
  const normalized = String(value || "").trim();

  return normalized || null;
}

function normalizeCpf(value) {
  const digits = String(value || "").replace(/\D/g, "");

  return digits || null;
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getPublicBaseUrl(req) {
  const configuredUrl = process.env.APP_PUBLIC_URL;

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";

  return `${protocol}://${req.get("host")}`;
}

function serializeEmailError(error) {
  return {
    provider: error.emailProvider || "unknown",
    name: error.name,
    message: error.message,
    code: error.code,
    command: error.command,
    responseCode: error.responseCode,
    response: error.response,
  };
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[char];
  });
}

function getEmailLogoUrl(publicBaseUrl) {
  return (
    process.env.EMAIL_LOGO_URL ||
    `${publicBaseUrl.replace(/\/$/, "")}/img/logo-email.png`
  );
}

async function sendPasswordResetEmail({ to, name, resetUrl, publicBaseUrl }) {
  const from =
    process.env.MAIL_FROM ||
    "Controle Financeiro <financialcontrol@outlook.com.br>";
  const subject = "Redefinição de senha - Controle Financeiro";
  const safeName = escapeHtml(name);
  const safeResetUrl = escapeHtml(resetUrl);
  const logoUrl = escapeHtml(getEmailLogoUrl(publicBaseUrl));
  const html = `
    <div style="margin:0;padding:24px;background:#f4f7f5;font-family:Arial,Helvetica,sans-serif;color:#17211c;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dce7df;border-radius:18px;overflow:hidden;">
        <tr>
          <td style="padding:24px 24px 10px;text-align:center;">
            <img src="${logoUrl}" alt="Controle Financeiro" width="76" height="76" style="display:inline-block;border-radius:18px;">
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 24px;">
            <h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;color:#14532d;text-align:center;">Redefinição de senha</h1>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.55;">Olá${safeName ? `, ${safeName}` : ""}.</p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.55;">Recebemos uma solicitação para redefinir sua senha no Controle Financeiro.</p>
            <p style="margin:0 0 18px;text-align:center;">
              <a href="${safeResetUrl}" style="display:inline-block;background:#2ecc71;color:#0f1412;text-decoration:none;font-weight:700;border-radius:10px;padding:12px 18px;">Criar nova senha</a>
            </p>
            <p style="margin:0 0 16px;font-size:13px;line-height:1.55;color:#52635a;">Este link expira em ${PASSWORD_RESET_MINUTES} minutos. Se você não pediu isso, ignore este email.</p>
            <p style="margin:0;font-size:12px;line-height:1.55;color:#6b7c73;border-top:1px solid #dce7df;padding-top:14px;">Nunca compartilhe sua senha, códigos ou links de recuperação. Em caso de dúvida, fale com o suporte: <a href="mailto:financialcontrol@outlook.com.br" style="color:#15803d;text-decoration:none;">financialcontrol@outlook.com.br</a>.</p>
          </td>
        </tr>
      </table>
    </div>
  `;

  if (process.env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      const error = new Error(`Falha ao enviar email de redefinição: ${body}`);
      error.emailProvider = "resend";
      error.responseCode = response.status;
      error.response = body;

      throw error;
    }

    return true;
  }

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp-mail.outlook.com",
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      requireTLS: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    try {
      await transporter.sendMail({
        from,
        to,
        subject,
        html,
      });
    } catch (error) {
      error.emailProvider = "smtp";
      throw error;
    }

    return true;
  }

  console.info(`Link de redefinição de senha para ${to}: ${resetUrl}`);
  return false;
}

function serializeUser(row) {
  return {
    id: row.id,
    name: row.nome,
    email: row.email,
    phone: row.telefone || "",
    hasCpf: Boolean(row.cpf),
    plan: row.plano || "free",
    termsAccepted: Boolean(row.termos_aceitos_em),
    termsVersion: row.termos_versao || null,
    sessionVersion: Number(row.session_version || 0),
  };
}

function serializeTransaction(row) {
  return {
    id: row.id,
    description: row.descricao,
    amount: row.valor,
    type: row.tipo,
    date: row.data,
    origin: row.origem,
  };
}

function validateTransactionPayload(body) {
  const amount = Number(body.valor);
  const validTypes = ["receita", "despesa"];

  if (
    !body.descricao ||
    !body.tipo ||
    !body.data ||
    !Number.isFinite(amount) ||
    !validTypes.includes(body.tipo)
  ) {
    return null;
  }

  return {
    descricao: body.descricao,
    valor: amount,
    tipo: body.tipo,
    origem: body.origem || null,
    data: body.data,
  };
}

app.post("/api/auth/register", registerRateLimit, async (req, res) => {
  try {
    const nome = String(req.body.nome || "").trim();
    const email = normalizeEmail(req.body.email);
    const senha = String(req.body.senha || "");
    const telefone = normalizeOptionalText(req.body.telefone);
    const aceitaTermos = req.body.aceitaTermos === true;

    if (!nome || !email || senha.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        error: `Informe nome, email e uma senha com pelo menos ${MIN_PASSWORD_LENGTH} caracteres`,
      });
    }

    if (!aceitaTermos) {
      return res.status(400).json({
        error: "É necessário aceitar os termos para criar a conta",
      });
    }

    const senhaHash = await bcrypt.hash(senha, PASSWORD_SALT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO usuarios
        (nome, email, senha_hash, telefone, termos_aceitos_em, termos_versao)
       VALUES ($1, $2, $3, $4, NOW(), $5)
       RETURNING id, nome, email, telefone, cpf, plano, termos_aceitos_em, termos_versao, session_version`,
      [nome, email, senhaHash, telefone, TERMS_VERSION],
    );

    const user = serializeUser(result.rows[0]);

    return res.status(201).json({
      user,
      token: signToken(user),
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        error: "Este email já está cadastrado",
      });
    }

    console.error("Erro ao cadastrar usuário:", error);

    return res.status(500).json({
      error: "Erro ao cadastrar usuário",
    });
  }
});

app.post("/api/auth/login", loginRateLimit, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const senha = String(req.body.senha || "");
    const aceitaTermos = req.body.aceitaTermos === true;

    if (!email || !senha) {
      return res.status(400).json({
        error: "Informe email e senha",
      });
    }

    const result = await pool.query(
      `SELECT id, nome, email, senha_hash, telefone, cpf, plano, termos_aceitos_em, termos_versao, session_version
       FROM usuarios
       WHERE email=$1`,
      [email],
    );

    const userRow = result.rows[0];
    const passwordMatches =
      userRow && (await bcrypt.compare(senha, userRow.senha_hash));

    if (!passwordMatches) {
      return res.status(401).json({
        error: "Email ou senha inválidos",
      });
    }

    let acceptedUserRow = userRow;

    if (aceitaTermos) {
      const acceptedResult = await pool.query(
        `UPDATE usuarios
         SET termos_aceitos_em=NOW(), termos_versao=$1
         WHERE id=$2
         RETURNING id, nome, email, telefone, cpf, plano, termos_aceitos_em, termos_versao, session_version`,
        [TERMS_VERSION, userRow.id],
      );

      acceptedUserRow = acceptedResult.rows[0];
    }

    const user = serializeUser(acceptedUserRow);

    return res.json({
      user,
      token: signToken(user),
    });
  } catch (error) {
    console.error("Erro ao fazer login:", error);

    return res.status(500).json({
      error: "Erro ao fazer login",
    });
  }
});

app.post(
  "/api/auth/forgot-password",
  forgotPasswordRateLimit,
  async (req, res) => {
    try {
      const email = normalizeEmail(req.body.email);

      if (!email) {
        return res.status(400).json({
          error: "Informe o email cadastrado",
        });
      }

      const result = await pool.query(
        `SELECT id, nome, email
       FROM usuarios
       WHERE email=$1`,
        [email],
      );

      const user = result.rows[0];

      if (user) {
        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = hashResetToken(token);
        const publicBaseUrl = getPublicBaseUrl(req);
        const resetUrl = `${publicBaseUrl}/?resetToken=${token}`;

        await pool.query(
          `UPDATE usuarios
         SET reset_token_hash=$1,
             reset_token_expires_at=NOW() + ($2 || ' minutes')::interval
         WHERE id=$3`,
          [tokenHash, PASSWORD_RESET_MINUTES, user.id],
        );

        try {
          await sendPasswordResetEmail({
            to: user.email,
            name: user.nome,
            resetUrl,
            publicBaseUrl,
          });
        } catch (error) {
          console.error(
            "Falha no envio do email de redefinição:",
            serializeEmailError(error),
          );
          throw error;
        }
      }

      return res.json({
        success: true,
        message:
          "Se o email existir, enviaremos as instruções de redefinição.",
      });
    } catch (error) {
      console.error("Erro ao solicitar redefinição de senha:", {
        name: error.name,
        message: error.message,
        code: error.code,
      });

      return res.status(500).json({
        error: "Erro ao solicitar redefinição de senha",
      });
    }
  },
);

app.post(
  "/api/auth/reset-password",
  resetPasswordRateLimit,
  async (req, res) => {
    try {
    const token = String(req.body.token || "");
    const senha = String(req.body.senha || "");

    if (!token || senha.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        error: `Informe uma nova senha com pelo menos ${MIN_PASSWORD_LENGTH} caracteres`,
      });
    }

    const tokenHash = hashResetToken(token);
    const senhaHash = await bcrypt.hash(senha, PASSWORD_SALT_ROUNDS);

    const result = await pool.query(
      `UPDATE usuarios
       SET senha_hash=$1,
           reset_token_hash=NULL,
           reset_token_expires_at=NULL,
           session_version=COALESCE(session_version, 0) + 1
       WHERE reset_token_hash=$2
         AND reset_token_expires_at > NOW()
       RETURNING id`,
      [senhaHash, tokenHash],
    );

    if (result.rowCount === 0) {
      return res.status(400).json({
        error: "Link inválido ou expirado",
      });
    }

    return res.json({
      success: true,
    });
    } catch (error) {
      console.error("Erro ao redefinir senha:", error);

      return res.status(500).json({
        error: "Erro ao redefinir senha",
      });
    }
  },
);

app.put("/api/auth/profile", authRequired, async (req, res) => {
  try {
    const telefone = normalizeOptionalText(req.body.telefone);
    const cpf = normalizeCpf(req.body.cpf);

    const result = await pool.query(
      `UPDATE usuarios
       SET telefone=$1,
           cpf=$2
       WHERE id=$3
       RETURNING id, nome, email, telefone, cpf, plano, termos_aceitos_em, termos_versao, session_version`,
      [telefone, cpf, req.user.id],
    );

    return res.json({
      user: serializeUser(result.rows[0]),
    });
  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);

    return res.status(500).json({
      error: "Erro ao atualizar dados da conta",
    });
  }
});

app.get("/api/auth/me", authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nome, email, telefone, cpf, plano, termos_aceitos_em, termos_versao, session_version
       FROM usuarios
       WHERE id=$1`,
      [req.user.id],
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        error: "Sessão inválida ou expirada",
      });
    }

    return res.json({
      user: serializeUser(result.rows[0]),
    });
  } catch (error) {
    console.error("Erro ao buscar usuário autenticado:", error);

    return res.status(500).json({
      error: "Erro ao buscar usuário autenticado",
    });
  }
});

app.get("/api/categorias/:tipo", async (req, res) => {
  const { tipo } = req.params;

  const result = await pool.query(
    "SELECT * FROM categorias WHERE tipo=$1 ORDER BY nome",
    [tipo],
  );

  res.json(result.rows);
});

app.get("/api/transacoes", authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      `
            SELECT
                id,
                descricao AS description,
                valor AS amount,
                tipo AS type,
                data::date AS date,
                origem AS origin
            FROM transacoes
            WHERE user_id=$1
            ORDER BY id DESC
        `,
      [req.user.id],
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar transações:", error);

    res.status(500).json({
      error: "Erro ao buscar transações",
    });
  }
});

app.post("/api/transacoes", authRequired, async (req, res) => {
  const payload = validateTransactionPayload(req.body);

  if (!payload) {
    return res.status(400).json({
      error: "Dados inválidos",
    });
  }

  const result = await pool.query(
    `INSERT INTO transacoes
        (user_id, descricao, valor, tipo, origem, data)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING *`,
    [
      req.user.id,
      payload.descricao,
      payload.valor,
      payload.tipo,
      payload.origem,
      payload.data,
    ],
  );

  res.json(serializeTransaction(result.rows[0]));
});

app.delete("/api/transacoes/:id", authRequired, async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    "DELETE FROM transacoes WHERE id=$1 AND user_id=$2 RETURNING id",
    [id, req.user.id],
  );

  if (result.rowCount === 0) {
    return res.status(404).json({
      error: "Transação não encontrada",
    });
  }

  res.status(200).json({ success: true });
});

app.get("/api/limites", authRequired, async (req, res) => {
  const result = await pool.query(
    "SELECT cartao, limite FROM limites_cartao WHERE user_id=$1 ORDER BY cartao",
    [req.user.id],
  );

  res.json(result.rows);
});

app.post("/api/limites", authRequired, async (req, res) => {
  const { cartao, limite } = req.body;
  const numericLimit = Number(limite);

  if (!cartao || !Number.isFinite(numericLimit)) {
    return res.status(400).json({
      error: "Dados inválidos",
    });
  }

  await pool.query(
    `
        INSERT INTO limites_cartao (user_id, cartao, limite)
        VALUES ($1,$2,$3)
        ON CONFLICT (user_id, cartao)
        DO UPDATE SET limite = EXCLUDED.limite
    `,
    [req.user.id, cartao, numericLimit],
  );

  res.json({ success: true });
});

app.put("/api/transacoes/:id", authRequired, async (req, res) => {
  const { id } = req.params;
  const payload = validateTransactionPayload(req.body);

  if (!payload) {
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
         WHERE id=$6 AND user_id=$7
         RETURNING *`,
    [
      payload.descricao,
      payload.valor,
      payload.tipo,
      payload.origem,
      payload.data,
      id,
      req.user.id,
    ],
  );

  if (result.rowCount === 0) {
    return res.status(404).json({
      error: "Transação não encontrada",
    });
  }

  res.json(serializeTransaction(result.rows[0]));
});

module.exports = app;

const REMOTE_API_URL = "https://controle-financeiro-backend-wkzj.vercel.app/api";
const API_URL = window.Capacitor?.isNativePlatform?.() ? REMOTE_API_URL : "/api";
const TOKEN_KEY = "controleFinanceiroToken";
const USER_KEY = "controleFinanceiroUser";

function getElement(id) {
  return document.getElementById(id);
}

function saveSession({ token, user }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function setAuthMessage(message = "", type = "error") {
  const errorElement = getElement("auth-error");

  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.toggle("success", type === "success");
  }
}

function setAuthLoading(isLoading) {
  document
    .querySelectorAll(".auth-form button[type='submit']")
    .forEach((button) => {
      button.disabled = isLoading;
    });
}

async function parseError(response) {
  try {
    const data = await response.json();

    return data.error || "Nao foi possivel concluir a acao";
  } catch (error) {
    return "Nao foi possivel concluir a acao";
  }
}

async function submitJson(path, payload) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return await response.json();
}

async function submitAuth(path, payload) {
  const session = await submitJson(path, payload);

  saveSession(session);

  return session;
}

function formatCpf(value) {
  const digits = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 11);

  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function openTermsModal() {
  getElement("terms-modal")?.classList.add("active");
}

function closeTermsModal() {
  getElement("terms-modal")?.classList.remove("active");
}

function syncProfileForm(user = getCurrentUser()) {
  const phoneInput = getElement("profile-phone");
  const cpfInput = getElement("profile-cpf");

  if (phoneInput) {
    phoneInput.value = user?.phone || "";
  }

  if (cpfInput && !cpfInput.value) {
    cpfInput.placeholder = user?.hasCpf ? "CPF salvo" : "";
  }
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch (error) {
    return null;
  }
}

export function isAuthenticated() {
  return Boolean(getAuthToken() && getCurrentUser());
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getAuthToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearSession();
    window.dispatchEvent(new CustomEvent("auth:expired"));
  }

  return response;
}

export function showAuthScreen() {
  getElement("auth-screen")?.removeAttribute("hidden");
  getElement("app-shell")?.setAttribute("hidden", "");
  getElement("fab-add")?.setAttribute("hidden", "");
}

export function showAppShell(user = getCurrentUser()) {
  getElement("auth-screen")?.setAttribute("hidden", "");
  getElement("app-shell")?.removeAttribute("hidden");
  getElement("fab-add")?.removeAttribute("hidden");

  const userName = getElement("user-name");
  const userAvatar = getElement("user-avatar");
  const userPlan = getElement("user-plan");
  const proButton = getElement("open-pro-screen");
  const currentPlanLabel = getElement("current-plan-label");

  if (userName && user) {
    userName.textContent = user.name;
  }

  if (userAvatar && user) {
    userAvatar.textContent = user.name.trim().charAt(0).toUpperCase() || "C";
  }

  const plan = user?.plan === "pro" ? "pro" : "free";
  const planLabel = plan === "pro" ? "PRO" : "Free";

  if (userPlan) {
    userPlan.textContent = planLabel;
    userPlan.classList.toggle("is-pro", plan === "pro");
  }

  if (proButton) {
    proButton.textContent = plan === "pro" ? "Plano PRO" : "Upgrade";
  }

  if (currentPlanLabel) {
    currentPlanLabel.textContent = `Seu plano atual: ${planLabel}`;
  }

  syncProfileForm(user);
}

export async function refreshCurrentUser() {
  const response = await apiFetch("/auth/me");

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = await response.json();
  const token = getAuthToken();

  saveSession({
    token,
    user: data.user,
  });

  return data.user;
}

export async function updateProfile(payload) {
  const response = await apiFetch("/auth/profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = await response.json();
  const token = getAuthToken();

  saveSession({
    token,
    user: data.user,
  });

  return data.user;
}

export function initAuthEvents({ onAuthenticated, onLogout }) {
  const loginForm = getElement("login-form");
  const registerForm = getElement("register-form");
  const forgotPasswordForm = getElement("forgot-password-form");
  const resetPasswordForm = getElement("reset-password-form");
  const loginTab = getElement("show-login");
  const registerTab = getElement("show-register");
  const forgotPasswordButton = getElement("show-forgot-password");
  const logoutButton = getElement("logout-button");
  const profileForm = getElement("profile-form");
  const cpfInput = getElement("profile-cpf");
  const closeTermsButton = getElement("close-terms");
  const resetToken = new URLSearchParams(window.location.search).get(
    "resetToken",
  );

  function setMode(mode) {
    const isLogin = mode === "login";
    const isRegister = mode === "register";
    const isForgot = mode === "forgot";
    const isReset = mode === "reset";

    loginForm.hidden = !isLogin;
    registerForm.hidden = !isRegister;
    forgotPasswordForm.hidden = !isForgot;
    resetPasswordForm.hidden = !isReset;
    loginTab.classList.toggle("active", isLogin);
    registerTab.classList.toggle("active", isRegister);
    setAuthMessage("");
  }

  loginTab?.addEventListener("click", () => setMode("login"));
  registerTab?.addEventListener("click", () => setMode("register"));
  forgotPasswordButton?.addEventListener("click", () => setMode("forgot"));

  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.authMode));
  });

  document.querySelectorAll("[data-open-terms]").forEach((button) => {
    button.addEventListener("click", openTermsModal);
  });

  closeTermsButton?.addEventListener("click", closeTermsModal);
  getElement("terms-modal")?.addEventListener("click", (event) => {
    if (event.target.id === "terms-modal") {
      closeTermsModal();
    }
  });

  cpfInput?.addEventListener("input", () => {
    cpfInput.value = formatCpf(cpfInput.value);
  });

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthMessage("");

    try {
      const session = await submitAuth("/auth/login", {
        email: getElement("login-email").value,
        senha: getElement("login-password").value,
        aceitaTermos: getElement("login-terms").checked,
      });

      await onAuthenticated(session.user);
    } catch (error) {
      setAuthMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  });

  registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthMessage("");

    try {
      const session = await submitAuth("/auth/register", {
        nome: getElement("register-name").value,
        email: getElement("register-email").value,
        telefone: getElement("register-phone").value,
        senha: getElement("register-password").value,
        aceitaTermos: getElement("register-terms").checked,
      });

      await onAuthenticated(session.user);
    } catch (error) {
      setAuthMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  });

  forgotPasswordForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthMessage("");

    try {
      await submitJson("/auth/forgot-password", {
        email: getElement("forgot-email").value,
      });

      setAuthMessage(
        "Se o email existir, enviaremos as instrucoes de redefinicao.",
        "success",
      );
    } catch (error) {
      setAuthMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  });

  resetPasswordForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthMessage("");

    try {
      await submitJson("/auth/reset-password", {
        token: resetToken,
        senha: getElement("reset-password").value,
      });

      window.history.replaceState({}, "", window.location.pathname);
      setMode("login");
      setAuthMessage("Senha alterada. Entre com a nova senha.", "success");
    } catch (error) {
      setAuthMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  });

  profileForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const status = getElement("profile-status");

    if (status) {
      status.textContent = "Salvando...";
    }

    try {
      const user = await updateProfile({
        telefone: getElement("profile-phone").value,
        cpf: getElement("profile-cpf").value,
      });

      showAppShell(user);

      if (status) {
        status.textContent = "Dados salvos com seguranca.";
      }
    } catch (error) {
      if (status) {
        status.textContent = error.message;
      }
    }
  });

  logoutButton?.addEventListener("click", () => {
    clearSession();
    onLogout();
  });

  window.addEventListener("auth:expired", onLogout);

  if (resetToken) {
    setMode("reset");
  }
}

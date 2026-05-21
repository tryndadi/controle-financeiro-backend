const API_URL = "/api";
const TOKEN_KEY = "controleFinanceiroToken";
const USER_KEY = "controleFinanceiroUser";

function getElement(id) {
  return document.getElementById(id);
}

function saveSession({ token, user }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function setAuthError(message = "") {
  const errorElement = getElement("auth-error");

  if (errorElement) {
    errorElement.textContent = message;
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

async function submitAuth(path, payload) {
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

  const session = await response.json();

  saveSession(session);

  return session;
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

  if (userName && user) {
    userName.textContent = user.name;
  }
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

export function initAuthEvents({ onAuthenticated, onLogout }) {
  const loginForm = getElement("login-form");
  const registerForm = getElement("register-form");
  const loginTab = getElement("show-login");
  const registerTab = getElement("show-register");
  const logoutButton = getElement("logout-button");

  function setMode(mode) {
    const isLogin = mode === "login";

    loginForm.hidden = !isLogin;
    registerForm.hidden = isLogin;
    loginTab.classList.toggle("active", isLogin);
    registerTab.classList.toggle("active", !isLogin);
    setAuthError("");
  }

  loginTab?.addEventListener("click", () => setMode("login"));
  registerTab?.addEventListener("click", () => setMode("register"));

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    try {
      const session = await submitAuth("/auth/login", {
        email: getElement("login-email").value,
        senha: getElement("login-password").value,
      });

      await onAuthenticated(session.user);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  });

  registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    try {
      const session = await submitAuth("/auth/register", {
        nome: getElement("register-name").value,
        email: getElement("register-email").value,
        senha: getElement("register-password").value,
      });

      await onAuthenticated(session.user);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  });

  logoutButton?.addEventListener("click", () => {
    clearSession();
    onLogout();
  });

  window.addEventListener("auth:expired", onLogout);
}

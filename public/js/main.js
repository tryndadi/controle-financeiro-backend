import { loadTransactions, loadCardLimits } from "./api.js";

import { render } from "./render.js";

import { initFilters, populateCardFilter } from "./filters.js";

import { initModalEvents, openTransactionModal } from "./modal.js";

import { handleTableClick } from "./table.js";

import { lazyLoadChart } from "./chart.js";

import { initExportEvents } from "./export.js";

import {
  clearSession,
  getCurrentUser,
  initAuthEvents,
  isAuthenticated,
  refreshCurrentUser,
  showAppShell,
  showAuthScreen,
} from "./auth.js";

import {
  updateIsMobile,
  chartMode,
  chartPeriod,
  setChartMode,
  setChartPeriod,
  setActiveUser,
  clearActiveUser,
  resetFinanceState,
} from "./state.js";

let appInitialized = false;

/* =========================
   EVENTOS GLOBAIS
========================= */

function initEvents() {
  const transactionsList = document.getElementById("transactions-list");

  const openModalBtn = document.getElementById("open-modal");

  const fabAddBtn = document.getElementById("fab-add");

  const toggleMode = document.getElementById("toggle-chart-mode");
  const togglePeriod = document.getElementById("toggle-chart-period");

  if (transactionsList) {
    transactionsList.addEventListener("click", handleTableClick);
  }

  if (openModalBtn) {
    openModalBtn.onclick = openTransactionModal;
  }

  if (fabAddBtn) {
    fabAddBtn.onclick = openTransactionModal;
  }
  /* =========================
   BOTÕES DO GRÁFICO
========================= */

  if (toggleMode) {
    toggleMode.onclick = () => {
      const newMode = chartMode === "cartao" ? "relacao" : "cartao";

      setChartMode(newMode);

      toggleMode.textContent =
        "Modo: " + (newMode === "cartao" ? "Cartão" : "Receita x Despesa");

      render({ chart: true });
    };
  }

  if (togglePeriod) {
    togglePeriod.onclick = () => {
      let newPeriod = "tudo";

      if (chartPeriod === "tudo") newPeriod = "mes";
      else if (chartPeriod === "mes") newPeriod = "ano";

      setChartPeriod(newPeriod);

      togglePeriod.textContent =
        "Período: " +
        (newPeriod === "mes" ? "Mês" : newPeriod === "ano" ? "Ano" : "Tudo");

      render({ chart: true });
    };
  }
}

/* =========================
   RESIZE
========================= */

let resizeTimer;
let lastWidth = window.innerWidth;

function initResizeListener() {
  window.addEventListener("resize", () => {
    if (window.innerWidth === lastWidth) return;

    lastWidth = window.innerWidth;

    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(() => {
      updateIsMobile();

      render({
        table: true,
      });
    }, 200);
  });
}

/* =========================
   CARREGAR DADOS
========================= */

async function loadInitialData() {
  await Promise.all([loadCardLimits(), loadTransactions()]);

  populateCardFilter();
}

function initAppOnce() {
  if (appInitialized) return;

  updateIsMobile();

  initEvents();

  initFilters();

  initExportEvents();

  initModalEvents();

  initResizeListener();

  lazyLoadChart();

  appInitialized = true;
}

function handleLogout() {
  clearSession();

  clearActiveUser();

  resetFinanceState();

  showAuthScreen();
}

async function startAuthenticatedApp(user = getCurrentUser()) {
  try {
    let activeUser = user;

    if (!activeUser) {
      throw new Error("Sessao nao encontrada");
    }

    setActiveUser(activeUser.id);

    showAppShell(activeUser);

    initAppOnce();

    activeUser = await refreshCurrentUser();

    setActiveUser(activeUser.id);

    showAppShell(activeUser);

    await loadInitialData();

    render();
  } catch (err) {
    console.error("Erro ao iniciar sessao:", err);

    handleLogout();
  }
}

/* =========================
   INIT APP
========================= */

async function init() {
  initAuthEvents({
    onAuthenticated: startAuthenticatedApp,
    onLogout: handleLogout,
  });

  if (isAuthenticated()) {
    await startAuthenticatedApp();
  } else {
    handleLogout();
  }
}

init();

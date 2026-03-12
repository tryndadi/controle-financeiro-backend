/* =========================
   BREAKPOINT
========================= */

const MOBILE_BREAKPOINT = 768;

/* =========================
   DADOS PRINCIPAIS
========================= */

export let transactions = [];

export let transactionsById = {};

export let cardLimits = {};

/* =========================
   META FINANCEIRA
========================= */

export let goal = Number(localStorage.getItem("goal")) || 0;

/* =========================
   GRÁFICO
========================= */

export let chart = null;

export let chartMode = localStorage.getItem("chartMode") || "cartao";

export let chartPeriod = localStorage.getItem("chartPeriod") || "tudo";

export let chartDirty = true;

export let chartVisible = false;

/* =========================
   TRANSAÇÃO EM EDIÇÃO
========================= */

export let editingTransactionId = null;

/* =========================
   CARTÃO SELECIONADO
========================= */

export let selectedCard = null;

/* =========================
   CACHE DE FILTROS
========================= */

export let filteredCache = null;

/* =========================
   RESPONSIVIDADE
========================= */

export let isMobile = window.innerWidth < MOBILE_BREAKPOINT;

/* =========================
   SETTERS
========================= */

export function setGoal(value) {
  goal = Number(value) || 0;

  localStorage.setItem("goal", goal);
}

/* =========================
   TRANSAÇÕES
========================= */

export function setTransactions(list) {
  transactions = list;

  transactionsById = {};

  for (const t of list) {
    transactionsById[t.id] = t;
  }

  clearFiltersCache();
}

/* =========================
   GRÁFICO
========================= */

export function setChart(chartInstance) {
  chart = chartInstance;
}

export function setChartMode(mode) {
  chartMode = mode;

  localStorage.setItem("chartMode", mode);

  chartDirty = true;
}

export function setChartPeriod(period) {
  chartPeriod = period;

  localStorage.setItem("chartPeriod", period);

  chartDirty = true;
}

export function setChartDirty(value) {
  chartDirty = value;
}

export function markChartDirty() {
  chartDirty = true;
}

export function setChartVisible(value) {
  chartVisible = value;
}

/* =========================
   EDIÇÃO
========================= */

export function setEditingTransaction(id) {
  editingTransactionId = id;
}

export function clearEditingTransaction() {
  editingTransactionId = null;
}

/* =========================
   CARTÃO
========================= */

export function setSelectedCard(card) {
  selectedCard = card;
}

/* =========================
   FILTROS
========================= */

export function clearFiltersCache() {
  filteredCache = null;
}

export function setFilteredCache(data) {
  filteredCache = data;
}

/* =========================
   RESPONSIVIDADE
========================= */

export function updateIsMobile() {
  isMobile = window.innerWidth < MOBILE_BREAKPOINT;
}

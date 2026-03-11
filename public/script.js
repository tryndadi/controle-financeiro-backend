/* =========================
CONFIG / STATE
========================= */

const API_URL = "/api";

let transactions = [];
let transactionsById = {};
let cardLimits = {};
let goal = Number(localStorage.getItem("goal")) || 0;

let chart;
let chartMode = "cartao";
let chartPeriod = "tudo";

let chartDirty = true;
let chartVisible = false;

let filteredCache = null;

let editingTransactionId = null;
let selectedCard = null;

let isMobile = window.innerWidth < 768;

/* =========================
DOM CACHE
========================= */

const $ = id => document.getElementById(id);

const transactionsList = $("transactions-list");
const cardSummary = $("card-summary-list");

const goalInput = $("goal-input");
const goalStatus = $("goal-status");
const progressFill = $("progress-fill");

const transactionModal = $("transaction-modal");

const typeSelect = $("transaction-type");
const originSelect = $("transaction-origin");
const categorySelect = $("transaction-category");
const originLabel = $("origin-label");

/* =========================
UTILS
========================= */

const format = v =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = d =>
    new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" });

function debounce(fn, delay = 300) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), delay);
    };
}

/* =========================
FETCH
========================= */

async function fetchJSON(url, options) {
    const res = await fetch(url, options);
    return res.json();
}

/* =========================
LOAD DATA
========================= */

async function loadTransactions() {

    transactionsList.innerHTML = `
<tr class="skeleton"><td colspan="6"></td></tr>
<tr class="skeleton"><td colspan="6"></td></tr>
<tr class="skeleton"><td colspan="6"></td></tr>
`;

    const data = await fetchJSON(`${API_URL}/transacoes`);

    transactions = data.map(t => ({
        id: t.id,
        date: t.date,
        type: t.type,
        description: t.description,
        amount: Number(t.amount),
        origin: t.origin
    }));

    transactionsById = Object.fromEntries(
        transactions.map(t => [t.id, t])
    );

    filteredCache = null;
    chartDirty = true;

    populateCardFilter();
    render();
}

async function loadCardLimits() {

    const data = await fetchJSON(`${API_URL}/limites`);

    cardLimits = Object.fromEntries(
        data.map(l => [l.cartao, Number(l.limite)])
    );
}

/* =========================
FILTERS
========================= */

function getFilteredTransactions() {

    if (filteredCache) return filteredCache;

    const type = $("filter-type").value;
    const card = $("filter-card").value;
    const period = $("filter-period").value;
    const order = $("filter-order").value;

    const now = new Date();

    let result = transactions.filter(t => {

        if (type !== "todos" && t.type !== type) return false;
        if (card !== "todos" && t.origin !== card) return false;

        if (period === "mes") {
            const d = new Date(t.date);
            return d.getMonth() === now.getMonth()
                && d.getFullYear() === now.getFullYear();
        }

        if (period === "ano") {
            const d = new Date(t.date);
            return d.getFullYear() === now.getFullYear();
        }

        return true;
    });

    result.sort((a, b) =>
        order === "asc" ? a.amount - b.amount : b.amount - a.amount
    );

    return filteredCache = result;
}

/* =========================
RENDER CORE
========================= */

function render({
    table = true,
    balance = true,
    cards = true,
    goalUI = true,
    chartUI = true
} = {}) {

    if (balance) renderBalance();
    if (table) renderTable();
    if (cards) renderCardSummary();
    if (goalUI) renderGoal();

    if (chartUI && chartDirty && chartVisible) {
        renderChart();
        chartDirty = false;
    }
}

/* =========================
BALANCE
========================= */

function renderBalance() {

    const saldo = $("saldo");
    if (!saldo) return;

    const total = transactions.reduce((acc, t) =>
        t.type === "receita"
            ? acc + t.amount
            : acc - t.amount
        , 0);

    saldo.textContent = format(total);
    saldo.classList.toggle("negativo", total < 0);
}

/* =========================
TABLE
========================= */

function buildRow(t) {

    const tr = document.createElement("tr");
    tr.dataset.id = t.id;

    tr.innerHTML = `
<td>${formatDate(t.date)}</td>
<td>${t.type}</td>
<td>${t.description}</td>
<td>${t.origin || "-"}</td>
<td>${format(t.amount)}</td>
<td>
<button class="edit-btn">✏</button>
<button class="delete-btn">🗑</button>
</td>
`;

    return tr;
}

function renderTable() {

    const data = getFilteredTransactions();

    if (isMobile) {
        renderMobileCards(data);
        return;
    }

    const fragment = document.createDocumentFragment();

    data.forEach(t => fragment.appendChild(buildRow(t)));

    transactionsList.innerHTML = "";
    transactionsList.appendChild(fragment);
}

/* =========================
MOBILE CARDS
========================= */

function renderMobileCards(data) {

    const fragment = document.createDocumentFragment();

    data.forEach(t => {

        const card = document.createElement("div");
        card.className = "transaction-card";
        card.dataset.id = t.id;

        card.innerHTML = `
<div class="card-header">
<strong>${t.description}</strong>
<span class="${t.type}">
${format(t.amount)}
</span>
</div>

<div class="card-body">
<span>${t.origin}</span>
<span>${formatDate(t.date)}</span>
</div>

<button class="edit-btn">Editar</button>
<button class="delete-btn">Excluir</button>
`;

        fragment.appendChild(card);
    });

    transactionsList.innerHTML = "";
    transactionsList.appendChild(fragment);
}

/* =========================
CARD SUMMARY
========================= */

function renderCardSummary() {

    const totals = {};

    transactions
        .filter(t => t.type === "despesa")
        .forEach(t => {
            totals[t.origin] = (totals[t.origin] || 0) + t.amount;
        });

    cardSummary.innerHTML = "";

    Object.entries(totals).forEach(([card, total]) => {

        const limit = cardLimits[card] || 0;

        const row = document.createElement("tr");

        row.innerHTML = `
<td>${card}</td>
<td>${format(total)}</td>

<td class="limit-cell">

<span>
${limit ? format(limit - total) : "Sem limite"}
</span>

<button class="limit-gear"
onclick="openLimit('${card}')">
⚙
</button>

</td>
`;

        cardSummary.appendChild(row);
    });
}

/* =========================
GOAL
========================= */

function renderGoal() {

    if (goal <= 0) return;

    const total = transactions.reduce((acc, t) =>
        t.type === "receita"
            ? acc + t.amount
            : acc - t.amount
        , 0);

    const percent =
        Math.max(0, Math.min((total / goal) * 100, 100));

    progressFill.style.width = percent + "%";

    if (total >= goal) {
        goalStatus.textContent = `Meta atingida 🎉 (${format(goal)})`;
    } else {
        goalStatus.textContent =
            `Faltam ${format(goal - total)} para atingir a meta`;
    }
}

/* =========================
CHART
========================= */

function renderChart() {

    const ctx = $("expenseChart").getContext("2d");

    let labels = [];
    let data = [];

    if (chartMode === "cartao") {

        const totals = {};

        transactions
            .filter(t => t.type === "despesa")
            .forEach(t => {
                totals[t.origin] =
                    (totals[t.origin] || 0) + t.amount;
            });

        labels = Object.keys(totals);
        data = Object.values(totals);

    } else {

        let receita = 0;
        let despesa = 0;

        transactions.forEach(t => {
            if (t.type === "receita") receita += t.amount;
            else despesa += t.amount;
        });

        labels = ["Receita", "Despesa"];
        data = [receita, despesa];
    }

    if (chart) {

        chart.data.labels = labels;
        chart.data.datasets[0].data = data;
        chart.update();

    } else {

        chart = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: [
                        "#2ecc71",
                        "#e74c3c",
                        "#3498db",
                        "#f1c40f",
                        "#9b59b6"
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: "bottom" }
                }
            }
        });

    }

    $("chart-skeleton").style.display = "none";
    $("expenseChart").style.display = "block";
}

/* =========================
EVENT DELEGATION
========================= */

transactionsList.addEventListener("click", async e => {

    const btn = e.target.closest("button");
    if (!btn) return;

    const container = btn.closest("[data-id]");
    const id = Number(container.dataset.id);

    if (btn.classList.contains("delete-btn")) {

        await fetch(`${API_URL}/transacoes/${id}`, { method: "DELETE" });

        transactions = transactions.filter(t => t.id !== id);
        delete transactionsById[id];

        filteredCache = null;
        chartDirty = true;

        render();

    }

    if (btn.classList.contains("edit-btn")) {

        const t = transactionsById[id];

        editingTransactionId = id;

        $("transaction-description").value = t.description;
        $("transaction-amount").value = t.amount;
        $("transaction-type").value = t.type;
        $("transaction-origin").value = t.origin;
        $("transaction-date").value = t.date;

        transactionModal.classList.add("active");
    }

});

/* =========================
FORM
========================= */

$("transaction-form").onsubmit = async e => {

    e.preventDefault();

    const data = {
        descricao: $("transaction-description").value,
        valor: Number($("transaction-amount").value),
        tipo: $("transaction-type").value,
        origem: $("transaction-origin").value,
        data: $("transaction-date").value
    };

    if (editingTransactionId) {

        await fetch(`${API_URL}/transacoes/${editingTransactionId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        const t = transactionsById[editingTransactionId];

        Object.assign(t, {
            description: data.descricao,
            amount: data.valor,
            type: data.tipo,
            origin: data.origem,
            date: data.data
        });

        editingTransactionId = null;

    } else {

        const res = await fetch(`${API_URL}/transacoes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        const newT = await res.json();

        const obj = {
            id: newT.id,
            date: data.data,
            type: data.tipo,
            description: data.descricao,
            amount: data.valor,
            origin: data.origem
        };

        transactions.unshift(obj);
        transactionsById[obj.id] = obj;
    }

    filteredCache = null;
    chartDirty = true;

    transactionModal.classList.remove("active");

    render();
};

/* =========================
LAZY CHART
========================= */

function lazyLoadChart() {

    const observer = new IntersectionObserver(entries => {

        entries.forEach(entry => {

            if (entry.isIntersecting) {

                chartVisible = true;
                chartDirty = true;

                render({ chartUI: true });

                observer.disconnect();
            }

        });

    }, { threshold: 0.3 });

    observer.observe(document.querySelector(".chart-container"));
}

/* =========================
INIT
========================= */

async function init() {

    await loadCardLimits();
    await loadTransactions();

    lazyLoadChart();
}

init();
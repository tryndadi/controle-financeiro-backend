/* ===============================
UTILS
=============================== */

const API_URL = "/api";
const $ = id => document.getElementById(id);

const format = value =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatDate(dateString) {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

function filterByPeriod(list, period) {

    const now = new Date();

    if (period === "mes") {
        return list.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === now.getMonth() &&
                d.getFullYear() === now.getFullYear();
        });
    }

    if (period === "ano") {
        return list.filter(t => {
            const d = new Date(t.date);
            return d.getFullYear() === now.getFullYear();
        });
    }

    return list;
}

function calculateTotals() {

    let receita = 0;
    let despesa = 0;

    transactions.forEach(t => {
        if (t.type === "receita") receita += t.amount;
        else despesa += t.amount;
    });

    return {
        receita,
        despesa,
        saldo: receita - despesa
    };
}


/* ===============================
STATE
=============================== */

let transactions = [];
let transactionsById = {};
let cardLimits = {};
let goal = Number(localStorage.getItem("goal")) || 0;

let chart;
let selectedCard = null;
let editingTransactionId = null;

let chartMode = "cartao";
let chartPeriod = "tudo";

let filteredCache = null;
let chartDirty = true;
let chartVisible = false;

let isMobile = window.innerWidth < 768;


/* ===============================
ELEMENTS
=============================== */

const transactionsList = $("transactions-list");
const cardSummary = $("card-summary-list");
const goalInput = $("goal-input");
const goalStatus = $("goal-status");
const progressFill = $("progress-fill");

const transactionModal = $("transaction-modal");
const typeSelect = $("transaction-type");
const originSelect = $("transaction-origin");
const originLabel = $("origin-label");
const categorySelect = $("transaction-category");


/* ===============================
API
=============================== */

async function loadTransactions() {

    transactionsList.innerHTML = `
        <tr class="skeleton"><td colspan="6"></td></tr>
        <tr class="skeleton"><td colspan="6"></td></tr>
        <tr class="skeleton"><td colspan="6"></td></tr>
    `;

    const res = await fetch(`${API_URL}/transacoes`);
    const data = await res.json();

    transactions = data.map(t => ({
        id: t.id,
        date: t.date,
        type: t.type,
        description: t.description,
        amount: Number(t.amount),
        origin: t.origin
    }));

    transactionsById = {};
    transactions.forEach(t => transactionsById[t.id] = t);

    filteredCache = null;
    chartDirty = true;

    populateCardFilter();
    render();
}

async function loadCardLimits() {

    const res = await fetch(`${API_URL}/limites`);
    const data = await res.json();

    cardLimits = {};
    data.forEach(l => cardLimits[l.cartao] = Number(l.limite));
}

async function loadCategoriesByType(tipo) {

    const res = await fetch(`${API_URL}/categorias/${tipo}`);
    const categories = await res.json();

    categorySelect.innerHTML = "";

    categories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat.nome;
        opt.textContent = cat.nome;
        categorySelect.appendChild(opt);
    });
}


/* ===============================
FILTERS
=============================== */

function applyFilters() {

    const typeFilter = $("filter-type").value;
    const cardFilter = $("filter-card").value;
    const periodFilter = $("filter-period").value;
    const orderFilter = $("filter-order").value;

    let filtered = [...transactions];

    if (typeFilter !== "todos")
        filtered = filtered.filter(t => t.type === typeFilter);

    if (cardFilter !== "todos")
        filtered = filtered.filter(t => t.origin === cardFilter);

    filtered = filterByPeriod(filtered, periodFilter);

    filtered.sort((a, b) =>
        orderFilter === "asc" ? a.amount - b.amount : b.amount - a.amount
    );

    return filtered;
}

function getFilteredTransactions() {

    if (!filteredCache)
        filteredCache = applyFilters();

    return filteredCache;
}

function populateCardFilter() {

    const filterCard = document.getElementById("filter-card");

    if (!filterCard) return;

    filterCard.innerHTML = `<option value="todos">Todos Cartões</option>`;

    const cards = [...new Set(
        transactions
            .filter(t => t.type === "despesa")
            .map(t => t.origin)
    )];

    cards.forEach(card => {

        const option = document.createElement("option");

        option.value = card;
        option.textContent = card;

        filterCard.appendChild(option);

    });

}


/* ===============================
TABLE
=============================== */

function buildTransactionRow(t) {

    const row = document.createElement("tr");
    row.dataset.id = t.id;

    row.innerHTML = `
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

    return row;
}

function renderTable() {

    const filtered = getFilteredTransactions();

    if (isMobile) {
        renderMobileCards(filtered);
        return;
    }

    transactionsList.innerHTML = "";

    const fragment = document.createDocumentFragment();

    filtered.forEach(t => {
        fragment.appendChild(buildTransactionRow(t));
    });

    transactionsList.appendChild(fragment);
}

function replaceRow(id) {

    const oldRow = transactionsList.querySelector(`tr[data-id="${id}"]`);
    if (!oldRow) return;

    const newRow = buildTransactionRow(transactionsById[id]);
    newRow.classList.add("row-updated");

    oldRow.replaceWith(newRow);
}


/* ===============================
MOBILE CARDS
=============================== */

function renderMobileCards(filtered) {

    transactionsList.innerHTML = "";

    const fragment = document.createDocumentFragment();

    filtered.forEach(t => {

        const card = document.createElement("div");
        card.className = "transaction-card";
        card.dataset.id = t.id;

        card.innerHTML = `
            <div class="card-header">
                <strong>${t.description}</strong>
                <span class="${t.type}">${format(t.amount)}</span>
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

    transactionsList.appendChild(fragment);
}

function updateMobileCard(id) {

    const card = transactionsList.querySelector(`.transaction-card[data-id="${id}"]`);
    if (!card) return;

    const t = transactionsById[id];

    card.querySelector("strong").textContent = t.description;

    const value = card.querySelector(".card-header span");
    value.className = t.type;
    value.textContent = format(t.amount);

    const body = card.querySelector(".card-body");
    body.children[0].textContent = t.origin;
    body.children[1].textContent = formatDate(t.date);
}


/* ===============================
BALANCE / GOAL
=============================== */

function renderBalance() {

    const saldoElemento = $("saldo");
    if (!saldoElemento) return;

    const { saldo } = calculateTotals();

    saldoElemento.textContent = format(saldo);
    saldoElemento.classList.toggle("negativo", saldo < 0);
}

function renderGoal() {

    const { saldo } = calculateTotals();

    if (goal <= 0) {
        document.querySelector(".progress-bar").style.display = "none";
        goalStatus.textContent = "";
        return;
    }

    document.querySelector(".progress-bar").style.display = "block";

    const percent = Math.max(0, Math.min((saldo / goal) * 100, 100));

    progressFill.style.width = percent + "%";

    if (saldo >= goal) {
        goalStatus.textContent = `Meta atingida 🎉 (${format(goal)})`;
    } else {
        goalStatus.textContent = `Faltam ${format(goal - saldo)} para atingir a meta`;
    }
}


/* ===============================
CARD SUMMARY
=============================== */

function renderCardSummary() {

    cardSummary.innerHTML = "";

    const totals = {};

    transactions
        .filter(t => t.type === "despesa")
        .forEach(t => {
            totals[t.origin] = (totals[t.origin] || 0) + t.amount;
        });

    Object.entries(totals).forEach(([card, total]) => {

        const limit = cardLimits[card] || 0;

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${card}</td>
            <td>${format(total)}</td>

            <td class="limit-cell">
                <span>${limit ? format(limit - total) : "Sem limite"}</span>
                <button class="limit-gear" onclick="openLimit('${card}')">⚙</button>
            </td>
        `;

        cardSummary.appendChild(row);
    });
}


/* ===============================
CHART
=============================== */

function renderChart() {

    const ctx = $("expenseChart").getContext("2d");

    let filtered = filterByPeriod([...transactions], chartPeriod);

    let labels = [];
    let data = [];

    if (chartMode === "cartao") {

        const totals = {};

        filtered
            .filter(t => t.type === "despesa")
            .forEach(t => {
                totals[t.origin] = (totals[t.origin] || 0) + t.amount;
            });

        labels = Object.keys(totals);
        data = Object.values(totals);

    } else {

        const { receita, despesa } = calculateTotals();

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
                maintainAspectRatio: false
            }
        });

    }

    $("chart-skeleton").style.display = "none";
    $("expenseChart").style.display = "block";
}


/* ===============================
RENDER
=============================== */

function render({
    balance = true,
    table = true,
    cards = true,
    goal = true,
    chart = true
} = {}) {

    if (balance) renderBalance();
    if (table) renderTable();
    if (cards) renderCardSummary();
    if (goal) renderGoal();

    if (chart && chartDirty && chartVisible) {
        renderChart();
        chartDirty = false;
    }
}


/* ===============================
EVENTS
=============================== */

transactionsList.addEventListener("click", async e => {

    const btn = e.target.closest("button");
    if (!btn) return;

    const container = btn.closest("[data-id]");
    const id = Number(container.dataset.id);

    if (btn.classList.contains("delete-btn")) {
        await fetch(`${API_URL}/transacoes/${id}`, { method: "DELETE" });
        await loadTransactions();
    }

    if (btn.classList.contains("edit-btn")) {
        editTransaction(id);
    }
});

function updateOriginField() {

    originSelect.innerHTML = "";

    if (typeSelect.value === "receita") {

        originLabel.textContent = "Origem";

        originSelect.innerHTML = `
            <option value="Salário">Salário</option>
            <option value="Freelance">Freelance</option>
            <option value="Investimento">Investimento</option>
            <option value="Outros">Outros</option>
        `;

        categorySelect.style.display = "none";
    }

    else {

        originLabel.textContent = "Forma de pagamento";

        originSelect.innerHTML = `
            <option value="Dinheiro">Dinheiro</option>
            <option value="Pix">Pix</option>
            <option value="Alelo">Alelo</option>
            <option value="Bradesco">Bradesco</option>
            <option value="Caixa">Caixa</option>
            <option value="C6">C6</option>
            <option value="Itaú">Itaú</option>
            <option value="Nubank">Nubank</option>
        `;

        categorySelect.style.display = "block";

        loadCategoriesByType("despesa");
    }

}

/* ===============================
MODAL
=============================== */

function openTransactionModal() {

    const form = $("transaction-form");

    form.reset();
    updateOriginField();

    $("transaction-date").value =
        new Date().toISOString().split("T")[0];

    transactionModal.classList.add("active");
}

$("open-modal").onclick = openTransactionModal;
$("fab-add").onclick = openTransactionModal;

$("cancel-transaction").onclick =
    () => transactionModal.classList.remove("active");


/* ===============================
CHART LAZY LOAD
=============================== */

function lazyLoadChart() {

    const container = document.querySelector(".chart-container");

    const observer = new IntersectionObserver(entries => {

        entries.forEach(entry => {

            if (entry.isIntersecting) {

                chartVisible = true;
                chartDirty = true;

                render({ chart: true });

                observer.disconnect();
            }
        });

    }, { threshold: 0.3 });

    observer.observe(container);
}


/* ===============================
INIT
=============================== */

async function init() {

    await loadCardLimits();
    await loadTransactions();

    lazyLoadChart();
}

init();
let transactions = [];
let cardLimits = {};
let goal = Number(localStorage.getItem("goal")) || 0;
let chart;
let selectedCard = null;
let chartMode = "cartao"; // cartao ou relacao
let chartPeriod = "tudo"; // mes, ano, tudo
let editingTransactionId = null;
let chartDirty = true;
let filteredCache = null;
let transactionsById = {};
let isMobile = window.innerWidth < 768;
let chartVisible = false;

const transactionsList = document.getElementById("transactions-list");
const cardSummary = document.getElementById("card-summary-list");
const goalInput = document.getElementById("goal-input");
const goalStatus = document.getElementById("goal-status");
const progressFill = document.getElementById("progress-fill");
const transactionModal = document.getElementById("transaction-modal");
const typeSelect = document.getElementById("transaction-type");
const originSelect = document.getElementById("transaction-origin");
const originLabel = document.getElementById("origin-label");
const originGroup = document.getElementById("origin-group");
const categorySelect = document.getElementById("transaction-category");
const API_URL = "/api";
const $ = (id) => document.getElementById(id);

typeSelect.addEventListener("change", updateOriginField);

if (transactionsList) {
    transactionsList.addEventListener("click", handleTableClick);
}

async function loadTransactions() {

    transactionsList.innerHTML = `
    <tr class="skeleton"><td colspan="6" style="height:40px"></td></tr>
    <tr class="skeleton"><td colspan="6" style="height:40px"></td></tr>
    <tr class="skeleton"><td colspan="6" style="height:40px"></td></tr>
    `;

    const response = await fetch(`${API_URL}/transacoes`);
    const data = await response.json();

    transactions = data.map(t => ({
        id: t.id,
        date: t.date,
        type: t.type,
        description: t.description,
        amount: Number(t.amount),
        origin: t.origin
    }));

    transactionsById = {};

    transactions.forEach(t => {
        transactionsById[t.id] = t;
    });

    chartDirty = true;

    populateCardFilter();

    render();
}

async function loadCardLimits() {

    const response = await fetch(`${API_URL}/limites`);
    const data = await response.json();

    cardLimits = {};

    data.forEach(l => {
        cardLimits[l.cartao] = Number(l.limite);
    });

}

async function loadCategoriesByType(tipo) {

    const response = await fetch(`${API_URL}/categorias/${tipo}`);
    const categories = await response.json();

    categorySelect.innerHTML = "";

    categories.forEach(cat => {

        const option = document.createElement("option");
        option.value = cat.nome;
        option.textContent = cat.nome;

        categorySelect.appendChild(option);

    });

}

function getFilteredTransactions() {

    if (!filteredCache) {
        filteredCache = applyFilters();
    }

    return filteredCache;

}

function handleTableClick(e) {

    const btn = e.target.closest("button");
    if (!btn) return;

    const row = btn.closest("tr");
    const id = Number(row.dataset.id);

    if (btn.classList.contains("delete-btn")) {
        deleteTransaction(id);
    }

    if (btn.classList.contains("edit-btn")) {
        makeRowEditable(row, id);
    }

    if (btn.classList.contains("save-btn")) {
        saveInlineEdit(row, id);
    }

    if (btn.classList.contains("cancel-btn")) {
        render({ table: true });
    }
}

async function saveInlineEdit(row, id) {

    const data = {
        descricao: row.querySelector(".edit-desc").value,
        valor: Number(row.querySelector(".edit-amount").value),
        tipo: row.querySelector(".edit-type").value,
        origem: row.querySelector(".edit-origin").value,
        data: row.querySelector(".edit-date").value
    };

    await fetch(`${API_URL}/transacoes/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    /* ATUALIZA ARRAY LOCAL */

    const t = transactionsById[id];

    if (t) {
        t.description = data.descricao;
        t.amount = data.valor;
        t.type = data.tipo;
        t.origin = data.origem;
        t.date = data.data;
    }

    filteredCache = null;
    chartDirty = true;

    if (isMobile) {
        updateMobileCard(id);
    } else {
        replaceRow(id);
    }

    render({
        chart: true,
        cards: true,
        balance: true
    });
}

function makeRowEditable(row, id) {

    const t = transactionsById[id];
    if (!t) return;

    row.dataset.id = id;

    row.innerHTML = `
        <td>
            <input type="date" value="${t.date}" class="edit-date">
        </td>

        <td>
            <select class="edit-type">
                <option value="receita" ${t.type === "receita" ? "selected" : ""}>Receita</option>
                <option value="despesa" ${t.type === "despesa" ? "selected" : ""}>Despesa</option>
            </select>
        </td>

        <td>
            <input type="text" value="${t.description}" class="edit-desc">
        </td>

        <td>
            <input type="text" value="${t.origin}" class="edit-origin">
        </td>

        <td>
            <input type="number" value="${t.amount}" class="edit-amount">
        </td>

        <td>
            <button class="save-btn">💾</button>
            <button class="cancel-btn">✖</button>
        </td>
    `;

}

function editTransaction(id) {

    const transaction = transactionsById[id];

    if (!transaction) return;

    editingTransactionId = id;

    document.getElementById("transaction-description").value = transaction.description;
    document.getElementById("transaction-amount").value = transaction.amount;
    document.getElementById("transaction-type").value = transaction.type;
    $("transaction-date").value = transaction.date;

    updateOriginField();

    setTimeout(() => {
        document.getElementById("transaction-origin").value = transaction.origin;
    }, 50);

    transactionModal.classList.add("active");

}

function formatDate(dateString) {

    if (!dateString) return "-";

    const date = new Date(dateString);

    return date.toLocaleDateString("pt-BR", {
        timeZone: "UTC"
    });

}

function populateCardFilter() {
    const filterCard = document.getElementById("filter-card");
    filterCard.innerHTML = `<option value="todos">Todos Cartões</option>`;

    const cards = [...new Set(
        transactions
            .filter(t => t.type === "despesa")
            .map(t => t.origin)
    )];

    cards.forEach(card => {
        filterCard.innerHTML += `<option value="${card}">${card}</option>`;
    });
}

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

    else if (typeSelect.value === "despesa") {

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

document.getElementById("cancel-transaction").onclick = function () {
    transactionModal.classList.remove("active");
};

document.getElementById("toggle-chart-mode").onclick = function () {
    chartMode = chartMode === "cartao" ? "relacao" : "cartao";
    this.textContent = "Modo: " + (chartMode === "cartao" ? "Cartão" : "Receita x Despesa");
    chartDirty = true;
    render({ chart: true });
};

document.getElementById("toggle-chart-period").onclick = function () {
    if (chartPeriod === "tudo") chartPeriod = "mes";
    else if (chartPeriod === "mes") chartPeriod = "ano";
    else chartPeriod = "tudo";

    this.textContent = "Período: " +
        (chartPeriod === "mes" ? "Mês" :
            chartPeriod === "ano" ? "Ano" : "Tudo");

    chartDirty = true;
    render({ chart: true });
};

// Executa ao carregar
updateOriginField();

transactionModal.addEventListener("click", function (e) {
    if (e.target === transactionModal) {
        transactionModal.classList.remove("active");
    }
});

function format(value) {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

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

function renderBalance() {

    const saldoElemento = document.getElementById("saldo");

    if (!saldoElemento) return;

    let total = 0;

    transactions.forEach(t => {
        if (t.type === "receita") total += t.amount;
        else total -= t.amount;
    });

    saldoElemento.textContent = format(total);
    saldoElemento.classList.toggle("negativo", total < 0);
}

function applyFilters() {

    const typeFilter = document.getElementById("filter-type").value;
    const cardFilter = document.getElementById("filter-card").value;
    const periodFilter = document.getElementById("filter-period").value;
    const orderFilter = document.getElementById("filter-order").value;

    let filtered = [...transactions];

    // FILTRO TIPO
    if (typeFilter !== "todos") {
        filtered = filtered.filter(t => t.type === typeFilter);
    }

    // FILTRO CARTÃO
    if (cardFilter !== "todos") {
        filtered = filtered.filter(t => t.origin === cardFilter);
    }

    // FILTRO PERÍODO
    const now = new Date();

    if (periodFilter === "mes") {
        filtered = filtered.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === now.getMonth() &&
                d.getFullYear() === now.getFullYear();
        });
    }

    if (periodFilter === "ano") {
        filtered = filtered.filter(t => {
            const d = new Date(t.date);
            return d.getFullYear() === now.getFullYear();
        });
    }

    // ORDENAÇÃO
    filtered.sort((a, b) => {
        return orderFilter === "asc"
            ? a.amount - b.amount
            : b.amount - a.amount;
    });

    return filtered;
}

function renderTable() {

    const filtered = getFilteredTransactions();

    if (isMobile) {
        renderMobileCards(filtered);
        return;
    }

    transactionsList.innerHTML = "";

    const fragment = document.createDocumentFragment();

    filtered.forEach((t) => {

        const row = document.createElement("tr");
        row.dataset.id = t.id;

        const date = document.createElement("td");
        date.textContent = formatDate(t.date);

        const type = document.createElement("td");
        type.textContent = t.type;

        const desc = document.createElement("td");
        desc.textContent = t.description;

        const origin = document.createElement("td");
        origin.textContent = t.origin || "-";

        const amount = document.createElement("td");
        amount.textContent = format(t.amount);

        const actions = document.createElement("td");

        const editBtn = document.createElement("button");
        editBtn.className = "edit-btn";
        editBtn.textContent = "✏";

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-btn";
        deleteBtn.textContent = "🗑";

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        row.appendChild(date);
        row.appendChild(type);
        row.appendChild(desc);
        row.appendChild(origin);
        row.appendChild(amount);
        row.appendChild(actions);

        fragment.appendChild(row);

    });

    transactionsList.appendChild(fragment);
}

function buildTransactionRow(t) {

    const row = document.createElement("tr");
    row.dataset.id = t.id;

    const date = document.createElement("td");
    date.textContent = formatDate(t.date);

    const type = document.createElement("td");
    type.textContent = t.type;

    const desc = document.createElement("td");
    desc.textContent = t.description;

    const origin = document.createElement("td");
    origin.textContent = t.origin || "-";

    const amount = document.createElement("td");
    amount.textContent = format(t.amount);

    const actions = document.createElement("td");

    const editBtn = document.createElement("button");
    editBtn.className = "edit-btn";
    editBtn.textContent = "✏";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "🗑";

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    row.appendChild(date);
    row.appendChild(type);
    row.appendChild(desc);
    row.appendChild(origin);
    row.appendChild(amount);
    row.appendChild(actions);

    return row;
}

function replaceRow(id) {

    const oldRow = transactionsList.querySelector(`tr[data-id="${id}"]`);
    if (!oldRow) return;

    const t = transactionsById[id];

    const newRow = buildTransactionRow(t);

    newRow.classList.add("row-updated");

    oldRow.replaceWith(newRow);

}

function updateTransactionRow(id) {

    const row = transactionsList.querySelector(`tr[data-id="${id}"]`);

    if (!row) return;

    const t = transactionsById[id];

    row.children[0].textContent = formatDate(t.date);
    row.children[1].textContent = t.type;
    row.children[2].textContent = t.description;
    row.children[3].textContent = t.origin || "-";
    row.children[4].textContent = format(t.amount);

}

async function deleteTransaction(id) {

    await fetch(`${API_URL}/transacoes/${id}`, {
        method: "DELETE"
    });

    await loadTransactions();
}

function renderCardSummary() {
    cardSummary.innerHTML = "";
    const totals = {};

    transactions.filter(t => t.type === "despesa")
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

<span>
${limit ? format(limit - total) : "Sem limite"}
</span>

<button class="limit-gear" onclick="openLimit('${card}')">
⚙
</button>

</td>
`;
        cardSummary.appendChild(row);
    });
}

function renderMobileCards(filtered) {

    transactionsList.innerHTML = "";

    const fragment = document.createDocumentFragment();

    filtered.forEach(t => {

        const card = document.createElement("div");
        card.className = "transaction-card";
        card.dataset.id = t.id;

        const header = document.createElement("div");
        header.className = "card-header";

        const title = document.createElement("strong");
        title.textContent = t.description;

        const value = document.createElement("span");
        value.className = t.type;
        value.textContent = format(t.amount);

        header.appendChild(title);
        header.appendChild(value);

        const body = document.createElement("div");
        body.className = "card-body";

        const origin = document.createElement("span");
        origin.textContent = t.origin;

        const date = document.createElement("span");
        date.textContent = formatDate(t.date);

        body.appendChild(origin);
        body.appendChild(date);

        const editBtn = document.createElement("button");
        editBtn.textContent = "Editar";
        editBtn.onclick = () => editTransaction(t.id);

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Excluir";
        deleteBtn.onclick = () => deleteTransaction(t.id);

        card.appendChild(header);
        card.appendChild(body);
        card.appendChild(editBtn);
        card.appendChild(deleteBtn);

        fragment.appendChild(card);

    });

    transactionsList.appendChild(fragment);

}

function updateMobileCard(id) {

    const card = transactionsList.querySelector(`.transaction-card[data-id="${id}"]`);
    if (!card) return;

    const t = transactionsById[id];

    const header = card.querySelector(".card-header");
    const body = card.querySelector(".card-body");

    header.querySelector("strong").textContent = t.description;

    const value = header.querySelector("span");
    value.className = t.type;
    value.textContent = format(t.amount);

    body.children[0].textContent = t.origin;
    body.children[1].textContent = formatDate(t.date);
}

function openLimit(card) {
    selectedCard = card;
    document.getElementById("limit-card-name").textContent = card;
    document.getElementById("limit-modal").classList.add("active");
}

document.getElementById("save-limit").onclick = async function () {

    const value = Number(document.getElementById("limit-input").value);

    await fetch(`${API_URL}/limites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            cartao: selectedCard,
            limite: value
        })
    });

    await loadCardLimits();

    document.getElementById("limit-modal").classList.remove("active");

    render();
};

document.getElementById("cancel-limit").onclick = function () {
    document.getElementById("limit-modal").classList.remove("active");
};

function renderGoal() {
    let total = 0;

    transactions.forEach(t => {
        if (t.type === "receita") total += t.amount;
        else total -= t.amount;
    });

    if (goal <= 0) {
        document.querySelector(".progress-bar").style.display = "none";
        goalStatus.textContent = "";
        return;
    }

    if (total <= 0) {

        document.querySelector(".progress-bar").style.display = "block";

        progressFill.style.width = "0%";

        let remaining = goal - total;

        goalStatus.textContent = `Faltam ${format(remaining)} para atingir a meta`;

        progressFill.style.background = "linear-gradient(90deg, #b91c1c, #ef4444)";

        return;
    }

    document.querySelector(".progress-bar").style.display = "block";

    let percent = Math.max(0, Math.min((total / goal) * 100, 100));
    progressFill.style.width = percent + "%";

    // 🎨 MUDANÇA DINÂMICA DE COR
    let color;

    if (percent < 30) {
        color = "linear-gradient(90deg, #b91c1c, #ef4444)"; // vermelho
    }
    else if (percent < 60) {
        color = "linear-gradient(90deg, #ea580c, #f97316)"; // laranja
    }
    else if (percent < 90) {
        color = "linear-gradient(90deg, #ca8a04, #facc15)"; // amarelo
    }
    else if (percent < 100) {
        color = "linear-gradient(90deg, #16a34a, #22c55e)"; // verde
    }
    else {
        color = "linear-gradient(90deg, #065f46, #10b981)"; // verde forte
    }

    progressFill.style.background = color;

    if (total >= goal) {
        goalStatus.textContent = `Meta atingida 🎉 (${format(goal)})`;

        progressFill.classList.add("goal-complete");

        // remove depois para permitir animar novamente futuramente
        setTimeout(() => {
            progressFill.classList.remove("goal-complete");
        }, 1200);

    } else {
        let remaining = goal - total;
        goalStatus.textContent = `Faltam ${format(remaining)} para atingir a meta`;
    }
}

document.getElementById("save-goal").onclick = function () {
    goal = Number(goalInput.value);
    localStorage.setItem("goal", goal);
    render();
};

function debounce(fn, delay = 300) {

    let timer;

    return function (...args) {

        clearTimeout(timer);

        timer = setTimeout(() => {
            fn.apply(this, args);
        }, delay);

    };

}

function renderChart() {

    const ctx = document.getElementById("expenseChart").getContext("2d");
    let filtered = [...transactions];
    const now = new Date();

    if (!filtered.length) return;

    // FILTRO PERÍODO
    if (chartPeriod === "mes") {
        filtered = filtered.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === now.getMonth() &&
                d.getFullYear() === now.getFullYear();
        });
    }

    if (chartPeriod === "ano") {
        filtered = filtered.filter(t => {
            const d = new Date(t.date);
            return d.getFullYear() === now.getFullYear();
        });
    }

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

        let receita = 0;
        let despesa = 0;

        filtered.forEach(t => {
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
                animation: {
                    duration: 700,
                    easing: "easeOutQuart"
                },
                plugins: {
                    legend: {
                        position: "bottom"
                    }
                }
            }
        });

    }
    document.getElementById("chart-skeleton").style.display = "none";
    document.getElementById("expenseChart").style.display = "block";
}

document.getElementById("transaction-form").onsubmit = async function (e) {

    e.preventDefault();

    const data = {
        descricao: document.getElementById("transaction-description").value,
        valor: Number(document.getElementById("transaction-amount").value),
        tipo: document.getElementById("transaction-type").value,
        origem: document.getElementById("transaction-origin").value,
        data: $("transaction-date").value
    };

    let editedId = editingTransactionId;

    if (editedId) {

        await fetch(`${API_URL}/transacoes/${editedId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        const t = transactionsById[editedId];

        if (t) {
            t.description = data.descricao;
            t.amount = data.valor;
            t.type = data.tipo;
            t.origin = data.origem;
            t.date = data.data;
        }

        replaceRow(editedId);

        editingTransactionId = null;

    } else {

        const response = await fetch(`${API_URL}/transacoes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        const newTransaction = await response.json();

        transactions.push({
            id: newTransaction.id,
            date: data.data,
            type: data.tipo,
            description: data.descricao,
            amount: data.valor,
            origin: data.origem
        });

        transactionsById[newTransaction.id] = transactions[transactions.length - 1];

        const newRow = buildTransactionRow(transactionsById[newTransaction.id]);
        newRow.classList.add("row-new");

        transactionsList.prepend(newRow);

    };

    document.getElementById("open-modal").onclick = function () {



        const form = document.getElementById("transaction-form");

        form.reset();
        updateOriginField();

        $("transaction-date").value =
            new Date().toISOString().split("T")[0];

        document.getElementById("transaction-modal").classList.add("active");
    };

    document.getElementById("fab-add").onclick = () => {

        const form = document.getElementById("transaction-form");

        form.reset();
        updateOriginField();

        $("transaction-date").value =
            new Date().toISOString().split("T")[0];

        document.getElementById("transaction-modal").classList.add("active");

    };

    document.querySelectorAll(".filters select").forEach(select => {
        select.addEventListener("change", debounce(() => {

            filteredCache = null;
            chartDirty = true;

            render({
                table: true,
                chart: true
            });

        }, 150));
    });

    let resizeTimer;
    let lastWidth = window.innerWidth;

    window.addEventListener("resize", () => {

        if (window.innerWidth === lastWidth) return;

        lastWidth = window.innerWidth;

        clearTimeout(resizeTimer);

        resizeTimer = setTimeout(() => {

            isMobile = window.innerWidth < 768;

            render({
                table: true
            });

        }, 200);

    });

    function lazyLoadChart() {

        const chartContainer = document.querySelector(".chart-container");

        if (!chartContainer) return;

        const observer = new IntersectionObserver(entries => {

            entries.forEach(entry => {

                if (entry.isIntersecting) {

                    chartVisible = true;

                    chartDirty = true;

                    render({
                        chart: true
                    });

                    observer.disconnect();

                }

            });

        }, {
            threshold: 0.3
        });

        observer.observe(chartContainer);

    }

    async function init() {

        await loadCardLimits();
        await loadTransactions();

        lazyLoadChart();
    }
    init();
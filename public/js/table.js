import { transactionsById, isMobile, clearFiltersCache } from "./state.js";

import { format, formatDate } from "./utils.js";

import { getFilteredTransactions } from "./filters.js";

import { updateTransaction, deleteTransaction } from "./api.js";

import { render } from "./render.js";

import { editTransaction } from "./modal.js";

const transactionsList = document.getElementById("transactions-list");

/* =========================
   RENDER TABELA
========================= */

export function renderTable() {
  if (!transactionsList) return;

  const filtered = getFilteredTransactions();

  if (isMobile) {
    renderMobileCards(filtered);
    return;
  }

  transactionsList.innerHTML = "";

  const fragment = document.createDocumentFragment();

  for (const t of filtered) {
    const row = buildTransactionRow(t);

    fragment.appendChild(row);
  }

  transactionsList.appendChild(fragment);
}

/* =========================
   CRIAR LINHA
========================= */

export function buildTransactionRow(t) {
  const row = document.createElement("tr");

  row.dataset.id = t.id;

  row.innerHTML = `
        <td>${formatDate(t.date)}</td>

        <td class="${t.type}">
            ${t.type}
        </td>

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

/* =========================
   SUBSTITUIR LINHA
========================= */

export function replaceRow(id) {
  if (!transactionsList) return;

  const oldRow = transactionsList.querySelector(`tr[data-id="${id}"]`);

  if (!oldRow) return;

  const t = transactionsById[id];

  const newRow = buildTransactionRow(t);

  newRow.classList.add("row-updated");

  oldRow.replaceWith(newRow);
}

/* =========================
   ATUALIZAR LINHA
========================= */

export function updateTransactionRow(id) {
  if (!transactionsList) return;

  const row = transactionsList.querySelector(`tr[data-id="${id}"]`);

  if (!row) return;

  const t = transactionsById[id];

  row.children[0].textContent = formatDate(t.date);

  row.children[1].textContent = t.type;

  row.children[2].textContent = t.description;

  row.children[3].textContent = t.origin || "-";

  row.children[4].textContent = format(t.amount);
}

/* =========================
   EVENTOS DA TABELA
========================= */

export function handleTableClick(e) {
  const btn = e.target.closest("button");

  if (!btn) return;

  const row = btn.closest("tr");

  if (!row) return;

  const id = Number(row.dataset.id);

  if (btn.classList.contains("delete-btn")) {
    removeTransaction(id);
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

/* =========================
   EXCLUIR
========================= */

async function removeTransaction(id) {
  try {
    await deleteTransaction(id);

    clearFiltersCache();

    render();
  } catch (err) {
    console.error("Erro ao excluir transação:", err);
  }
}

/* =========================
   EDIÇÃO INLINE
========================= */

function makeRowEditable(row, id) {
  const t = transactionsById[id];

  if (!t) return;

  row.innerHTML = `

    <td>
    <input type="date" value="${t.date}" class="edit-date">
    </td>

    <td>
        <select class="edit-type">
            <option value="receita" ${t.type === "receita" ? "selected" : ""}>
                Receita
            </option>

            <option value="despesa" ${t.type === "despesa" ? "selected" : ""}>
                Despesa
            </option>
        </select>
    </td>

    <td>
        <input type="text" value="${t.description}" class="edit-desc">
    </td>

    <td>
        <input type="text" value="${t.origin || ""}" class="edit-origin">
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

/* =========================
   SALVAR EDIÇÃO INLINE
========================= */

async function saveInlineEdit(row, id) {
  try {
    const data = {
      descricao: row.querySelector(".edit-desc").value,

      valor: Number(row.querySelector(".edit-amount").value),

      tipo: row.querySelector(".edit-type").value,

      origem: row.querySelector(".edit-origin").value,

      data: row.querySelector(".edit-date").value,
    };

    await updateTransaction(id, data);

    clearFiltersCache();

    replaceRow(id);

    render({
      balance: true,
      cards: true,
      chart: true,
    });
  } catch (err) {
    console.error("Erro ao atualizar transação:", err);
  }
}

/* =========================
   MOBILE CARDS
========================= */

function renderMobileCards(filtered) {
  if (!transactionsList) return;

  transactionsList.innerHTML = "";

  const fragment = document.createDocumentFragment();

  for (const t of filtered) {
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
        <span>${t.origin || "-"}</span>
        <span>${formatDate(t.date)}</span>
    </div>

    <button class="edit-mobile">Editar</button>
    <button class="delete-mobile">Excluir</button>
`;

    card.querySelector(".edit-mobile").onclick = () => editTransaction(t.id);

    card.querySelector(".delete-mobile").onclick = () =>
      removeTransaction(t.id);

    fragment.appendChild(card);
  }

  transactionsList.appendChild(fragment);
}

import {
  transactions,
  transactionsById,
  cardLimits,
  clearFiltersCache,
} from "./state.js";

import { apiFetch } from "./auth.js";

function ensureOk(response) {
  if (!response.ok) {
    throw new Error("Erro na API");
  }
}

/* =========================
   TRANSAÇÕES
========================= */

export async function loadTransactions() {
  const response = await apiFetch("/transacoes");
  ensureOk(response);

  const data = await response.json();

  transactions.splice(0);

  Object.keys(transactionsById).forEach((k) => delete transactionsById[k]);

  data.forEach((t) => {
    const obj = {
      id: t.id,
      date: t.date.split("T")[0],
      type: t.type,
      description: t.description,
      amount: Number(t.amount),
      origin: t.origin,
    };

    transactions.push(obj);
    transactionsById[obj.id] = obj;
  });
}

/* =========================
   CRIAR TRANSAÇÃO
========================= */

export async function createTransaction(data) {
  const response = await apiFetch("/transacoes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  ensureOk(response);

  const newTransaction = await response.json();

  const obj = {
    id: newTransaction.id,
    date: newTransaction.date,
    type: newTransaction.type,
    description: newTransaction.description,
    amount: Number(newTransaction.amount),
    origin: newTransaction.origin,
  };

  transactions.push(obj);
  transactionsById[obj.id] = obj;

  clearFiltersCache();

  return obj;
}

/* =========================
   ATUALIZAR TRANSAÇÃO
========================= */

export async function updateTransaction(id, data) {
  const response = await apiFetch(`/transacoes/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  ensureOk(response);

  const t = transactionsById[id];

  if (t) {
    t.description = data.descricao;
    t.amount = data.valor;
    t.type = data.tipo;
    t.origin = data.origem;
    t.date = data.data;
  }

  clearFiltersCache();
}

/* =========================
   EXCLUIR TRANSAÇÃO
========================= */

export async function deleteTransaction(id) {
  const response = await apiFetch(`/transacoes/${id}`, {
    method: "DELETE",
  });
  ensureOk(response);

  const index = transactions.findIndex((t) => Number(t.id) === Number(id));

  if (index !== -1) {
    transactions.splice(index, 1);
  }

  delete transactionsById[id];

  clearFiltersCache();
}

/* =========================
   LIMITES DE CARTÃO
========================= */

export async function loadCardLimits() {
  const response = await apiFetch("/limites");
  ensureOk(response);

  const data = await response.json();

  Object.keys(cardLimits).forEach((k) => delete cardLimits[k]);

  data.forEach((l) => {
    cardLimits[l.cartao] = Number(l.limite);
  });
}

/* =========================
   SALVAR LIMITE
========================= */

export async function saveCardLimit(cartao, limite) {
  const response = await apiFetch("/limites", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cartao,
      limite,
    }),
  });
  ensureOk(response);

  cardLimits[cartao] = limite;
}

/* =========================
   CATEGORIAS
========================= */

export async function loadCategoriesByType(tipo) {
  const response = await apiFetch(`/categorias/${tipo}`);
  ensureOk(response);

  return await response.json();
}

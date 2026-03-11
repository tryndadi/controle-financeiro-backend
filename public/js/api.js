import {
    transactions,
    transactionsById,
    cardLimits,
    clearFiltersCache
} from "./state.js";

const API_URL = "/api";


/* =========================
   TRANSAÇÕES
========================= */

export async function loadTransactions() {

    const response = await fetch(`${API_URL}/transacoes`);
    if (!response.ok) {
        throw new Error("Erro na API");
    }

    const data = await response.json();

    transactions.splice(0);

    Object.keys(transactionsById).forEach(k => delete transactionsById[k]);

    data.forEach(t => {

        const obj = {
            id: t.id,
            date: t.date,
            type: t.type,
            description: t.description,
            amount: Number(t.amount),
            origin: t.origin
        };

        transactions.push(obj);
        transactionsById[obj.id] = obj;

    });

}



/* =========================
   CRIAR TRANSAÇÃO
========================= */

export async function createTransaction(data) {

    const response = await fetch(`${API_URL}/transacoes`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    const newTransaction = await response.json();

    const obj = {
        id: newTransaction.id,
        date: newTransaction.date,
        type: newTransaction.type,
        description: newTransaction.description,
        amount: Number(newTransaction.amount),
        origin: newTransaction.origin
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

    await fetch(`${API_URL}/transacoes/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

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

    await fetch(`${API_URL}/transacoes/${id}`, {
        method: "DELETE"
    });

    const index = transactions.findIndex(t => Number(t.id) === Number(id));

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

    const response = await fetch(`${API_URL}/limites`);
    if (!response.ok) {
        throw new Error("Erro na API");
    }

    const data = await response.json();

    Object.keys(cardLimits).forEach(k => delete cardLimits[k]);

    data.forEach(l => {
        cardLimits[l.cartao] = Number(l.limite);
    });

}



/* =========================
   SALVAR LIMITE
========================= */

export async function saveCardLimit(cartao, limite) {

    await fetch(`${API_URL}/limites`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            cartao,
            limite
        })
    });

    cardLimits[cartao] = limite;

}



/* =========================
   CATEGORIAS
========================= */

export async function loadCategoriesByType(tipo) {

    const response = await fetch(`${API_URL}/categorias/${tipo}`);

    return await response.json();

}
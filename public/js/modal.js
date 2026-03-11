import {
    transactions,
    transactionsById,
    editingTransactionId,
    setEditingTransaction,
    clearEditingTransaction,
    selectedCard,
    setSelectedCard
} from "./state.js";

import {
    createTransaction,
    updateTransaction,
    saveCardLimit,
    loadCardLimits,
    loadCategoriesByType
} from "./api.js";

import { render } from "./render.js";

import { $, todayISO } from "./utils.js";

import { replaceRow, buildTransactionRow } from "./table.js";


/* =========================
   ELEMENTOS
========================= */

const transactionModal = $("transaction-modal");
const limitModal = $("limit-modal");

const typeSelect = $("transaction-type");
const originSelect = $("transaction-origin");
const originLabel = $("origin-label");
const categorySelect = $("transaction-category");



/* =========================
   ABRIR MODAL NOVA TRANSAÇÃO
========================= */

export function openTransactionModal() {

    const form = $("transaction-form");

    form.reset();

    updateOriginField();

    $("transaction-date").value = todayISO();

    clearEditingTransaction();

    transactionModal.classList.add("active");

}



/* =========================
   EDITAR TRANSAÇÃO
========================= */

export async function editTransaction(id) {

    const t = transactionsById[id];

    if (!t) return;

    setEditingTransaction(id);

    $("transaction-description").value = t.description;
    $("transaction-amount").value = t.amount;
    $("transaction-type").value = t.type;
    $("transaction-date").value = t.date;

    await updateOriginField();

    $("transaction-origin").value = t.origin;

    transactionModal.classList.add("active");

}

/* =========================
   FECHAR MODAL
========================= */

export function closeTransactionModal() {

    transactionModal.classList.remove("active");

}



/* =========================
   SALVAR TRANSAÇÃO
========================= */

export async function handleTransactionSubmit(e) {

    e.preventDefault();

    try {

        const data = {
            descricao: $("transaction-description").value,
            valor: Number($("transaction-amount").value),
            tipo: $("transaction-type").value,
            origem: $("transaction-origin").value,
            data: $("transaction-date").value
        };

        if (editingTransactionId) {

            await updateTransaction(editingTransactionId, data);

            replaceRow(editingTransactionId);

            clearEditingTransaction();

        } else {

            const newTransaction =
                await createTransaction(data);

            const row =
                buildTransactionRow(newTransaction);

            row.classList.add("row-new");

            $("transactions-list").prepend(row);

        }

        closeTransactionModal();

        $("transaction-form").reset();

        await updateOriginField();

        render({
            balance: true,
            cards: true,
            chart: true
        });

    }

    catch (err) {

        console.error("Erro ao salvar transação:", err);

    }

}



/* =========================
   ORIGEM / CATEGORIA
========================= */

export async function updateOriginField() {

    if (!originSelect || !typeSelect) return;

    originSelect.innerHTML = "";

    if (typeSelect.value === "receita") {

        originLabel.textContent = "Origem";

        originSelect.innerHTML = `
            <option value="Salário">Salário</option>
            <option value="Freelance">Freelance</option>
            <option value="Investimento">Investimento</option>
            <option value="Outros">Outros</option>
        `;

        if (categorySelect) categorySelect.style.display = "none";

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

        if (categorySelect) {

            categorySelect.style.display = "block";

            const categories =
                await loadCategoriesByType("despesa");

            categorySelect.innerHTML = "";

            categories.forEach(cat => {

                const option =
                    document.createElement("option");

                option.value = cat.nome;
                option.textContent = cat.nome;

                categorySelect.appendChild(option);

            });

        }

    }

}



/* =========================
   MODAL LIMITE CARTÃO
========================= */

export function openLimitModal(card) {

    setSelectedCard(card);

    $("limit-card-name").textContent = card;

    limitModal.classList.add("active");

}



export function closeLimitModal() {

    limitModal.classList.remove("active");

}



/* =========================
   SALVAR LIMITE
========================= */

export async function saveLimit() {

    const value = Number($("limit-input").value);

    await saveCardLimit(selectedCard, value);

    await loadCardLimits();

    closeLimitModal();

    render({ cards: true });

}



/* =========================
   INICIALIZAR EVENTOS
========================= */

export function initModalEvents() {

    $("transaction-form").onsubmit = handleTransactionSubmit;

    $("cancel-transaction").onclick = closeTransactionModal;

    $("save-limit").onclick = saveLimit;

    $("cancel-limit").onclick = closeLimitModal;

    typeSelect.addEventListener("change", updateOriginField);

    transactionModal.addEventListener("click", e => {

        if (e.target === transactionModal) {

            closeTransactionModal();

        }

    });

}
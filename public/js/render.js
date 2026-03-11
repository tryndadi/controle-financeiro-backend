import { transactions, goal, chartDirty, chartVisible } from "./state.js";

import { renderTable } from "./table.js";
import { renderChart } from "./chart.js";
import { renderCardSummary } from "./cards.js";

import { format } from "./utils.js";


/* =========================
   RENDER PRINCIPAL
========================= */

export function render({
    balance = true,
    table = true,
    cards = true,
    goalRender = true,
    chart = true
} = {}) {

    if (balance) renderBalance();

    if (table) renderTable();

    if (cards) renderCardSummary();

    if (goalRender) renderGoal();

    if (chart && chartDirty && chartVisible) {
        renderChart();
    }

}


/* =========================
   CALCULAR SALDO
========================= */

function calculateBalance() {

    let total = 0;

    for (const t of transactions) {

        total += t.type === "receita"
            ? t.amount
            : -t.amount;

    }

    return total;

}


/* =========================
   SALDO TOTAL
========================= */

function renderBalance() {

    const saldoElemento = document.getElementById("saldo");

    if (!saldoElemento) return;

    const total = calculateBalance();

    saldoElemento.textContent = format(total);

    saldoElemento.classList.toggle("negativo", total < 0);

}


/* =========================
   META FINANCEIRA
========================= */

function renderGoal() {

    const goalStatus = document.getElementById("goal-status");
    const progressFill = document.getElementById("progress-fill");
    const progressBar = document.querySelector(".progress-bar");

    if (!goalStatus || !progressFill || !progressBar) return;

    const total = calculateBalance();

    if (goal <= 0) {

        progressBar.style.display = "none";

        goalStatus.textContent = "";

        return;

    }

    progressBar.style.display = "block";


    if (total <= 0) {

        progressFill.style.width = "0%";

        const remaining = goal - total;

        goalStatus.textContent =
            `Faltam ${format(remaining)} para atingir a meta`;

        progressFill.style.background =
            "linear-gradient(90deg, #b91c1c, #ef4444)";

        return;

    }


    const percent =
        Math.max(0, Math.min((total / goal) * 100, 100));

    progressFill.style.width = percent + "%";


    let color;

    if (percent < 30) {

        color = "linear-gradient(90deg, #b91c1c, #ef4444)";

    }

    else if (percent < 60) {

        color = "linear-gradient(90deg, #ea580c, #f97316)";

    }

    else if (percent < 90) {

        color = "linear-gradient(90deg, #ca8a04, #facc15)";

    }

    else if (percent < 100) {

        color = "linear-gradient(90deg, #16a34a, #22c55e)";

    }

    else {

        color = "linear-gradient(90deg, #065f46, #10b981)";

    }

    progressFill.style.background = color;


    if (total >= goal) {

        goalStatus.textContent =
            `Meta atingida 🎉 (${format(goal)})`;

        progressFill.classList.add("goal-complete");

        setTimeout(() => {

            progressFill.classList.remove("goal-complete");

        }, 1200);

    }

    else {

        const remaining = goal - total;

        goalStatus.textContent =
            `Faltam ${format(remaining)} para atingir a meta`;

    }

}
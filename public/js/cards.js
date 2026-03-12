import { transactions, cardLimits } from "./state.js";
import { format } from "./utils.js";
import { openLimitModal } from "./modal.js";

/* =========================
   RENDER RESUMO CARTÕES
========================= */

export function renderCardSummary() {
  const cardSummary = document.getElementById("card-summary-list");

  if (!cardSummary) return;

  cardSummary.innerHTML = "";

  const totals = {};

  /* =========================
       SOMAR DESPESAS
    ========================= */

  transactions
    .filter((t) => t.type === "despesa")
    .forEach((t) => {
      totals[t.origin] = (totals[t.origin] || 0) + t.amount;
    });

  /* =========================
       GARANTIR CARTÕES COM LIMITE
    ========================= */

  Object.keys(cardLimits).forEach((card) => {
    if (!totals[card]) {
      totals[card] = 0;
    }
  });

  /* =========================
       RENDER LINHAS
    ========================= */

  Object.entries(totals).forEach(([card, total]) => {
    const limit = cardLimits[card];

    const row = document.createElement("tr");

    let remainingText = "Sem limite";

    if (limit !== undefined) {
      const remaining = limit - total;

      remainingText = format(remaining);
    }

    row.innerHTML = `

            <td>${card}</td>

            <td>${format(total)}</td>

            <td class="limit-cell">

                <span>
                    ${remainingText}
                </span>

                <button class="limit-gear">
                    ⚙
                </button>

            </td>

        `;

    row.querySelector(".limit-gear").onclick = () => openLimitModal(card);

    cardSummary.appendChild(row);
  });
}

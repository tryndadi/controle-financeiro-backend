import {
  transactions,
  filteredCache,
  setFilteredCache,
  clearFiltersCache,
} from "./state.js";

import { render } from "./render.js";
import { debounce } from "./utils.js";

/* =========================
   RETORNAR FILTRADOS
========================= */

export function getFilteredTransactions() {
  if (!filteredCache) {
    setFilteredCache(applyFilters());
  }

  return filteredCache;
}

/* =========================
   APLICAR FILTROS
========================= */

export function applyFilters() {
  const typeFilter = document.getElementById("filter-type")?.value || "todos";

  const cardFilter = document.getElementById("filter-card")?.value || "todos";

  const periodFilter =
    document.getElementById("filter-period")?.value || "tudo";

  const orderFilter = document.getElementById("filter-order")?.value || "desc";

  let filtered = transactions;

  /* =========================
       FILTRO TIPO
    ========================= */

  if (typeFilter !== "todos") {
    filtered = filtered.filter((t) => t.type === typeFilter);
  }

  /* =========================
       FILTRO CARTÃO
    ========================= */

  if (cardFilter !== "todos") {
    filtered = filtered.filter((t) => t.origin === cardFilter);
  }

  /* =========================
       FILTRO PERÍODO
    ========================= */

  const now = new Date();

  if (periodFilter === "mes") {
    filtered = filtered.filter((t) => {
      const d = new Date(t.date);

      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    });
  }

  if (periodFilter === "ano") {
    filtered = filtered.filter((t) => {
      const d = new Date(t.date);

      return d.getFullYear() === now.getFullYear();
    });
  }

  /* =========================
       ORDENAÇÃO
    ========================= */

  filtered = [...filtered].sort((a, b) => {
    return orderFilter === "asc" ? a.amount - b.amount : b.amount - a.amount;
  });

  return filtered;
}

/* =========================
   POPULAR CARTÕES
========================= */

export function populateCardFilter() {
  const filterCard = document.getElementById("filter-card");

  if (!filterCard) return;

  filterCard.innerHTML = `
        <option value="todos">
            Todos Cartões
        </option>
    `;

  const cards = [
    ...new Set(
      transactions.filter((t) => t.type === "despesa").map((t) => t.origin),
    ),
  ];

  cards.forEach((card) => {
    const option = document.createElement("option");

    option.value = card;
    option.textContent = card;

    filterCard.appendChild(option);
  });
}

/* =========================
   INIT FILTROS
========================= */

export function initFilters() {
  document.querySelectorAll(".filters select").forEach((select) => {
    select.addEventListener(
      "change",

      debounce(() => {
        clearFiltersCache();

        render({
          table: true,
          chart: true,
        });
      }, 150),
    );
  });
}

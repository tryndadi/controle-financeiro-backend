/* =========================
   DOM HELPERS
========================= */

export const $ = (id) => {
  const el = document.getElementById(id);

  if (!el) {
    console.warn(`Elemento #${id} não encontrado`);
  }

  return el;
};

/* =========================
   FORMATAÇÃO DE MOEDA
========================= */

export function format(value) {
  const number = Number(value) || 0;

  return number.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/* =========================
   FORMATAÇÃO DE DATA
========================= */

export function formatDate(dateString) {
  if (!dateString) return "-";

  const [year, month, day] = dateString.split("-");

  return `${day}/${month}/${year}`;
}

/* =========================
   DEBOUNCE
========================= */

export function debounce(fn, delay = 300) {
  let timer;

  return function (...args) {
    clearTimeout(timer);

    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

/* =========================
   AGRUPAR POR CHAVE
========================= */

export function groupBy(array, key) {
  return array.reduce((acc, item) => {
    const value = item[key];

    if (!acc[value]) {
      acc[value] = [];
    }

    acc[value].push(item);

    return acc;
  }, {});
}

/* =========================
   SOMAR VALORES
========================= */

export function sum(array, field) {
  return array.reduce((total, item) => {
    return total + Number(item[field] || 0);
  }, 0);
}

/* =========================
   DATA HOJE (LOCAL)
========================= */

export function todayISO() {
  const today = new Date();

  const year = today.getFullYear();

  const month = String(today.getMonth() + 1).padStart(2, "0");

  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

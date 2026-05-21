import { getFilteredTransactions } from "./filters.js";

const CSV_COLUMNS = [
  ["date", "Data"],
  ["type", "Tipo"],
  ["description", "Descricao"],
  ["origin", "Origem"],
  ["amount", "Valor"],
];

function getPeriodLabel() {
  const period = document.getElementById("filter-period")?.value || "tudo";

  if (period === "semana") return "semana-atual";
  if (period === "mes") return "mes-atual";
  if (period === "ano") return "ano-atual";

  return "todos";
}

function sanitizeCell(value) {
  const text = String(value ?? "");
  const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;

  return `"${safeText.replace(/"/g, '""')}"`;
}

function buildCsv(transactions) {
  const header = CSV_COLUMNS.map(([, label]) => sanitizeCell(label)).join(";");

  const rows = transactions.map((transaction) =>
    CSV_COLUMNS.map(([key]) => {
      const value =
        key === "amount"
          ? Number(transaction[key] || 0).toFixed(2).replace(".", ",")
          : transaction[key];

      return sanitizeCell(value);
    }).join(";"),
  );

  return [header, ...rows].join("\r\n");
}

function downloadCsv(csv) {
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8;",
  });

  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.href = url;
  link.download = `controle-financeiro-${getPeriodLabel()}.csv`;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

export function exportFilteredTransactionsCsv() {
  const filtered = getFilteredTransactions();

  if (!filtered.length) {
    window.alert("Nao ha transacoes para exportar com os filtros atuais.");
    return;
  }

  downloadCsv(buildCsv(filtered));
}

export function initExportEvents() {
  const exportButton = document.getElementById("export-csv");

  if (exportButton) {
    exportButton.addEventListener("click", exportFilteredTransactionsCsv);
  }
}

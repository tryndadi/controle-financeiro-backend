import {
    transactions,
    chartMode,
    chartPeriod,
    setChart,
    setChartVisible
} from "./state.js";

let chartInstance = null;


/* =========================
   RENDER DO GRÁFICO
========================= */

export function renderChart() {

    const canvas = document.getElementById("expenseChart");

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    let filtered = transactions;

    const now = new Date();

    /* =========================
       FILTRO PERÍODO
    ========================= */

    if (chartPeriod === "mes") {

        filtered = filtered.filter(t => {

            const d = new Date(t.date + "T00:00:00");

            return (
                d.getMonth() === now.getMonth() &&
                d.getFullYear() === now.getFullYear()
            );

        });

    }

    if (chartPeriod === "ano") {

        filtered = filtered.filter(t => {

            const d = new Date(t.date + "T00:00:00");

            return d.getFullYear() === now.getFullYear();

        });

    }

    let labels = [];
    let data = [];



    /* =========================
       MODO CARTÃO
    ========================= */

    if (chartMode === "cartao") {

        const totals = {};

        filtered
            .filter(t => t.type === "despesa")
            .forEach(t => {

                totals[t.origin] =
                    (totals[t.origin] || 0) + t.amount;

            });

        labels = Object.keys(totals);
        data = Object.values(totals);

    }



    /* =========================
       RECEITA X DESPESA
    ========================= */

    else {

        let receita = 0;
        let despesa = 0;

        filtered.forEach(t => {

            if (t.type === "receita") receita += t.amount;
            else despesa += t.amount;

        });

        labels = ["Receita", "Despesa"];
        data = [receita, despesa];

    }



    /* =========================
       CRIAR / ATUALIZAR
    ========================= */

    if (chartInstance) {

        chartInstance.data.labels = labels;
        chartInstance.data.datasets[0].data = data;

        chartInstance.update();

    }

    else {

        chartInstance = new Chart(ctx, {

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
                        "#9b59b6",
                        "#1abc9c",
                        "#e67e22"
                    ]
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: "bottom" }
                }
            }

        });

        setChart(chartInstance);

    }



    const skeleton = document.getElementById("chart-skeleton");
    if (skeleton) skeleton.style.display = "none";

    canvas.style.display = "block";

}



/* =========================
   LAZY LOAD
========================= */

export function lazyLoadChart() {

    const chartContainer =
        document.querySelector(".chart-container");

    if (!chartContainer) return;

    const observer = new IntersectionObserver(entries => {

        entries.forEach(entry => {

            if (entry.isIntersecting) {

                setChartVisible(true);

                renderChart();

                observer.disconnect();

            }

        });

    }, {
        threshold: 0.3
    });

    observer.observe(chartContainer);

}
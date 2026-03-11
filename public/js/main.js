import { loadTransactions, loadCardLimits } from "./api.js";

import { render } from "./render.js";

import { initFilters, populateCardFilter } from "./filters.js";

import { initModalEvents, openTransactionModal } from "./modal.js";

import { handleTableClick } from "./table.js";

import { lazyLoadChart } from "./chart.js";

import { updateIsMobile } from "./state.js";


/* =========================
   EVENTOS GLOBAIS
========================= */

function initEvents() {

    const transactionsList =
        document.getElementById("transactions-list");

    const openModalBtn =
        document.getElementById("open-modal");

    const fabAddBtn =
        document.getElementById("fab-add");

    if (transactionsList) {

        transactionsList.addEventListener(
            "click",
            handleTableClick
        );

    }

    if (openModalBtn) {

        openModalBtn.onclick = openTransactionModal;

    }

    if (fabAddBtn) {

        fabAddBtn.onclick = openTransactionModal;

    }

}



/* =========================
   RESIZE
========================= */

let resizeTimer;
let lastWidth = window.innerWidth;

function initResizeListener() {

    window.addEventListener("resize", () => {

        if (window.innerWidth === lastWidth) return;

        lastWidth = window.innerWidth;

        clearTimeout(resizeTimer);

        resizeTimer = setTimeout(() => {

            updateIsMobile();

            render({
                table: true
            });

        }, 200);

    });

}



/* =========================
   CARREGAR DADOS
========================= */

async function loadInitialData() {

    await Promise.all([
        loadCardLimits(),
        loadTransactions()
    ]);

    populateCardFilter();

}



/* =========================
   INIT APP
========================= */

async function init() {

    updateIsMobile();

    initEvents();

    initFilters();

    initModalEvents();

    initResizeListener();

    lazyLoadChart();

    try {

        await loadInitialData();

        render();

    }

    catch (err) {

        console.error("Erro ao carregar dados:", err);

    }

}



init();
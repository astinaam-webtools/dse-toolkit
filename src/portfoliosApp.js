/**
 * Unified Portfolios page controller.
 * DOM ids referenced by this page — keep in sync with portfolio.html.
 */
import {
  parseCategoryParam,
  buildStockHoldings,
  buildFundHoldings,
  filterHoldings,
  buildOverview,
  withWeights
} from './lib/portfoliosOverview.js';
import { loadPortfolioState } from './lib/portfolioStore.js';
import { loadFundsDataDocument } from './lib/fundsStore.js';
import { createDefaultPortfolioState } from './lib/portfolioLogic.js';
import { createEmptyFundsData } from './lib/fundsLogic.js';

export const PF_DOM = {
  app: 'pf-app',
  seg: { all: 'pf-seg-all', stocks: 'pf-seg-stocks', funds: 'pf-seg-funds' },
  overview: 'pf-overview',
  holdingsCount: 'pf-holdings-count',
  holdingsList: 'pf-holdings-list',
  empty: 'pf-empty',
  manageBtn: 'pf-manage-btn',
  fab: 'pf-fab',
  exportImport: {
    exportStocks: 'pf-export-stocks',
    importStocks: 'pf-import-stocks',
    exportFunds: 'pf-export-funds',
    importFunds: 'pf-import-funds',
    importStocksFile: 'import-file',
    importFundsFile: 'file-import',
  },
  holdingSheet: {
    root: 'pf-holding-sheet',
    body: 'pf-holding-sheet-body',
    close: 'pf-holding-sheet-close',
    viewStock: 'pf-holding-view-stock',
    edit: 'pf-holding-edit',
    delete: 'pf-holding-delete',
  },
  typeSheet: {
    root: 'pf-type-sheet',
    close: 'pf-type-sheet-close',
    pickStock: 'pf-type-pick-stock',
    pickFund: 'pf-type-pick-fund',
  },
  manageSheet: {
    root: 'pf-manage-sheet',
    close: 'pf-manage-sheet-close',
    stocksSection: 'pf-manage-stocks-section',
    stocksList: 'pf-manage-stocks-list',
    createStock: 'pf-create-stock-portfolio',
    fundsSection: 'pf-manage-funds-section',
    fundsList: 'pf-manage-funds-list',
    createFund: 'pf-create-fund-portfolio',
  },
  stockModal: {
    root: 'stock-modal',
    title: 'modal-title',
    form: 'stock-form',
    close: 'close-modal',
    portfolioSelector: 'portfolio-selector',
  },
  fund: {
    modal: 'modal-fund',
    txModal: 'modal-tx',
    renameModal: 'modal-rename',
    portfolioModal: 'modal-portfolio',
    detailSheet: 'pf-fund-detail-sheet',
    addTx: 'pf-add-tx-btn',
  },
};

/** Same BDT pattern as portfolioApp.js `formatMoney`. */
const formatCurrency = (value) =>
  `৳ ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const plTone = (value) => (Number(value) >= 0 ? 'up' : 'down');

const formatPlLine = (pl, plPct) => {
  const sign = Number(pl) >= 0 ? '+' : '';
  const pctSign = Number(plPct) >= 0 ? '+' : '';
  return `${sign}${formatCurrency(pl)} (${pctSign}${Number(plPct || 0).toFixed(2)}%)`;
};

const formatPct = (value) => {
  const n = Number(value) || 0;
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
};

const els = {
  overview: document.getElementById(PF_DOM.overview),
  holdingsCount: document.getElementById(PF_DOM.holdingsCount),
  holdingsList: document.getElementById(PF_DOM.holdingsList),
  empty: document.getElementById(PF_DOM.empty),
  manageBtn: document.getElementById(PF_DOM.manageBtn),
  fab: document.getElementById(PF_DOM.fab),
  seg: {
    all: document.getElementById(PF_DOM.seg.all),
    stocks: document.getElementById(PF_DOM.seg.stocks),
    funds: document.getElementById(PF_DOM.seg.funds),
  },
  exportStocks: document.getElementById(PF_DOM.exportImport.exportStocks),
  importStocks: document.getElementById(PF_DOM.exportImport.importStocks),
  exportFunds: document.getElementById(PF_DOM.exportImport.exportFunds),
  importFunds: document.getElementById(PF_DOM.exportImport.importFunds),
};

let stockState = createDefaultPortfolioState();
let fundsData = createEmptyFundsData();
let marketData = { stocks: [] };

function getCategory() {
  return parseCategoryParam(new URL(location.href).searchParams.get('category'));
}

function setCategory(category) {
  const url = new URL(location.href);
  if (category === 'all') url.searchParams.delete('category');
  else url.searchParams.set('category', category);
  history.replaceState({}, '', url);
  render();
}

function syncSegment(category) {
  for (const [key, btn] of Object.entries(els.seg)) {
    if (!btn) continue;
    const active = key === category;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  }
}

function syncExportImport(category) {
  const showStocks = category === 'all' || category === 'stocks';
  const showFunds = category === 'all' || category === 'funds';
  if (els.exportStocks) els.exportStocks.hidden = !showStocks;
  if (els.importStocks) els.importStocks.hidden = !showStocks;
  if (els.exportFunds) els.exportFunds.hidden = !showFunds;
  if (els.importFunds) els.importFunds.hidden = !showFunds;
}

function overviewLabel(category) {
  if (category === 'stocks') return 'Stock value';
  if (category === 'funds') return 'Fund value';
  return 'Combined value';
}

function renderOverview(overview) {
  if (!els.overview) return;

  const { category, totalValue, totalPl, totalPlPct, stocks, funds, showSplit } = overview;
  const tone = plTone(totalPl);

  let extras = '';
  if (showSplit) {
    extras += `
      <div class="pf-pulse" title="Allocation" aria-hidden="true">
        <div class="pf-pulse__stocks" style="width:${Math.max(0, stocks.sharePct)}%"></div>
        <div class="pf-pulse__funds" style="width:${Math.max(0, funds.sharePct)}%"></div>
      </div>
      <div class="pf-split">
        <div>
          <div class="pf-overview__label"><span class="pf-badge pf-badge--stock">Stocks</span></div>
          <div class="pf-overview__value">${formatCurrency(stocks.value)}</div>
          <div class="delta ${plTone(stocks.pl)}">${stocks.sharePct.toFixed(0)}% · ${formatPct(stocks.plPct)}</div>
        </div>
        <div>
          <div class="pf-overview__label"><span class="pf-badge pf-badge--fund">Funds</span></div>
          <div class="pf-overview__value">${formatCurrency(funds.value)}</div>
          <div class="delta ${plTone(funds.pl)}">${funds.sharePct.toFixed(0)}% · ${formatPct(funds.plPct)}</div>
        </div>
      </div>
    `;
  } else if (category === 'funds') {
    extras += `
      <div class="pf-split">
        <div>
          <div class="pf-overview__label">Dividend reinvest</div>
          <div class="pf-overview__value">${formatCurrency(funds.dividendReinvest)}</div>
        </div>
      </div>
    `;
  }

  els.overview.innerHTML = `
    <div class="pf-overview__label">${overviewLabel(category)}</div>
    <div class="pf-overview__value">${formatCurrency(totalValue)}</div>
    <div class="delta ${tone}">${formatPlLine(totalPl, totalPlPct)}</div>
    ${extras}
  `;
}

function renderHoldings(rows) {
  if (!els.holdingsList || !els.empty) return;

  const empty = rows.length === 0;
  els.empty.hidden = !empty;
  els.holdingsList.hidden = empty;

  if (empty) {
    els.holdingsList.innerHTML = '';
    return;
  }

  els.holdingsList.innerHTML = rows
    .map((row) => {
      const badgeClass = row.category === 'fund' ? 'pf-badge--fund' : 'pf-badge--stock';
      const badgeLabel = row.category === 'fund' ? 'Fund' : 'Stock';
      const barClass = row.category === 'fund' ? 'is-fund' : '';
      const meta = `${row.portfolioName} · ${row.quantityLabel}`;
      return `
        <button type="button" class="pf-holding" data-holding-id="${escapeHtml(row.id)}">
          <div class="pf-holding__top">
            <div class="pf-holding__left">
              <div class="pf-holding__sym">
                ${escapeHtml(row.label)}
                <span class="pf-badge ${badgeClass}">${badgeLabel}</span>
              </div>
              <div class="pf-holding__meta">${escapeHtml(meta)}</div>
            </div>
            <div>
              <div class="pf-holding__sym">${formatCurrency(row.currentValue)}</div>
              <div class="delta ${plTone(row.plPct)}">${formatPct(row.plPct)}</div>
            </div>
          </div>
          <div class="pf-holding__bar" aria-hidden="true">
            <span class="${barClass}" style="width:${Math.max(0, row.weightPct)}%"></span>
          </div>
        </button>
      `;
    })
    .join('');

  els.holdingsList.querySelectorAll('.pf-holding').forEach((btn) => {
    btn.addEventListener('click', () => {
      console.warn('Holding sheet stub (Task 6–7)', btn.dataset.holdingId);
    });
  });
}

function render() {
  const category = getCategory();
  syncSegment(category);
  syncExportImport(category);

  const overview = buildOverview({ stockState, fundsData, marketData, category });
  const stockRows = buildStockHoldings(stockState, marketData);
  const fundRows = buildFundHoldings(fundsData);
  const filtered = filterHoldings([...stockRows, ...fundRows], category);
  const rows = withWeights(filtered, overview.totalValue);

  if (els.holdingsCount) {
    els.holdingsCount.textContent = String(overview.holdingCount);
  }

  renderOverview(overview);
  renderHoldings(rows);
}

function stubSoon(label) {
  console.warn(`${label} — deferred to Task 6–7`);
}

function bindEvents() {
  for (const [key, btn] of Object.entries(els.seg)) {
    btn?.addEventListener('click', () => setCategory(key));
  }

  els.manageBtn?.addEventListener('click', () => stubSoon('Manage portfolios'));
  els.fab?.addEventListener('click', () => stubSoon('Add holding FAB'));
  els.exportStocks?.addEventListener('click', () => stubSoon('Export stocks'));
  els.importStocks?.addEventListener('click', () => stubSoon('Import stocks'));
  els.exportFunds?.addEventListener('click', () => stubSoon('Export funds'));
  els.importFunds?.addEventListener('click', () => stubSoon('Import funds'));
}

async function loadMarketData() {
  const response = await fetch('./src/data/dse-market.json');
  if (!response.ok) {
    throw new Error('Failed to load market data');
  }
  marketData = await response.json();
}

async function loadDocuments() {
  try {
    stockState = await loadPortfolioState();
  } catch (error) {
    console.warn('Stock portfolio load failed; using empty state.', error);
    stockState = createDefaultPortfolioState();
  }

  try {
    fundsData = await loadFundsDataDocument();
  } catch (error) {
    console.warn('Funds data load failed; using empty state.', error);
    fundsData = createEmptyFundsData();
  }
}

async function init() {
  bindEvents();

  try {
    await loadMarketData();
  } catch (error) {
    console.warn('Market data unavailable; stock prices zeroed.', error);
    marketData = { stocks: [] };
  }

  await loadDocuments();
  render();
}

init();

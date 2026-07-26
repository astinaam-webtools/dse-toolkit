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
import { loadPortfolioState, savePortfolioStateDocument } from './lib/portfolioStore.js';
import { loadFundsDataDocument, saveFundsDataDocument } from './lib/fundsStore.js';
import {
  addStock,
  createDefaultPortfolioState,
  createPortfolio,
  deletePortfolio,
  deleteStock,
  exportToCSV,
  getActivePortfolio,
  importPortfolioData,
  listPortfolios,
  renamePortfolio,
  switchPortfolio,
  updateStock
} from './lib/portfolioLogic.js';
import {
  addFund,
  addTransaction,
  calculateFundStats,
  createEmptyFundsData,
  createPortfolio as createFundPortfolio,
  deleteFund,
  deletePortfolio as deleteFundPortfolio,
  deleteTransaction,
  editTransaction,
  parseImportedFundsData,
  renameFund,
  renamePortfolio as renameFundPortfolio,
  serializeFundsData,
  updateNav
} from './lib/fundsLogic.js';
import { AuthRequiredError, ConnectionUnavailableError } from './lib/serverClient.js';

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

const MODAL_MODE = {
  CREATE: 'create',
  EDIT: 'edit',
  ADD_SHARES: 'add-shares'
};

const EDITOR_PRECISION = 4;

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

const roundCost = (value, digits = EDITOR_PRECISION) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const formatDecimal = (value, digits = EDITOR_PRECISION) => Number(value).toFixed(digits);

const parseNumericInput = (input) => Number.parseFloat(input.value);

const getEffectivePerShareCost = (averageCost, commissionRate, commissionIncluded) =>
  commissionIncluded ? averageCost : averageCost * (1 + commissionRate);

const getItemTotalBasis = (item) => {
  const quantity = Number.parseFloat(item.quantity);
  const averageCost = Number.parseFloat(item.average_cost);
  const commissionRate = Number.parseFloat(item.commission_rate || 0);
  return quantity * getEffectivePerShareCost(averageCost, commissionRate, item.commission_included);
};

const mergePurchaseIntoPosition = (existingItem, purchaseItem) => {
  const existingQuantity = Number.parseFloat(existingItem.quantity);
  const purchaseQuantity = Number.parseFloat(purchaseItem.quantity);
  const totalQuantity = existingQuantity + purchaseQuantity;
  const totalBasis = getItemTotalBasis(existingItem) + getItemTotalBasis(purchaseItem);

  return {
    symbol: existingItem.symbol,
    quantity: totalQuantity,
    average_cost: totalQuantity > 0 ? totalBasis / totalQuantity : 0,
    commission_rate: 0,
    commission_included: true
  };
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
  importStocksFile: document.getElementById(PF_DOM.exportImport.importStocksFile),
  importFundsFile: document.getElementById(PF_DOM.exportImport.importFundsFile),
  holdingSheet: {
    root: document.getElementById(PF_DOM.holdingSheet.root),
    body: document.getElementById(PF_DOM.holdingSheet.body),
    close: document.getElementById(PF_DOM.holdingSheet.close),
    viewStock: document.getElementById(PF_DOM.holdingSheet.viewStock),
    edit: document.getElementById(PF_DOM.holdingSheet.edit),
    delete: document.getElementById(PF_DOM.holdingSheet.delete),
  },
  typeSheet: {
    root: document.getElementById(PF_DOM.typeSheet.root),
    close: document.getElementById(PF_DOM.typeSheet.close),
    pickStock: document.getElementById(PF_DOM.typeSheet.pickStock),
    pickFund: document.getElementById(PF_DOM.typeSheet.pickFund),
  },
  manageSheet: {
    root: document.getElementById(PF_DOM.manageSheet.root),
    close: document.getElementById(PF_DOM.manageSheet.close),
    stocksSection: document.getElementById(PF_DOM.manageSheet.stocksSection),
    stocksList: document.getElementById(PF_DOM.manageSheet.stocksList),
    createStock: document.getElementById(PF_DOM.manageSheet.createStock),
    fundsSection: document.getElementById(PF_DOM.manageSheet.fundsSection),
    fundsList: document.getElementById(PF_DOM.manageSheet.fundsList),
    createFund: document.getElementById(PF_DOM.manageSheet.createFund),
  },
  fund: {
    modal: document.getElementById(PF_DOM.fund.modal),
    close: document.getElementById('pf-fund-modal-close'),
    cancel: document.getElementById('pf-fund-modal-cancel'),
    save: document.getElementById('btn-save-fund'),
    portfolioSelector: document.getElementById('fund-portfolio-selector'),
    name: document.getElementById('inp-fund-name'),
    symbol: document.getElementById('inp-fund-symbol'),
    amc: document.getElementById('inp-fund-amc'),
    txModal: document.getElementById(PF_DOM.fund.txModal),
    txClose: document.getElementById('pf-tx-modal-close'),
    txCancel: document.getElementById('pf-tx-modal-cancel'),
    txTitle: document.getElementById('tx-modal-title'),
    txId: document.getElementById('inp-tx-id'),
    txType: document.getElementById('inp-tx-type'),
    txDate: document.getElementById('inp-tx-date'),
    txUnits: document.getElementById('inp-tx-units'),
    txPrice: document.getElementById('inp-tx-price'),
    txTotal: document.getElementById('inp-tx-total'),
    txSave: document.getElementById('btn-save-tx'),
    txDelete: document.getElementById('btn-delete-tx'),
    renameModal: document.getElementById(PF_DOM.fund.renameModal),
    renameClose: document.getElementById('pf-rename-modal-close'),
    renameCancel: document.getElementById('pf-rename-modal-cancel'),
    renameTitle: document.getElementById('rename-modal-title'),
    renameName: document.getElementById('inp-rename-name'),
    renameSymbolGroup: document.getElementById('grp-rename-symbol'),
    renameSymbol: document.getElementById('inp-rename-symbol'),
    renameSave: document.getElementById('btn-save-rename'),
    portfolioModal: document.getElementById(PF_DOM.fund.portfolioModal),
    portfolioClose: document.getElementById('pf-portfolio-modal-close'),
    portfolioCancel: document.getElementById('pf-portfolio-modal-cancel'),
    portfolioTitle: document.getElementById('portfolio-modal-title'),
    portfolioKind: document.getElementById('portfolio-modal-kind'),
    portfolioName: document.getElementById('inp-pf-name'),
    portfolioSave: document.getElementById('btn-save-pf'),
    detailSheet: document.getElementById(PF_DOM.fund.detailSheet),
    detailClose: document.getElementById('pf-fund-detail-close'),
    detailName: document.getElementById('detail-fund-name'),
    detailAmc: document.getElementById('detail-fund-amc'),
    navInput: document.getElementById('input-current-nav'),
    navDate: document.getElementById('input-nav-date'),
    navLastUpdated: document.getElementById('nav-last-updated'),
    updateNav: document.getElementById('btn-update-nav'),
    fdInvested: document.getElementById('fd-invested'),
    fdUnits: document.getElementById('fd-units'),
    fdValue: document.getElementById('fd-value'),
    fdAvgCost: document.getElementById('fd-avg-cost'),
    fdDividend: document.getElementById('fd-dividend'),
    fdGain: document.getElementById('fd-gain'),
    txList: document.getElementById('tx-list'),
    renameFundBtn: document.getElementById('btn-rename-fund'),
    deleteFundBtn: document.getElementById('btn-delete-fund'),
    addTxBtn: document.getElementById(PF_DOM.fund.addTx),
  },
  stock: {
    modal: document.getElementById(PF_DOM.stockModal.root),
    title: document.getElementById(PF_DOM.stockModal.title),
    form: document.getElementById(PF_DOM.stockModal.form),
    close: document.getElementById(PF_DOM.stockModal.close),
    portfolioSelector: document.getElementById(PF_DOM.stockModal.portfolioSelector),
    modalModeInput: document.getElementById('modal-mode'),
    modalModeSwitch: document.getElementById('modal-mode-switch'),
    editPositionModeBtn: document.getElementById('edit-position-mode'),
    addSharesModeBtn: document.getElementById('add-shares-mode'),
    positionGlance: document.getElementById('position-glance'),
    glanceQuantity: document.getElementById('glance-quantity'),
    glanceAverageCost: document.getElementById('glance-average-cost'),
    glanceTotalBasis: document.getElementById('glance-total-basis'),
    symbolList: document.getElementById('symbol-list'),
    deleteBtn: document.getElementById('delete-btn'),
    cancelPositionBtn: document.getElementById('cancel-position-btn'),
    savePositionBtn: document.getElementById('save-position-btn'),
    editIndex: document.getElementById('edit-index'),
    symbolInput: document.getElementById('symbol'),
    quantityInput: document.getElementById('quantity'),
    averageCostBaseInput: document.getElementById('avg-cost-base'),
    averageCostInput: document.getElementById('avg-cost'),
    totalCostInput: document.getElementById('total-cost'),
    commissionImpactNote: document.getElementById('comm-impact-note'),
    commissionRateInput: document.getElementById('comm-rate'),
    commissionAmountInput: document.getElementById('comm-amount'),
  },
};

let stockState = createDefaultPortfolioState();
let fundsData = createEmptyFundsData();
let marketData = { stocks: [] };
let holdingRows = [];
let selectedHolding = null;
/** Portfolio id targeted by the stock editor (row / selector), without requiring UI active switch. */
let editorPortfolioId = null;
/** Fund portfolio + fund currently open in the fund detail sheet. */
let currentFundPortfolioId = null;
let currentFundId = null;
/** Rename target: stock-portfolio | fund-portfolio | fund */
let renameTarget = null;
let lastCostEditedField = 'base';
let busy = false;

const formatTransactionType = (type) => {
  const labels = {
    BUY: 'Buy / SIP',
    SELL: 'Sell / redeem',
    DIVIDEND_REINVEST: 'Dividend reinvest / CIP'
  };
  return labels[type] || String(type || '').replaceAll('_', ' ');
};

const todayIsoDate = () => new Date().toISOString().split('T')[0];

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

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

function openOverlay(overlay) {
  if (!overlay) return;
  overlay.hidden = false;
  overlay.setAttribute('open', '');
  document.body.classList.add('sheet-open');
}

function closeOverlay(overlay) {
  if (!overlay) return;
  overlay.hidden = true;
  overlay.removeAttribute('open');
  if (!document.querySelector('.sheet-overlay[open]')) {
    document.body.classList.remove('sheet-open');
  }
}

function findStockItem(portfolioId, symbol) {
  const portfolio = listPortfolios(stockState).find((entry) => entry.id === portfolioId);
  if (!portfolio) return null;
  const index = (portfolio.items || []).findIndex((item) => item.symbol === symbol);
  if (index < 0) return null;
  return { portfolio, index, item: portfolio.items[index] };
}

/** Apply stock mutators against a portfolio id; keep prior activePortfolioId. */
function withStockPortfolio(portfolioId, mutate) {
  const previousActive = stockState.activePortfolioId;
  let next = switchPortfolio(stockState, portfolioId);
  next = mutate(next);
  if (previousActive && previousActive !== next.activePortfolioId) {
    next = { ...next, activePortfolioId: previousActive };
  }
  return next;
}

function fillPortfolioSelector(selectedId) {
  const selector = els.stock.portfolioSelector;
  if (!selector) return;
  const portfolios = listPortfolios(stockState);
  const preferred =
    selectedId ||
    editorPortfolioId ||
    getActivePortfolio(stockState)?.id ||
    portfolios[0]?.id ||
    '';
  selector.innerHTML = portfolios
    .map(
      (portfolio) =>
        `<option value="${escapeHtml(portfolio.id)}">${escapeHtml(portfolio.name)}</option>`
    )
    .join('');
  if (preferred) selector.value = preferred;
}

function getCommissionMultiplier() {
  const percent = parseNumericInput(els.stock.commissionRateInput);
  if (!Number.isFinite(percent) || percent < 0) return 1;
  return 1 + percent / 100;
}

function getBaseCostPerShare() {
  const baseCost = parseNumericInput(els.stock.averageCostBaseInput);
  if (!Number.isFinite(baseCost) || baseCost <= 0) return null;
  return baseCost;
}

function getQuantity() {
  const quantity = parseNumericInput(els.stock.quantityInput);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return quantity;
}

function syncTotalCostField({ format = false } = {}) {
  const quantity = getQuantity();
  const averageCost = parseNumericInput(els.stock.averageCostInput);

  if (!Number.isFinite(averageCost) || averageCost < 0 || !quantity) {
    els.stock.totalCostInput.value = format ? formatDecimal(0, EDITOR_PRECISION) : '0';
    return;
  }

  const totalCost = quantity * averageCost;
  els.stock.totalCostInput.value = format
    ? formatDecimal(totalCost, EDITOR_PRECISION)
    : String(roundCost(totalCost));
}

function updateCommissionImpactNote() {
  if (!els.stock.commissionImpactNote) return;

  const baseValue = parseNumericInput(els.stock.averageCostBaseInput);
  const averageValue = parseNumericInput(els.stock.averageCostInput);
  const quantity = parseNumericInput(els.stock.quantityInput);

  if (!Number.isFinite(baseValue) || !Number.isFinite(averageValue) || baseValue <= 0 || averageValue <= 0) {
    els.stock.commissionImpactNote.textContent = 'Commission impact: +৳0.00/share';
    return;
  }

  const perShareImpact = Math.max(0, averageValue - baseValue);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    els.stock.commissionImpactNote.textContent = `Commission impact: +${formatCurrency(perShareImpact)}/share`;
    return;
  }

  const totalImpact = perShareImpact * quantity;
  els.stock.commissionImpactNote.textContent = `Commission impact: +${formatCurrency(perShareImpact)}/share (${formatCurrency(totalImpact)} total)`;
}

function syncCommissionFields({ format = false } = {}) {
  const baseCostPerShare = getBaseCostPerShare();
  const quantity = getQuantity();
  const rateValue = parseNumericInput(els.stock.commissionRateInput);

  if (!Number.isFinite(rateValue) || rateValue < 0) return;

  if (!baseCostPerShare || !quantity) {
    els.stock.commissionAmountInput.value = format ? formatDecimal(0, EDITOR_PRECISION) : '0';
    if (format) {
      els.stock.commissionRateInput.value = formatDecimal(rateValue, EDITOR_PRECISION);
    }
    return;
  }

  const computedAmount = (baseCostPerShare * rateValue * quantity) / 100;
  els.stock.commissionAmountInput.value = format
    ? formatDecimal(computedAmount, EDITOR_PRECISION)
    : String(roundCost(computedAmount));
  if (format) {
    els.stock.commissionRateInput.value = formatDecimal(rateValue, EDITOR_PRECISION);
  }
}

function syncCostFields(source = lastCostEditedField, { format = false } = {}) {
  const multiplier = getCommissionMultiplier();
  const baseValue = parseNumericInput(els.stock.averageCostBaseInput);
  const averageValue = parseNumericInput(els.stock.averageCostInput);

  if (source === 'average') {
    if (!Number.isFinite(averageValue)) return;
    const computedBase = averageValue / multiplier;
    els.stock.averageCostBaseInput.value = format
      ? formatDecimal(roundCost(computedBase))
      : String(roundCost(computedBase));
    if (format) {
      els.stock.averageCostInput.value = formatDecimal(roundCost(averageValue));
    }
    syncTotalCostField({ format });
    syncCommissionFields({ format });
    updateCommissionImpactNote();
    return;
  }

  if (!Number.isFinite(baseValue)) return;

  const computedAverage = baseValue * multiplier;
  els.stock.averageCostInput.value = format
    ? formatDecimal(roundCost(computedAverage))
    : String(roundCost(computedAverage));
  if (format) {
    els.stock.averageCostBaseInput.value = formatDecimal(roundCost(baseValue));
  }
  syncTotalCostField({ format });
  syncCommissionFields({ format });
  updateCommissionImpactNote();
}

function hydrateCostFields({ averageCost = '', commissionRate = '', commissionIncluded = false } = {}) {
  els.stock.commissionRateInput.value = commissionRate;
  els.stock.commissionAmountInput.value = '';

  if (averageCost === '' || averageCost === null || averageCost === undefined) {
    els.stock.averageCostInput.value = '';
    els.stock.averageCostBaseInput.value = '';
    els.stock.totalCostInput.value = formatDecimal(0, EDITOR_PRECISION);
    els.stock.commissionAmountInput.value = formatDecimal(0, EDITOR_PRECISION);
    updateCommissionImpactNote();
    return;
  }

  const ratePercent = Number.parseFloat(commissionRate || 0);
  const multiplier = 1 + (Number.isFinite(ratePercent) ? ratePercent : 0) / 100;
  const normalizedAverageCost = Number(averageCost);
  const baseCost = commissionIncluded ? normalizedAverageCost / multiplier : normalizedAverageCost;
  const averageWithCommission = commissionIncluded
    ? normalizedAverageCost
    : normalizedAverageCost * multiplier;

  els.stock.averageCostBaseInput.value = formatDecimal(baseCost, EDITOR_PRECISION);
  els.stock.averageCostInput.value = formatDecimal(averageWithCommission, EDITOR_PRECISION);
  lastCostEditedField = 'base';
  syncCostFields('base', { format: true });
  syncTotalCostField({ format: true });
  syncCommissionFields({ format: true });
  updateCommissionImpactNote();
}

function getEditorItem() {
  const editIndex = Number.parseInt(els.stock.editIndex.value, 10);
  if (!editorPortfolioId || editIndex < 0) return null;
  const portfolio = listPortfolios(stockState).find((entry) => entry.id === editorPortfolioId);
  return portfolio?.items?.[editIndex] || null;
}

function setModalMode(mode) {
  els.stock.modalModeInput.value = mode;

  const isCreateMode = mode === MODAL_MODE.CREATE;
  const isAddSharesMode = mode === MODAL_MODE.ADD_SHARES;
  const currentItem = getEditorItem();

  els.stock.modalModeSwitch?.classList.toggle('is-visible', !isCreateMode);
  els.stock.editPositionModeBtn?.classList.toggle('is-active', mode === MODAL_MODE.EDIT);
  els.stock.addSharesModeBtn?.classList.toggle('is-active', isAddSharesMode);
  els.stock.positionGlance?.classList.toggle('is-visible', isAddSharesMode && Boolean(currentItem));
  if (els.stock.deleteBtn) {
    els.stock.deleteBtn.hidden = mode !== MODAL_MODE.EDIT;
  }
  if (els.stock.savePositionBtn) {
    els.stock.savePositionBtn.textContent = isAddSharesMode ? 'Add shares' : 'Save position';
  }
  if (els.stock.symbolInput) {
    els.stock.symbolInput.readOnly = isAddSharesMode;
  }
  if (els.stock.portfolioSelector) {
    els.stock.portfolioSelector.disabled = !isCreateMode || busy;
  }

  if (currentItem) {
    els.stock.glanceQuantity.textContent = Number.parseFloat(currentItem.quantity).toLocaleString();
    els.stock.glanceAverageCost.textContent = formatCurrency(currentItem.average_cost);
    els.stock.glanceTotalBasis.textContent = formatCurrency(getItemTotalBasis(currentItem));
  }

  if (isAddSharesMode) {
    els.stock.symbolInput.value = currentItem?.symbol || els.stock.symbolInput.value;
    els.stock.quantityInput.value = '';
    hydrateCostFields({ averageCost: '', commissionRate: '0.4', commissionIncluded: false });
    lastCostEditedField = 'base';
    return;
  }

  if (mode === MODAL_MODE.EDIT && currentItem) {
    els.stock.symbolInput.value = currentItem.symbol;
    els.stock.quantityInput.value = currentItem.quantity;
    hydrateCostFields({
      averageCost: currentItem.average_cost,
      commissionRate: (currentItem.commission_rate * 100).toFixed(EDITOR_PRECISION),
      commissionIncluded: currentItem.commission_included
    });
    lastCostEditedField = 'average';
  }
}

function closeHoldingSheet() {
  selectedHolding = null;
  closeOverlay(els.holdingSheet.root);
}

function openHoldingSheet(row) {
  selectedHolding = row;
  if (!els.holdingSheet.body) return;

  const badgeClass = row.category === 'fund' ? 'pf-badge--fund' : 'pf-badge--stock';
  const badgeLabel = row.category === 'fund' ? 'Fund' : 'Stock';

  els.holdingSheet.body.innerHTML = `
    <p class="eyebrow">${escapeHtml(badgeLabel)} holding</p>
    <h2 class="sheet__title">
      ${escapeHtml(row.label)}
      <span class="pf-badge ${badgeClass}">${badgeLabel}</span>
    </h2>
    <p class="pf-holding-sheet__portfolio">${escapeHtml(row.portfolioName)}</p>
    <div class="pf-holding-sheet__metrics">
      <div class="field">
        <span class="pf-stock-editor__note">Value</span>
        <strong>${formatCurrency(row.currentValue)}</strong>
      </div>
      <div class="field">
        <span class="pf-stock-editor__note">Cost</span>
        <strong>${formatCurrency(row.totalCost)}</strong>
      </div>
      <div class="field">
        <span class="pf-stock-editor__note">P/L</span>
        <strong class="delta ${plTone(row.pl)}">${formatPlLine(row.pl, row.plPct)}</strong>
      </div>
    </div>
  `;

  if (els.holdingSheet.viewStock) {
    const isStock = row.category === 'stock';
    els.holdingSheet.viewStock.hidden = !isStock;
    if (isStock) {
      els.holdingSheet.viewStock.href = `./stock.html?symbol=${encodeURIComponent(row.symbol)}`;
    } else {
      els.holdingSheet.viewStock.removeAttribute('href');
    }
  }

  openOverlay(els.holdingSheet.root);
}

function closeStockModal() {
  closeOverlay(els.stock.modal);
  if (els.stock.editIndex) els.stock.editIndex.value = '-1';
  editorPortfolioId = null;
  if (els.stock.portfolioSelector) els.stock.portfolioSelector.disabled = false;
}

function openStockModal({ index = -1, portfolioId = null } = {}) {
  if (!els.stock.modal) return;

  const portfolios = listPortfolios(stockState);
  if (portfolios.length === 0) {
    alert('Create a stock portfolio before adding positions.');
    return;
  }

  editorPortfolioId =
    portfolioId || getActivePortfolio(stockState)?.id || portfolios[0].id;
  fillPortfolioSelector(editorPortfolioId);
  els.stock.editIndex.value = String(index);
  openOverlay(els.stock.modal);

  if (index === -1) {
    els.stock.title.textContent = 'Add stock';
    els.stock.form.reset();
    fillPortfolioSelector(editorPortfolioId);
    hydrateCostFields({ averageCost: '', commissionRate: '0.4', commissionIncluded: false });
    lastCostEditedField = 'base';
    setModalMode(MODAL_MODE.CREATE);
    requestAnimationFrame(() => els.stock.symbolInput?.focus());
    return;
  }

  const item = getEditorItem();
  if (!item) {
    closeStockModal();
    return;
  }

  els.stock.title.textContent = 'Update position';
  els.stock.symbolInput.value = item.symbol;
  setModalMode(MODAL_MODE.EDIT);
  requestAnimationFrame(() => els.stock.quantityInput?.focus());
}

async function persistStockState(nextState) {
  busy = true;
  try {
    stockState = await savePortfolioStateDocument(nextState);
    render();
    if (els.manageSheet.root?.hasAttribute('open')) renderManageSheet();
    return true;
  } catch (error) {
    let message = error?.message || 'Unable to save the portfolio.';
    if (error instanceof AuthRequiredError) {
      message = error.message || 'Server login required.';
    } else if (error instanceof ConnectionUnavailableError) {
      message = error.message || 'Server unavailable.';
    }
    console.warn('Stock portfolio save failed', error);
    alert(message);
    return false;
  } finally {
    busy = false;
  }
}

async function handleStockFormSubmit(event) {
  event.preventDefault();
  if (busy) return;

  const symbol = els.stock.symbolInput.value.trim().toUpperCase();
  const quantity = Number.parseFloat(els.stock.quantityInput.value);
  const averageCostBase = Number.parseFloat(els.stock.averageCostBaseInput.value);
  const averageCost = Number.parseFloat(els.stock.averageCostInput.value);
  const commissionPercentRaw = els.stock.commissionRateInput.value.trim();
  const commissionPercent =
    commissionPercentRaw === '' ? 0 : Number.parseFloat(commissionPercentRaw);
  const commissionAmount =
    Number.isFinite(averageCostBase) && Number.isFinite(quantity)
      ? (averageCostBase * commissionPercent * quantity) / 100
      : 0;
  const modalMode = els.stock.modalModeInput.value;
  const targetPortfolioId =
    els.stock.portfolioSelector?.value || editorPortfolioId || getActivePortfolio(stockState)?.id;

  if (!symbol) {
    alert('Please enter a stock symbol.');
    els.stock.symbolInput.focus();
    return;
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    alert('Please enter a valid quantity greater than 0.');
    els.stock.quantityInput.focus();
    return;
  }
  if (!Number.isFinite(averageCostBase) || averageCostBase <= 0) {
    alert('Please enter a valid average cost without commission greater than 0.');
    els.stock.averageCostBaseInput.focus();
    return;
  }
  if (!Number.isFinite(averageCost) || averageCost <= 0) {
    alert('Please enter a valid average cost greater than 0.');
    els.stock.averageCostInput.focus();
    return;
  }
  if (!Number.isFinite(commissionPercent) || commissionPercent < 0) {
    alert('Please enter a valid commission rate (0 or higher).');
    els.stock.commissionRateInput.focus();
    return;
  }
  if (!Number.isFinite(commissionAmount) || commissionAmount < 0) {
    alert('Please enter a valid commission amount (0 or higher).');
    els.stock.commissionAmountInput.focus();
    return;
  }
  if (!targetPortfolioId) {
    alert('Please choose a stock portfolio.');
    return;
  }

  const index = Number.parseInt(els.stock.editIndex.value, 10);
  const item = {
    symbol,
    quantity,
    average_cost: averageCost,
    commission_rate: commissionPercent / 100,
    commission_included: true
  };

  let nextState;
  if (modalMode === MODAL_MODE.CREATE) {
    // Adding may legitimately switch active to the chosen portfolio (selector).
    nextState = addStock(switchPortfolio(stockState, targetPortfolioId), item);
  } else {
    nextState = withStockPortfolio(targetPortfolioId, (state) => {
      if (modalMode === MODAL_MODE.ADD_SHARES && index !== -1) {
        const existing = getActivePortfolio(state).items[index];
        if (!existing) return state;
        return updateStock(state, index, mergePurchaseIntoPosition(existing, item));
      }
      return index === -1 ? addStock(state, item) : updateStock(state, index, item);
    });
  }

  const saved = await persistStockState(nextState);
  if (saved) {
    closeStockModal();
    closeHoldingSheet();
  }
}

async function handleStockDeleteFromModal() {
  if (busy) return;
  const index = Number.parseInt(els.stock.editIndex.value, 10);
  const portfolioId = editorPortfolioId || els.stock.portfolioSelector?.value;
  if (index === -1 || !portfolioId) return;
  if (!confirm('Are you sure you want to delete this position?')) return;

  const nextState = withStockPortfolio(portfolioId, (state) => deleteStock(state, index));
  const saved = await persistStockState(nextState);
  if (saved) {
    closeStockModal();
    closeHoldingSheet();
  }
}

function findFund(portfolioId, fundId) {
  const portfolio = (fundsData.portfolios || []).find((entry) => entry.id === portfolioId);
  if (!portfolio) return null;
  const fund = (portfolio.funds || []).find((entry) => entry.id === fundId);
  if (!fund) return null;
  return { portfolio, fund };
}

async function persistFundsData(nextData) {
  busy = true;
  try {
    fundsData = await saveFundsDataDocument(nextData);
    render();
    if (els.manageSheet.root?.hasAttribute('open')) renderManageSheet();
    if (els.fund.detailSheet?.hasAttribute('open') && currentFundPortfolioId && currentFundId) {
      renderFundDetailSheet();
    }
    return true;
  } catch (error) {
    let message = error?.message || 'Unable to save mutual fund data.';
    if (error instanceof AuthRequiredError) {
      message = error.message || 'Server login required.';
    } else if (error instanceof ConnectionUnavailableError) {
      message = error.message || 'Server unavailable.';
    }
    console.warn('Funds save failed', error);
    alert(message);
    return false;
  } finally {
    busy = false;
  }
}

function fillFundPortfolioSelector(selectedId) {
  const selector = els.fund.portfolioSelector;
  if (!selector) return;
  const portfolios = fundsData.portfolios || [];
  const preferred =
    selectedId ||
    currentFundPortfolioId ||
    fundsData.activePortfolioId ||
    portfolios[0]?.id ||
    '';
  selector.innerHTML = portfolios
    .map(
      (portfolio) =>
        `<option value="${escapeHtml(portfolio.id)}">${escapeHtml(portfolio.name)}</option>`
    )
    .join('');
  if (preferred) selector.value = preferred;
}

function closeTypeSheet() {
  closeOverlay(els.typeSheet.root);
}

function openTypePicker() {
  openOverlay(els.typeSheet.root);
}

function closeFundModal() {
  closeOverlay(els.fund.modal);
}

function openAddFund({ portfolioId = null } = {}) {
  const portfolios = fundsData.portfolios || [];
  if (portfolios.length === 0) {
    alert('Create a fund portfolio before adding funds.');
    openCreatePortfolioModal('fund');
    return;
  }

  fillFundPortfolioSelector(portfolioId);
  if (els.fund.name) els.fund.name.value = '';
  if (els.fund.symbol) els.fund.symbol.value = '';
  if (els.fund.amc) els.fund.amc.value = '';
  openOverlay(els.fund.modal);
  requestAnimationFrame(() => els.fund.name?.focus());
}

function closeFundDetailSheet() {
  currentFundPortfolioId = null;
  currentFundId = null;
  closeOverlay(els.fund.detailSheet);
}

function renderFundDetailSheet() {
  const located = findFund(currentFundPortfolioId, currentFundId);
  if (!located || !els.fund.detailSheet) {
    closeFundDetailSheet();
    return;
  }

  const { fund } = located;
  if (els.fund.detailName) els.fund.detailName.textContent = fund.name;
  if (els.fund.detailAmc) els.fund.detailAmc.textContent = fund.amc || '';
  if (els.fund.navInput) els.fund.navInput.value = fund.current_nav || '';
  if (els.fund.navDate) els.fund.navDate.value = todayIsoDate();
  if (els.fund.navLastUpdated) {
    const lastUpdate = fund.last_updated
      ? new Date(fund.last_updated).toLocaleDateString()
      : 'Never';
    els.fund.navLastUpdated.textContent = `Last updated: ${lastUpdate}`;
  }

  const stats = calculateFundStats(fund);
  if (els.fund.fdInvested) els.fund.fdInvested.textContent = formatCurrency(stats.totalCost);
  if (els.fund.fdUnits) els.fund.fdUnits.textContent = stats.totalUnits.toFixed(2);
  if (els.fund.fdValue) els.fund.fdValue.textContent = formatCurrency(stats.currentValue);
  if (els.fund.fdAvgCost) els.fund.fdAvgCost.textContent = formatCurrency(stats.avgCost);
  if (els.fund.fdDividend) {
    els.fund.fdDividend.textContent = formatCurrency(stats.totalDividendReinvest);
  }
  if (els.fund.fdGain) {
    els.fund.fdGain.textContent = formatPlLine(stats.gainLoss, stats.gainLossPercent);
    els.fund.fdGain.className = `delta ${plTone(stats.gainLoss)}`;
  }

  if (els.fund.txList) {
    const transactions = [...(fund.transactions || [])].reverse();
    if (transactions.length === 0) {
      els.fund.txList.innerHTML =
        '<li class="pf-stock-editor__note">No transactions yet.</li>';
    } else {
      els.fund.txList.innerHTML = transactions
        .map(
          (transaction) => `
            <li>
              <button type="button" class="pf-tx-item" data-tx-id="${escapeHtml(transaction.id)}">
                <div>
                  <div>${escapeHtml(formatTransactionType(transaction.type))}</div>
                  <div class="pf-tx-item__sub">${escapeHtml(
                    new Date(transaction.date).toLocaleDateString()
                  )} @ ${escapeHtml(String(transaction.price_per_unit))}</div>
                </div>
                <div>
                  <div>${escapeHtml(String(transaction.units))} units</div>
                  <div class="pf-tx-item__sub">${formatCurrency(transaction.total_cost)}</div>
                </div>
              </button>
            </li>
          `
        )
        .join('');

      els.fund.txList.querySelectorAll('.pf-tx-item').forEach((btn) => {
        btn.addEventListener('click', () => {
          const transaction = fund.transactions.find((entry) => entry.id === btn.dataset.txId);
          if (transaction) openTransactionModal(transaction);
        });
      });
    }
  }
}

function openFundDetailSheet(portfolioId, fundId) {
  currentFundPortfolioId = portfolioId;
  currentFundId = fundId;
  if (!findFund(portfolioId, fundId)) {
    alert('Fund not found.');
    return;
  }
  renderFundDetailSheet();
  openOverlay(els.fund.detailSheet);
}

function closeTxModal() {
  closeOverlay(els.fund.txModal);
}

function openTransactionModal(transaction = null) {
  if (!currentFundPortfolioId || !currentFundId) return;

  if (els.fund.txTitle) {
    els.fund.txTitle.textContent = transaction ? 'Edit transaction' : 'Add transaction';
  }
  if (els.fund.txId) els.fund.txId.value = transaction?.id || '';
  if (els.fund.txType) els.fund.txType.value = transaction?.type || 'BUY';
  if (els.fund.txDate) els.fund.txDate.value = transaction?.date || todayIsoDate();
  if (els.fund.txUnits) els.fund.txUnits.value = transaction?.units ?? '';
  if (els.fund.txPrice) els.fund.txPrice.value = transaction?.price_per_unit ?? '';
  if (els.fund.txTotal) els.fund.txTotal.value = transaction?.total_cost ?? '';
  if (els.fund.txDelete) els.fund.txDelete.hidden = !transaction;
  openOverlay(els.fund.txModal);
}

function closeRenameModal() {
  renameTarget = null;
  closeOverlay(els.fund.renameModal);
}

function openRenameModal(target) {
  renameTarget = target;
  const showSymbol = target.type === 'fund';
  if (els.fund.renameSymbolGroup) els.fund.renameSymbolGroup.hidden = !showSymbol;

  if (target.type === 'stock-portfolio') {
    const portfolio = listPortfolios(stockState).find((entry) => entry.id === target.id);
    if (els.fund.renameTitle) els.fund.renameTitle.textContent = 'Rename stock portfolio';
    if (els.fund.renameName) els.fund.renameName.value = portfolio?.name || '';
  } else if (target.type === 'fund-portfolio') {
    const portfolio = (fundsData.portfolios || []).find((entry) => entry.id === target.id);
    if (els.fund.renameTitle) els.fund.renameTitle.textContent = 'Rename fund portfolio';
    if (els.fund.renameName) els.fund.renameName.value = portfolio?.name || '';
  } else {
    const located = findFund(target.portfolioId, target.id);
    if (els.fund.renameTitle) els.fund.renameTitle.textContent = 'Rename fund';
    if (els.fund.renameName) els.fund.renameName.value = located?.fund?.name || '';
    if (els.fund.renameSymbol) els.fund.renameSymbol.value = located?.fund?.symbol || '';
  }

  openOverlay(els.fund.renameModal);
  requestAnimationFrame(() => els.fund.renameName?.focus());
}

function closeCreatePortfolioModal() {
  closeOverlay(els.fund.portfolioModal);
}

function openCreatePortfolioModal(kind) {
  if (els.fund.portfolioKind) els.fund.portfolioKind.value = kind;
  if (els.fund.portfolioTitle) {
    els.fund.portfolioTitle.textContent =
      kind === 'stock' ? 'New stock portfolio' : 'New fund portfolio';
  }
  if (els.fund.portfolioName) els.fund.portfolioName.value = '';
  openOverlay(els.fund.portfolioModal);
  requestAnimationFrame(() => els.fund.portfolioName?.focus());
}

async function handleSaveFund() {
  if (busy) return;
  const name = els.fund.name?.value.trim() || '';
  const symbol = els.fund.symbol?.value.trim() || '';
  const amc = els.fund.amc?.value.trim() || '';
  const portfolioId =
    els.fund.portfolioSelector?.value ||
    fundsData.activePortfolioId ||
    fundsData.portfolios?.[0]?.id;

  if (!name) {
    alert('Name required');
    els.fund.name?.focus();
    return;
  }
  if (!portfolioId) {
    alert('Create a fund portfolio before adding funds.');
    return;
  }

  const saved = await persistFundsData(addFund(fundsData, portfolioId, name, amc, symbol));
  if (saved) {
    closeFundModal();
    const portfolio = fundsData.portfolios.find((entry) => entry.id === portfolioId);
    const created = portfolio?.funds?.[portfolio.funds.length - 1];
    if (created) openFundDetailSheet(portfolioId, created.id);
  }
}

async function handleUpdateNav() {
  if (busy || !currentFundPortfolioId || !currentFundId) return;
  const nav = els.fund.navInput?.value;
  const date = els.fund.navDate?.value || todayIsoDate();
  if (!nav) {
    alert('Please enter NAV');
    els.fund.navInput?.focus();
    return;
  }
  await persistFundsData(updateNav(fundsData, currentFundPortfolioId, currentFundId, nav, date));
}

async function handleDeleteFundFromDetail() {
  if (busy || !currentFundPortfolioId || !currentFundId) return;
  if (!confirm('Are you sure you want to delete this fund and all its transactions?')) return;

  const saved = await persistFundsData(
    deleteFund(fundsData, currentFundPortfolioId, currentFundId)
  );
  if (saved) {
    closeFundDetailSheet();
    closeHoldingSheet();
  }
}

async function handleSaveTransaction() {
  if (busy || !currentFundPortfolioId || !currentFundId) return;

  const id = els.fund.txId?.value || '';
  const type = els.fund.txType?.value || 'BUY';
  const date = els.fund.txDate?.value || '';
  const units = els.fund.txUnits?.value || '';
  const price = els.fund.txPrice?.value || '';
  const total = els.fund.txTotal?.value || '';

  if (!date || !units || !price || !total) {
    alert('All fields required');
    return;
  }

  const transactionData = {
    type,
    date,
    units,
    price_per_unit: price,
    total_cost: total
  };
  const nextData = id
    ? editTransaction(fundsData, currentFundPortfolioId, currentFundId, id, transactionData)
    : addTransaction(fundsData, currentFundPortfolioId, currentFundId, transactionData);

  const saved = await persistFundsData(nextData);
  if (saved) closeTxModal();
}

async function handleDeleteTransaction() {
  if (busy || !currentFundPortfolioId || !currentFundId) return;
  const id = els.fund.txId?.value || '';
  if (!id || !confirm('Are you sure you want to delete this transaction?')) return;

  const saved = await persistFundsData(
    deleteTransaction(fundsData, currentFundPortfolioId, currentFundId, id)
  );
  if (saved) closeTxModal();
}

async function handleSaveRename() {
  if (busy || !renameTarget) return;
  const name = els.fund.renameName?.value.trim() || '';
  if (!name) {
    alert('Name required');
    els.fund.renameName?.focus();
    return;
  }

  let saved = false;
  if (renameTarget.type === 'stock-portfolio') {
    saved = await persistStockState(renamePortfolio(stockState, renameTarget.id, name));
  } else if (renameTarget.type === 'fund-portfolio') {
    saved = await persistFundsData(renameFundPortfolio(fundsData, renameTarget.id, name));
  } else {
    const symbol = els.fund.renameSymbol?.value.trim() || '';
    saved = await persistFundsData(
      renameFund(fundsData, renameTarget.portfolioId, renameTarget.id, name, symbol)
    );
  }

  if (saved) {
    closeRenameModal();
    if (els.manageSheet.root?.hasAttribute('open')) renderManageSheet();
  }
}

async function handleCreatePortfolio() {
  if (busy) return;
  const kind = els.fund.portfolioKind?.value || 'fund';
  const name = els.fund.portfolioName?.value.trim() || '';
  if (!name) {
    alert('Name required');
    els.fund.portfolioName?.focus();
    return;
  }

  const saved =
    kind === 'stock'
      ? await persistStockState(createPortfolio(stockState, name))
      : await persistFundsData(createFundPortfolio(fundsData, name));

  if (saved) {
    closeCreatePortfolioModal();
    if (els.manageSheet.root?.hasAttribute('open')) renderManageSheet();
  }
}

function renderManageList(kind) {
  if (kind === 'stocks') {
    const portfolios = listPortfolios(stockState);
    const activeId = stockState.activePortfolioId;
    if (!els.manageSheet.stocksList) return;
    els.manageSheet.stocksList.innerHTML = portfolios
      .map((portfolio) => {
        const isActive = portfolio.id === activeId;
        const canDelete = portfolios.length > 1;
        return `
          <div class="pf-manage-row" data-id="${escapeHtml(portfolio.id)}">
            <div class="pf-manage-row__meta">
              <div class="pf-manage-row__name">${escapeHtml(portfolio.name)}${
                isActive ? ' · Active' : ''
              }</div>
              <div class="pf-manage-row__sub">${portfolio.items?.length || 0} positions</div>
            </div>
            <div class="pf-manage-row__actions">
              ${
                isActive
                  ? ''
                  : `<button type="button" class="btn btn--ghost" data-action="activate-stock">Set active</button>`
              }
              <button type="button" class="btn btn--ghost" data-action="rename-stock">Rename</button>
              ${
                canDelete
                  ? `<button type="button" class="btn btn--danger" data-action="delete-stock">Delete</button>`
                  : ''
              }
            </div>
          </div>
        `;
      })
      .join('');
    return;
  }

  const portfolios = fundsData.portfolios || [];
  const activeId = fundsData.activePortfolioId;
  if (!els.manageSheet.fundsList) return;
  els.manageSheet.fundsList.innerHTML = portfolios
    .map((portfolio) => {
      const isActive = portfolio.id === activeId;
      return `
        <div class="pf-manage-row" data-id="${escapeHtml(portfolio.id)}">
          <div class="pf-manage-row__meta">
            <div class="pf-manage-row__name">${escapeHtml(portfolio.name)}${
              isActive ? ' · Active' : ''
            }</div>
            <div class="pf-manage-row__sub">${portfolio.funds?.length || 0} funds</div>
          </div>
          <div class="pf-manage-row__actions">
            ${
              isActive
                ? ''
                : `<button type="button" class="btn btn--ghost" data-action="activate-fund">Set active</button>`
            }
            <button type="button" class="btn btn--ghost" data-action="rename-fund-portfolio">Rename</button>
            <button type="button" class="btn btn--danger" data-action="delete-fund-portfolio">Delete</button>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderManageSheet() {
  const category = getCategory();
  const showStocks = category === 'all' || category === 'stocks';
  const showFunds = category === 'all' || category === 'funds';

  if (els.manageSheet.stocksSection) els.manageSheet.stocksSection.hidden = !showStocks;
  if (els.manageSheet.fundsSection) els.manageSheet.fundsSection.hidden = !showFunds;

  if (showStocks) renderManageList('stocks');
  if (showFunds) renderManageList('funds');
}

function openManageSheet() {
  renderManageSheet();
  openOverlay(els.manageSheet.root);
}

function closeManageSheet() {
  closeOverlay(els.manageSheet.root);
}

async function handleManageAction(event) {
  const btn = event.target.closest('button[data-action]');
  if (!btn || busy) return;
  const row = btn.closest('.pf-manage-row');
  const id = row?.dataset.id;
  if (!id) return;
  const action = btn.dataset.action;

  if (action === 'activate-stock') {
    await persistStockState(switchPortfolio(stockState, id));
    renderManageSheet();
    return;
  }
  if (action === 'rename-stock') {
    openRenameModal({ type: 'stock-portfolio', id });
    return;
  }
  if (action === 'delete-stock') {
    if (!confirm('Are you sure you want to delete this entire portfolio? This cannot be undone.')) {
      return;
    }
    await persistStockState(deletePortfolio(stockState, id));
    renderManageSheet();
    return;
  }
  if (action === 'activate-fund') {
    await persistFundsData({ ...fundsData, activePortfolioId: id });
    renderManageSheet();
    return;
  }
  if (action === 'rename-fund-portfolio') {
    openRenameModal({ type: 'fund-portfolio', id });
    return;
  }
  if (action === 'delete-fund-portfolio') {
    if (!confirm('Are you sure you want to delete this portfolio?')) return;
    await persistFundsData(deleteFundPortfolio(fundsData, id));
    renderManageSheet();
  }
}

function handleExportStocks() {
  const csv = exportToCSV(stockState);
  if (!csv) {
    alert('Portfolio is empty');
    return;
  }
  const active = getActivePortfolio(stockState);
  const name = (active?.name || 'portfolio').replace(/\s+/g, '_');
  downloadBlob(new Blob([csv], { type: 'text/csv' }), `${name}_${todayIsoDate()}.csv`);
}

function handleImportStocks(event) {
  const file = event.target.files?.[0];
  if (!file || busy) return;

  const reader = new FileReader();
  reader.onload = async (loadEvent) => {
    try {
      const result = importPortfolioData(stockState, file.name, loadEvent.target.result);
      const saved = await persistStockState(result.state);
      if (saved) alert(result.message);
    } catch (error) {
      alert(error.message || 'Import failed.');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

function handleExportFunds() {
  downloadBlob(
    new Blob([serializeFundsData(fundsData)], { type: 'application/json' }),
    `dse-mutual-funds-${todayIsoDate()}.json`
  );
}

function handleImportFunds(event) {
  const file = event.target.files?.[0];
  if (!file || busy) return;

  const reader = new FileReader();
  reader.onload = async (loadEvent) => {
    try {
      const nextData = parseImportedFundsData(loadEvent.target.result);
      const saved = await persistFundsData(nextData);
      if (saved) alert('Import successful!');
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

function handleFabClick() {
  const category = getCategory();
  if (category === 'stocks') openStockModal();
  else if (category === 'funds') openAddFund();
  else openTypePicker();
}

async function handleHoldingDelete() {
  if (!selectedHolding || busy) return;

  if (selectedHolding.category === 'fund') {
    const fundId = selectedHolding.fundId || selectedHolding.id.split(':')[2];
    if (
      !confirm(
        `Delete ${selectedHolding.label} from ${selectedHolding.portfolioName}? This removes the fund and all transactions.`
      )
    ) {
      return;
    }
    const saved = await persistFundsData(
      deleteFund(fundsData, selectedHolding.portfolioId, fundId)
    );
    if (saved) closeHoldingSheet();
    return;
  }

  if (!confirm(`Delete ${selectedHolding.symbol} from ${selectedHolding.portfolioName}?`)) {
    return;
  }

  const located = findStockItem(selectedHolding.portfolioId, selectedHolding.symbol);
  if (!located) {
    alert('Position not found.');
    closeHoldingSheet();
    render();
    return;
  }

  const nextState = withStockPortfolio(selectedHolding.portfolioId, (state) =>
    deleteStock(state, located.index)
  );
  const saved = await persistStockState(nextState);
  if (saved) closeHoldingSheet();
}

function handleHoldingEdit() {
  if (!selectedHolding) return;

  if (selectedHolding.category === 'fund') {
    const fundId = selectedHolding.fundId || selectedHolding.id.split(':')[2];
    const { portfolioId } = selectedHolding;
    closeHoldingSheet();
    openFundDetailSheet(portfolioId, fundId);
    return;
  }

  const { portfolioId } = selectedHolding;
  const located = findStockItem(portfolioId, selectedHolding.symbol);
  if (!located) {
    alert('Position not found.');
    return;
  }

  closeHoldingSheet();
  openStockModal({ index: located.index, portfolioId });
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

  holdingRows = rows;
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
      const row = holdingRows.find((entry) => entry.id === btn.dataset.holdingId);
      if (row) openHoldingSheet(row);
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

function bindStockEditorEvents() {
  if (!els.stock.form) return;
  els.stock.form.noValidate = true;

  els.stock.averageCostBaseInput?.addEventListener('input', () => {
    lastCostEditedField = 'base';
    syncCostFields('base');
  });
  els.stock.averageCostInput?.addEventListener('input', () => {
    lastCostEditedField = 'average';
    syncCostFields('average');
  });
  els.stock.quantityInput?.addEventListener('input', () => {
    syncCostFields(lastCostEditedField);
    updateCommissionImpactNote();
  });
  els.stock.averageCostBaseInput?.addEventListener('blur', () => {
    lastCostEditedField = 'base';
    syncCostFields('base', { format: true });
  });
  els.stock.averageCostInput?.addEventListener('blur', () => {
    lastCostEditedField = 'average';
    syncCostFields('average', { format: true });
  });
  els.stock.commissionRateInput?.addEventListener('input', () => {
    syncCostFields(lastCostEditedField);
  });
  els.stock.commissionRateInput?.addEventListener('blur', () => {
    syncCommissionFields({ format: true });
    syncCostFields(lastCostEditedField, { format: true });
  });

  els.stock.editPositionModeBtn?.addEventListener('click', () => {
    if (els.stock.editIndex.value !== '-1') setModalMode(MODAL_MODE.EDIT);
  });
  els.stock.addSharesModeBtn?.addEventListener('click', () => {
    if (els.stock.editIndex.value !== '-1') setModalMode(MODAL_MODE.ADD_SHARES);
  });

  els.stock.close?.addEventListener('click', closeStockModal);
  els.stock.cancelPositionBtn?.addEventListener('click', closeStockModal);
  els.stock.form.addEventListener('submit', handleStockFormSubmit);
  els.stock.deleteBtn?.addEventListener('click', handleStockDeleteFromModal);

  els.stock.portfolioSelector?.addEventListener('change', () => {
    if (els.stock.modalModeInput.value === MODAL_MODE.CREATE) {
      editorPortfolioId = els.stock.portfolioSelector.value;
    }
  });

  els.stock.modal?.addEventListener('click', (event) => {
    if (event.target === els.stock.modal) closeStockModal();
  });
}

function bindFundEvents() {
  els.typeSheet.close?.addEventListener('click', closeTypeSheet);
  els.typeSheet.root?.addEventListener('click', (event) => {
    if (event.target === els.typeSheet.root) closeTypeSheet();
  });
  els.typeSheet.pickStock?.addEventListener('click', () => {
    closeTypeSheet();
    openStockModal();
  });
  els.typeSheet.pickFund?.addEventListener('click', () => {
    closeTypeSheet();
    openAddFund();
  });

  els.manageBtn?.addEventListener('click', openManageSheet);
  els.manageSheet.close?.addEventListener('click', closeManageSheet);
  els.manageSheet.root?.addEventListener('click', (event) => {
    if (event.target === els.manageSheet.root) closeManageSheet();
  });
  els.manageSheet.createStock?.addEventListener('click', () => openCreatePortfolioModal('stock'));
  els.manageSheet.createFund?.addEventListener('click', () => openCreatePortfolioModal('fund'));
  els.manageSheet.stocksList?.addEventListener('click', handleManageAction);
  els.manageSheet.fundsList?.addEventListener('click', handleManageAction);

  els.exportStocks?.addEventListener('click', handleExportStocks);
  els.importStocks?.addEventListener('click', () => els.importStocksFile?.click());
  els.importStocksFile?.addEventListener('change', handleImportStocks);
  els.exportFunds?.addEventListener('click', handleExportFunds);
  els.importFunds?.addEventListener('click', () => els.importFundsFile?.click());
  els.importFundsFile?.addEventListener('change', handleImportFunds);

  els.fund.close?.addEventListener('click', closeFundModal);
  els.fund.cancel?.addEventListener('click', closeFundModal);
  els.fund.save?.addEventListener('click', handleSaveFund);
  els.fund.modal?.addEventListener('click', (event) => {
    if (event.target === els.fund.modal) closeFundModal();
  });

  els.fund.detailClose?.addEventListener('click', closeFundDetailSheet);
  els.fund.detailSheet?.addEventListener('click', (event) => {
    if (event.target === els.fund.detailSheet) closeFundDetailSheet();
  });
  els.fund.updateNav?.addEventListener('click', handleUpdateNav);
  els.fund.renameFundBtn?.addEventListener('click', () => {
    if (!currentFundPortfolioId || !currentFundId) return;
    openRenameModal({
      type: 'fund',
      id: currentFundId,
      portfolioId: currentFundPortfolioId
    });
  });
  els.fund.deleteFundBtn?.addEventListener('click', handleDeleteFundFromDetail);
  els.fund.addTxBtn?.addEventListener('click', () => openTransactionModal());

  els.fund.txClose?.addEventListener('click', closeTxModal);
  els.fund.txCancel?.addEventListener('click', closeTxModal);
  els.fund.txSave?.addEventListener('click', handleSaveTransaction);
  els.fund.txDelete?.addEventListener('click', handleDeleteTransaction);
  els.fund.txModal?.addEventListener('click', (event) => {
    if (event.target === els.fund.txModal) closeTxModal();
  });

  const autoCalcTxTotal = () => {
    const units = Number.parseFloat(els.fund.txUnits?.value) || 0;
    const price = Number.parseFloat(els.fund.txPrice?.value) || 0;
    if (units && price && els.fund.txTotal) {
      els.fund.txTotal.value = (units * price).toFixed(2);
    }
  };
  els.fund.txUnits?.addEventListener('input', autoCalcTxTotal);
  els.fund.txPrice?.addEventListener('input', autoCalcTxTotal);

  els.fund.renameClose?.addEventListener('click', closeRenameModal);
  els.fund.renameCancel?.addEventListener('click', closeRenameModal);
  els.fund.renameSave?.addEventListener('click', handleSaveRename);
  els.fund.renameModal?.addEventListener('click', (event) => {
    if (event.target === els.fund.renameModal) closeRenameModal();
  });

  els.fund.portfolioClose?.addEventListener('click', closeCreatePortfolioModal);
  els.fund.portfolioCancel?.addEventListener('click', closeCreatePortfolioModal);
  els.fund.portfolioSave?.addEventListener('click', handleCreatePortfolio);
  els.fund.portfolioModal?.addEventListener('click', (event) => {
    if (event.target === els.fund.portfolioModal) closeCreatePortfolioModal();
  });
}

function bindEvents() {
  for (const [key, btn] of Object.entries(els.seg)) {
    btn?.addEventListener('click', () => setCategory(key));
  }

  els.fab?.addEventListener('click', handleFabClick);

  els.holdingSheet.close?.addEventListener('click', closeHoldingSheet);
  els.holdingSheet.root?.addEventListener('click', (event) => {
    if (event.target === els.holdingSheet.root) closeHoldingSheet();
  });
  els.holdingSheet.edit?.addEventListener('click', handleHoldingEdit);
  els.holdingSheet.delete?.addEventListener('click', handleHoldingDelete);

  bindStockEditorEvents();
  bindFundEvents();

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (els.fund.txModal?.hasAttribute('open')) closeTxModal();
    else if (els.fund.renameModal?.hasAttribute('open')) closeRenameModal();
    else if (els.fund.portfolioModal?.hasAttribute('open')) closeCreatePortfolioModal();
    else if (els.fund.modal?.hasAttribute('open')) closeFundModal();
    else if (els.fund.detailSheet?.hasAttribute('open')) closeFundDetailSheet();
    else if (els.typeSheet.root?.hasAttribute('open')) closeTypeSheet();
    else if (els.manageSheet.root?.hasAttribute('open')) closeManageSheet();
    else if (els.stock.modal?.hasAttribute('open')) closeStockModal();
    else if (els.holdingSheet.root?.hasAttribute('open')) closeHoldingSheet();
  });
}

function populateSymbolList() {
  if (!els.stock.symbolList) return;
  const stocks = marketData?.stocks || [];
  els.stock.symbolList.innerHTML = stocks
    .map((stock) => `<option value="${escapeHtml(stock.symbol)}">${escapeHtml(stock.name || stock.symbol)}</option>`)
    .join('');
}

async function loadMarketData() {
  const response = await fetch('./src/data/dse-market.json');
  if (!response.ok) {
    throw new Error('Failed to load market data');
  }
  marketData = await response.json();
  populateSymbolList();
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

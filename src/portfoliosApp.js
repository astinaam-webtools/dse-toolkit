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
import { loadFundsDataDocument } from './lib/fundsStore.js';
import {
  addStock,
  createDefaultPortfolioState,
  deleteStock,
  getActivePortfolio,
  listPortfolios,
  switchPortfolio,
  updateStock
} from './lib/portfolioLogic.js';
import { createEmptyFundsData } from './lib/fundsLogic.js';
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
  holdingSheet: {
    root: document.getElementById(PF_DOM.holdingSheet.root),
    body: document.getElementById(PF_DOM.holdingSheet.body),
    close: document.getElementById(PF_DOM.holdingSheet.close),
    viewStock: document.getElementById(PF_DOM.holdingSheet.viewStock),
    edit: document.getElementById(PF_DOM.holdingSheet.edit),
    delete: document.getElementById(PF_DOM.holdingSheet.delete),
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
let lastCostEditedField = 'base';
let busy = false;

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

async function handleHoldingDelete() {
  if (!selectedHolding || busy) return;

  if (selectedHolding.category !== 'stock') {
    console.warn('Fund delete — deferred to Task 7', selectedHolding.id);
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

  if (selectedHolding.category !== 'stock') {
    console.warn('Fund edit — deferred to Task 7', selectedHolding.id);
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

function stubSoon(label) {
  console.warn(`${label} — deferred to Task 6–7`);
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

function bindEvents() {
  for (const [key, btn] of Object.entries(els.seg)) {
    btn?.addEventListener('click', () => setCategory(key));
  }

  els.manageBtn?.addEventListener('click', () => stubSoon('Manage portfolios'));
  els.fab?.addEventListener('click', () => {
    if (getCategory() === 'stocks') {
      openStockModal();
      return;
    }
    stubSoon('Add holding FAB');
  });
  els.exportStocks?.addEventListener('click', () => stubSoon('Export stocks'));
  els.importStocks?.addEventListener('click', () => stubSoon('Import stocks'));
  els.exportFunds?.addEventListener('click', () => stubSoon('Export funds'));
  els.importFunds?.addEventListener('click', () => stubSoon('Import funds'));

  els.holdingSheet.close?.addEventListener('click', closeHoldingSheet);
  els.holdingSheet.root?.addEventListener('click', (event) => {
    if (event.target === els.holdingSheet.root) closeHoldingSheet();
  });
  els.holdingSheet.edit?.addEventListener('click', handleHoldingEdit);
  els.holdingSheet.delete?.addEventListener('click', handleHoldingDelete);

  bindStockEditorEvents();

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (els.stock.modal?.hasAttribute('open')) closeStockModal();
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

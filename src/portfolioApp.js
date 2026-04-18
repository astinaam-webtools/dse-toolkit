import {
  addStock,
  calculateItemMetrics,
  calculateSummary,
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
import { loadPortfolioState, savePortfolioStateDocument } from './lib/portfolioStore.js';
import { AuthRequiredError, ConnectionUnavailableError } from './lib/serverClient.js';

let marketData = null;
let portfolioState = null;
let activePortfolio = null;
let pageState = 'loading';
let pageMessage = '';
let busy = false;

const els = {
  totalValue: document.getElementById('total-value'),
  totalInvestment: document.getElementById('total-investment'),
  totalPL: document.getElementById('total-pl'),
  holdingsList: document.getElementById('holdings-list'),
  addBtn: document.getElementById('add-stock-btn'),
  modal: document.getElementById('stock-modal'),
  modalTitle: document.getElementById('modal-title'),
  closeModal: document.getElementById('close-modal'),
  form: document.getElementById('stock-form'),
  modalModeInput: document.getElementById('modal-mode'),
  modalModeSwitch: document.getElementById('modal-mode-switch'),
  editPositionModeBtn: document.getElementById('edit-position-mode'),
  addSharesModeBtn: document.getElementById('add-shares-mode'),
  positionGlance: document.getElementById('position-glance'),
  glanceQuantity: document.getElementById('glance-quantity'),
  glanceAverageCost: document.getElementById('glance-average-cost'),
  glanceTotalBasis: document.getElementById('glance-total-basis'),
  symbolList: document.getElementById('symbol-list'),
  exportBtn: document.getElementById('export-btn'),
  importBtn: document.getElementById('import-btn'),
  importFile: document.getElementById('import-file'),
  deleteBtn: document.getElementById('delete-btn'),
  cancelPositionBtn: document.getElementById('cancel-position-btn'),
  savePositionBtn: document.getElementById('save-position-btn'),
  editIndex: document.getElementById('edit-index'),
  portfolioSelector: document.getElementById('portfolio-selector'),
  managePortfoliosBtn: document.getElementById('manage-portfolios-btn'),
  manageModal: document.getElementById('manage-portfolios-modal'),
  closeManageModal: document.getElementById('close-manage-modal'),
  portfoliosListManage: document.getElementById('portfolios-list-manage'),
  createPortfolioBtn: document.getElementById('create-portfolio-btn'),
  symbolInput: document.getElementById('symbol'),
  quantityInput: document.getElementById('quantity'),
  averageCostBaseInput: document.getElementById('avg-cost-base'),
  averageCostInput: document.getElementById('avg-cost'),
  totalCostInput: document.getElementById('total-cost'),
  commissionImpactNote: document.getElementById('comm-impact-note'),
  commissionRateInput: document.getElementById('comm-rate'),
  commissionAmountInput: document.getElementById('comm-amount'),
};

let lastCostEditedField = 'base';
const EDITOR_PRECISION = 4;

const MODAL_MODE = {
  CREATE: 'create',
  EDIT: 'edit',
  ADD_SHARES: 'add-shares'
};

const formatMoney = (value) =>
  `৳ ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

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

const getCommissionMultiplier = () => {
  const percent = parseNumericInput(els.commissionRateInput);
  if (!Number.isFinite(percent) || percent < 0) {
    return 1;
  }

  return 1 + percent / 100;
};

const getBaseCostPerShare = () => {
  const baseCost = parseNumericInput(els.averageCostBaseInput);

  if (!Number.isFinite(baseCost) || baseCost <= 0) {
    return null;
  }

  return baseCost;
};

const getQuantity = () => {
  const quantity = parseNumericInput(els.quantityInput);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  return quantity;
};

const syncTotalCostField = ({ format = false } = {}) => {
  const quantity = getQuantity();
  const averageCost = parseNumericInput(els.averageCostInput);

  if (!Number.isFinite(averageCost) || averageCost < 0 || !quantity) {
    els.totalCostInput.value = format ? formatDecimal(0, EDITOR_PRECISION) : '0';
    return;
  }

  const totalCost = quantity * averageCost;
  els.totalCostInput.value = format ? formatDecimal(totalCost, EDITOR_PRECISION) : String(roundCost(totalCost));
};

const updateCommissionImpactNote = () => {
  if (!els.commissionImpactNote) {
    return;
  }

  const baseValue = parseNumericInput(els.averageCostBaseInput);
  const averageValue = parseNumericInput(els.averageCostInput);
  const quantity = parseNumericInput(els.quantityInput);

  if (!Number.isFinite(baseValue) || !Number.isFinite(averageValue) || baseValue <= 0 || averageValue <= 0) {
    els.commissionImpactNote.textContent = 'Commission impact: +৳0.00/share';
    return;
  }

  const perShareImpact = Math.max(0, averageValue - baseValue);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    els.commissionImpactNote.textContent = `Commission impact: +${formatMoney(perShareImpact)}/share`;
    return;
  }

  const totalImpact = perShareImpact * quantity;
  els.commissionImpactNote.textContent = `Commission impact: +${formatMoney(perShareImpact)}/share (${formatMoney(totalImpact)} total)`;
};

const syncCommissionFields = ({ format = false } = {}) => {
  const baseCostPerShare = getBaseCostPerShare();
  const quantity = getQuantity();
  const rateValue = parseNumericInput(els.commissionRateInput);

  if (!Number.isFinite(rateValue) || rateValue < 0) {
    return;
  }

  if (!baseCostPerShare || !quantity) {
    els.commissionAmountInput.value = format ? formatDecimal(0, EDITOR_PRECISION) : '0';
    if (format) {
      els.commissionRateInput.value = formatDecimal(rateValue, EDITOR_PRECISION);
    }
    return;
  }

  const computedAmount = (baseCostPerShare * rateValue * quantity) / 100;
  els.commissionAmountInput.value = format
    ? formatDecimal(computedAmount, EDITOR_PRECISION)
    : String(roundCost(computedAmount));
  if (format) {
    els.commissionRateInput.value = formatDecimal(rateValue, EDITOR_PRECISION);
  }
};

const syncCostFields = (source = lastCostEditedField, { format = false } = {}) => {
  const multiplier = getCommissionMultiplier();
  const baseValue = parseNumericInput(els.averageCostBaseInput);
  const averageValue = parseNumericInput(els.averageCostInput);

  if (source === 'average') {
    if (!Number.isFinite(averageValue)) {
      return;
    }

    const computedBase = averageValue / multiplier;
    els.averageCostBaseInput.value = format ? formatDecimal(roundCost(computedBase)) : String(roundCost(computedBase));
    if (format) {
      els.averageCostInput.value = formatDecimal(roundCost(averageValue));
    }
    syncTotalCostField({ format });
    syncCommissionFields({ format });
    updateCommissionImpactNote();
    return;
  }

  if (!Number.isFinite(baseValue)) {
    return;
  }

  const computedAverage = baseValue * multiplier;
  els.averageCostInput.value = format ? formatDecimal(roundCost(computedAverage)) : String(roundCost(computedAverage));
  if (format) {
    els.averageCostBaseInput.value = formatDecimal(roundCost(baseValue));
  }
  syncTotalCostField({ format });
  syncCommissionFields({ format });
  updateCommissionImpactNote();
};

const hydrateCostFields = ({ averageCost = '', commissionRate = '', commissionIncluded = false } = {}) => {
  els.commissionRateInput.value = commissionRate;
  els.commissionAmountInput.value = '';

  if (averageCost === '' || averageCost === null || averageCost === undefined) {
    els.averageCostInput.value = '';
    els.averageCostBaseInput.value = '';
    els.totalCostInput.value = formatDecimal(0, EDITOR_PRECISION);
    els.commissionAmountInput.value = formatDecimal(0, EDITOR_PRECISION);
    updateCommissionImpactNote();
    return;
  }

  const ratePercent = Number.parseFloat(commissionRate || 0);
  const multiplier = 1 + (Number.isFinite(ratePercent) ? ratePercent : 0) / 100;
  const normalizedAverageCost = Number(averageCost);
  const baseCost = commissionIncluded ? normalizedAverageCost / multiplier : normalizedAverageCost;
  const averageWithCommission = commissionIncluded ? normalizedAverageCost : normalizedAverageCost * multiplier;

  els.averageCostBaseInput.value = formatDecimal(baseCost, EDITOR_PRECISION);
  els.averageCostInput.value = formatDecimal(averageWithCommission, EDITOR_PRECISION);
  lastCostEditedField = 'base';
  syncCostFields('base', { format: true });
  syncTotalCostField({ format: true });
  syncCommissionFields({ format: true });
  updateCommissionImpactNote();
};

const setModalMode = (mode) => {
  els.modalModeInput.value = mode;

  const isCreateMode = mode === MODAL_MODE.CREATE;
  const isAddSharesMode = mode === MODAL_MODE.ADD_SHARES;
  const currentItem = activePortfolio?.items?.[Number.parseInt(els.editIndex.value, 10)] || null;

  els.modalModeSwitch.classList.toggle('active', !isCreateMode);
  els.editPositionModeBtn.classList.toggle('active', mode === MODAL_MODE.EDIT);
  els.addSharesModeBtn.classList.toggle('active', isAddSharesMode);
  els.positionGlance.classList.toggle('active', isAddSharesMode && Boolean(currentItem));
  els.deleteBtn.style.display = mode === MODAL_MODE.EDIT ? 'block' : 'none';
  els.savePositionBtn.textContent = isAddSharesMode ? 'Add Shares' : 'Save Position';
  els.symbolInput.readOnly = isAddSharesMode;

  if (currentItem) {
    els.glanceQuantity.textContent = Number.parseFloat(currentItem.quantity).toLocaleString();
    els.glanceAverageCost.textContent = formatMoney(currentItem.average_cost);
    els.glanceTotalBasis.textContent = formatMoney(getItemTotalBasis(currentItem));
  }

  if (isAddSharesMode) {
    els.symbolInput.value = currentItem?.symbol || els.symbolInput.value;
    els.quantityInput.value = '';
    hydrateCostFields({ averageCost: '', commissionRate: '0.4', commissionIncluded: false });
    lastCostEditedField = 'base';
    return;
  }

  if (mode === MODAL_MODE.EDIT && currentItem) {
    els.symbolInput.value = currentItem.symbol;
    els.quantityInput.value = currentItem.quantity;
    hydrateCostFields({
      averageCost: currentItem.average_cost,
      commissionRate: (currentItem.commission_rate * 100).toFixed(EDITOR_PRECISION),
      commissionIncluded: currentItem.commission_included
    });
    lastCostEditedField = 'average';
  }
};

const setBusy = (nextBusy) => {
  busy = nextBusy;
  [
    els.addBtn,
    els.exportBtn,
    els.importBtn,
    els.managePortfoliosBtn,
    els.createPortfolioBtn,
    els.deleteBtn,
    els.portfolioSelector
  ].forEach((element) => {
    if (element) {
      element.disabled = nextBusy || pageState !== 'ready';
    }
  });
};

const setPageState = (nextState, message = '') => {
  pageState = nextState;
  pageMessage = message;
  if (pageState !== 'ready') {
    closeModal();
    closeManageModal();
  }
  setBusy(busy);
};

const renderLockedState = (title, body, ctaLabel = 'Open Settings') => {
  els.totalValue.textContent = formatMoney(0);
  els.totalInvestment.textContent = formatMoney(0);
  els.totalPL.textContent = '৳ 0.00 (0%)';
  els.totalPL.className = 'summary-value';
  els.portfolioSelector.innerHTML = '<option value="">Unavailable</option>';

  const actionHref = pageState === 'server-unavailable' ? './settings.html' : './settings.html';
  els.holdingsList.innerHTML = `
    <div class="empty-state">
      <p><strong>${title}</strong></p>
      <p>${body}</p>
      ${
        ctaLabel
          ? `<div style="margin-top: 1.5rem;">
               <a class="btn btn--solid" href="${actionHref}">${ctaLabel}</a>
             </div>`
          : ''
      }
    </div>
  `;
};

const render = () => {
  setBusy(busy);

  if (pageState === 'loading') {
    renderLockedState('Loading portfolio...', 'Please wait while the portfolio source is being prepared.', '');
    return;
  }

  if (pageState === 'auth-required') {
    renderLockedState(
      'Server login required',
      pageMessage || 'A server is configured for portfolio data. Log in from Settings before using this page.'
    );
    return;
  }

  if (pageState === 'server-unavailable') {
    renderLockedState(
      'Server unavailable',
      pageMessage || 'The configured server could not be reached. Update the server URL or try again later.'
    );
    return;
  }

  if (pageState === 'error') {
    renderLockedState('Unable to load portfolio', pageMessage || 'An unexpected error occurred.', 'Open Settings');
    return;
  }

  activePortfolio = getActivePortfolio(portfolioState);
  const portfolios = listPortfolios(portfolioState);

  const currentOptions = Array.from(els.portfolioSelector.options).map((option) => option.value);
  const nextOptions = [...portfolios.map((portfolio) => portfolio.id), 'manage'];

  if (JSON.stringify(currentOptions) !== JSON.stringify(nextOptions)) {
    els.portfolioSelector.innerHTML =
      portfolios.map((portfolio) => `<option value="${portfolio.id}">${portfolio.name}</option>`).join('') +
      '<option value="manage">⚙️ Manage Portfolios...</option>';
  }

  els.portfolioSelector.value = activePortfolio.id;

  if (activePortfolio.items.length === 0) {
    els.holdingsList.innerHTML = `
      <div class="empty-state">
        <p>No stocks in <strong>${activePortfolio.name}</strong> yet.</p>
        <p>Tap the + button to add your first position.</p>
        <div style="margin-top: 2rem; display: flex; flex-direction: column; gap: 0.75rem; align-items: center;">
          <button id="empty-create-btn" class="btn btn--solid" style="width: 220px;">+ Create New Portfolio</button>
          ${portfolios.length > 1 ? '<p style="font-size: 0.8rem;">Or switch to another portfolio above.</p>' : ''}
        </div>
      </div>
    `;

    const emptyCreateBtn = document.getElementById('empty-create-btn');
    if (emptyCreateBtn) {
      emptyCreateBtn.addEventListener('click', handleCreatePortfolio);
      emptyCreateBtn.disabled = busy;
    }

    els.totalValue.textContent = formatMoney(0);
    els.totalInvestment.textContent = formatMoney(0);
    els.totalPL.textContent = '৳ 0.00 (0%)';
    els.totalPL.className = 'summary-value';
    return;
  }

  const summary = calculateSummary(activePortfolio.items, marketData);
  els.totalValue.textContent = formatMoney(summary.totalCurrentValue);
  els.totalInvestment.textContent = formatMoney(summary.totalInvestment);
  els.totalPL.textContent = `${formatMoney(summary.totalPL)} (${summary.totalPLPercentage.toFixed(2)}%)`;
  els.totalPL.className = `summary-value ${summary.totalPL >= 0 ? 'up' : 'down'}`;

  els.holdingsList.innerHTML = activePortfolio.items
    .map((item, index) => {
      const stock = marketData.stocks.find((entry) => entry.symbol === item.symbol);
      const latestPrice = stock ? stock.metrics.ltp : item.average_cost;
      const metrics = calculateItemMetrics(item, latestPrice);

      return `
        <div class="holding-card" data-index="${index}">
          <div class="holding-info">
            <h3>${item.symbol}</h3>
            <p>${item.quantity} shares @ ৳${Number.parseFloat(item.average_cost).toFixed(2)}</p>
            <p>LTP: ৳${latestPrice.toFixed(2)}</p>
          </div>
          <div class="holding-stats">
            <div class="holding-price">${formatMoney(metrics.totalCost)}</div>
            <div class="holding-cost-label">Total Cost</div>
            <div class="holding-current">Current: ${formatMoney(metrics.currentValue)}</div>
            <div class="holding-pl ${metrics.profitLoss >= 0 ? 'up' : 'down'}">
              ${metrics.profitLoss >= 0 ? '+' : ''}${metrics.profitLoss.toFixed(2)} (${metrics.profitLossPercentage.toFixed(2)}%)
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  document.querySelectorAll('.holding-card').forEach((card) => {
    card.addEventListener('click', () => {
      const index = Number.parseInt(card.dataset.index, 10);
      openModal(index);
    });
  });
};

const openModal = (index = -1) => {
  if (pageState !== 'ready') {
    return;
  }

  els.modal.classList.add('active');
  els.editIndex.value = index;

  if (index === -1) {
    els.modalTitle.textContent = 'Add Stock';
    els.form.reset();
    hydrateCostFields({ averageCost: '', commissionRate: '0.4', commissionIncluded: false });
    lastCostEditedField = 'base';
    setModalMode(MODAL_MODE.CREATE);
    requestAnimationFrame(() => {
      els.modal.scrollIntoView({ behavior: 'smooth', block: 'start' });
      els.symbolInput.focus();
    });
    return;
  }

  const item = activePortfolio.items[index];
  els.modalTitle.textContent = 'Update Position';
  els.symbolInput.value = item.symbol;
  setModalMode(MODAL_MODE.EDIT);
  requestAnimationFrame(() => {
    els.modal.scrollIntoView({ behavior: 'smooth', block: 'start' });
    els.quantityInput.focus();
  });
};

const closeModal = () => {
  els.modal.classList.remove('active');
  els.editIndex.value = '-1';
};

const openManageModal = () => {
  if (pageState !== 'ready') {
    return;
  }

  els.manageModal.classList.add('active');
  renderManageList();
};

const closeManageModal = () => {
  els.manageModal.classList.remove('active');
};

const renderManageList = () => {
  if (pageState !== 'ready') {
    els.portfoliosListManage.innerHTML = '';
    return;
  }

  const portfolios = listPortfolios(portfolioState);
  els.portfoliosListManage.innerHTML = portfolios
    .map(
      (portfolio) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border);">
          <div style="display: flex; flex-direction: column;">
            <span style="font-weight: 600;">${portfolio.name}</span>
            <span style="font-size: 0.7rem; color: var(--muted);">${portfolio.items.length} positions</span>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button onclick="window.renamePortfolioPrompt('${portfolio.id}', '${portfolio.name.replace(/'/g, "\\'")}')" class="btn-secondary" style="padding: 4px 8px; font-size: 0.75rem;" ${busy ? 'disabled' : ''}>Rename</button>
            ${
              portfolios.length > 1
                ? `<button onclick="window.deletePortfolioConfirm('${portfolio.id}')" class="btn-secondary" style="padding: 4px 8px; font-size: 0.75rem; color: var(--danger);" ${busy ? 'disabled' : ''}>Delete</button>`
                : ''
            }
          </div>
        </div>
      `
    )
    .join('');
};

const persistPortfolioState = async (nextState) => {
  setBusy(true);

  try {
    portfolioState = await savePortfolioStateDocument(nextState);
    setPageState('ready');
    render();
    return true;
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      setPageState('auth-required', error.message);
    } else if (error instanceof ConnectionUnavailableError) {
      setPageState('server-unavailable', error.message);
    } else {
      setPageState('error', error.message || 'Unable to save the portfolio.');
    }

    render();
    alert(pageMessage || 'Unable to save the portfolio.');
    return false;
  } finally {
    setBusy(false);
  }
};

const handleCreatePortfolio = async () => {
  const name = prompt('Enter portfolio name:');
  if (!name || !name.trim()) {
    return;
  }

  const saved = await persistPortfolioState(createPortfolio(portfolioState, name.trim()));
  if (saved) {
    renderManageList();
  }
};

window.renamePortfolioPrompt = async (id, currentName) => {
  const newName = prompt('Enter new name:', currentName);
  if (!newName || !newName.trim() || newName === currentName) {
    return;
  }

  const saved = await persistPortfolioState(renamePortfolio(portfolioState, id, newName.trim()));
  if (saved) {
    renderManageList();
  }
};

window.deletePortfolioConfirm = async (id) => {
  if (!confirm('Are you sure you want to delete this entire portfolio? This cannot be undone.')) {
    return;
  }

  const saved = await persistPortfolioState(deletePortfolio(portfolioState, id));
  if (saved) {
    renderManageList();
  }
};

const handleFormSubmit = async (event) => {
  event.preventDefault();

  if (pageState !== 'ready') {
    return;
  }

  const symbol = els.symbolInput.value.trim().toUpperCase();
  const quantity = Number.parseFloat(els.quantityInput.value);
  const averageCostBase = Number.parseFloat(els.averageCostBaseInput.value);
  const averageCost = Number.parseFloat(els.averageCostInput.value);
  const commissionPercentRaw = els.commissionRateInput.value.trim();
  const commissionPercent =
    commissionPercentRaw === '' ? 0 : Number.parseFloat(commissionPercentRaw);
  const commissionAmount = Number.isFinite(averageCostBase) && Number.isFinite(quantity)
    ? (averageCostBase * commissionPercent * quantity) / 100
    : 0;
  const modalMode = els.modalModeInput.value;

  if (!symbol) {
    alert('Please enter a stock symbol.');
    console.warn('Portfolio save blocked: empty symbol');
    els.symbolInput.focus();
    return;
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    alert('Please enter a valid quantity greater than 0.');
    console.warn('Portfolio save blocked: invalid quantity', { quantity: els.quantityInput.value });
    els.quantityInput.focus();
    return;
  }

  if (!Number.isFinite(averageCostBase) || averageCostBase <= 0) {
    alert('Please enter a valid average cost without commission greater than 0.');
    els.averageCostBaseInput.focus();
    return;
  }

  if (!Number.isFinite(averageCost) || averageCost <= 0) {
    alert('Please enter a valid average cost greater than 0.');
    console.warn('Portfolio save blocked: invalid average cost', {
      averageCost: els.averageCostInput.value
    });
    els.averageCostInput.focus();
    return;
  }

  if (!Number.isFinite(commissionPercent) || commissionPercent < 0) {
    alert('Please enter a valid commission rate (0 or higher).');
    console.warn('Portfolio save blocked: invalid commission rate', {
      commissionRate: els.commissionRateInput.value
    });
    els.commissionRateInput.focus();
    return;
  }

  if (!Number.isFinite(commissionAmount) || commissionAmount < 0) {
    alert('Please enter a valid commission amount (0 or higher).');
    els.commissionAmountInput.focus();
    return;
  }

  const index = Number.parseInt(els.editIndex.value, 10);
  const item = {
    symbol,
    quantity,
    average_cost: averageCost,
    commission_rate: commissionPercent / 100,
    commission_included: true
  };

  let nextState;

  if (modalMode === MODAL_MODE.ADD_SHARES && index !== -1) {
    const existingItem = activePortfolio.items[index];
    nextState = updateStock(portfolioState, index, mergePurchaseIntoPosition(existingItem, item));
  } else {
    nextState = index === -1 ? addStock(portfolioState, item) : updateStock(portfolioState, index, item);
  }

  const saved = await persistPortfolioState(nextState);
  if (saved) {
    closeModal();
    console.info('Portfolio position saved', { symbol: item.symbol, index, modalMode });
  }
};

const handleDelete = async () => {
  const index = Number.parseInt(els.editIndex.value, 10);
  if (index === -1 || !confirm('Are you sure you want to delete this position?')) {
    return;
  }

  const saved = await persistPortfolioState(deleteStock(portfolioState, index));
  if (saved) {
    closeModal();
  }
};

const handleExport = () => {
  if (pageState !== 'ready') {
    return;
  }

  const csv = exportToCSV(portfolioState);
  if (!csv) {
    alert('Portfolio is empty');
    return;
  }

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${activePortfolio.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};

const handleImport = (event) => {
  const file = event.target.files[0];
  if (!file || pageState !== 'ready') {
    return;
  }

  const reader = new FileReader();
  reader.onload = async (loadEvent) => {
    try {
      const result = importPortfolioData(portfolioState, file.name, loadEvent.target.result);
      const saved = await persistPortfolioState(result.state);
      if (saved) {
        alert(result.message);
      }
    } catch (error) {
      alert(error.message || 'Import failed.');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
};

const bindEvents = () => {
  // Use JS validation so submit always flows through handleFormSubmit.
  els.form.noValidate = true;

  els.averageCostBaseInput.addEventListener('input', () => {
    lastCostEditedField = 'base';
    syncCostFields('base');
  });

  els.averageCostInput.addEventListener('input', () => {
    lastCostEditedField = 'average';
    syncCostFields('average');
  });

  els.quantityInput.addEventListener('input', () => {
    syncCostFields(lastCostEditedField);
    updateCommissionImpactNote();
  });

  els.averageCostBaseInput.addEventListener('blur', () => {
    lastCostEditedField = 'base';
    syncCostFields('base', { format: true });
  });

  els.averageCostInput.addEventListener('blur', () => {
    lastCostEditedField = 'average';
    syncCostFields('average', { format: true });
  });

  els.commissionRateInput.addEventListener('input', () => {
    syncCostFields(lastCostEditedField);
  });

  els.commissionRateInput.addEventListener('blur', () => {
    syncCommissionFields({ format: true });
    syncCostFields(lastCostEditedField, { format: true });
  });

  els.editPositionModeBtn.addEventListener('click', () => {
    if (els.editIndex.value !== '-1') {
      setModalMode(MODAL_MODE.EDIT);
    }
  });

  els.addSharesModeBtn.addEventListener('click', () => {
    if (els.editIndex.value !== '-1') {
      setModalMode(MODAL_MODE.ADD_SHARES);
    }
  });

  els.addBtn.addEventListener('click', () => openModal());
  els.closeModal.addEventListener('click', closeModal);
  els.cancelPositionBtn.addEventListener('click', closeModal);
  els.form.addEventListener('submit', handleFormSubmit);
  els.exportBtn.addEventListener('click', handleExport);
  els.importBtn.addEventListener('click', () => els.importFile.click());
  els.importFile.addEventListener('change', handleImport);
  els.deleteBtn.addEventListener('click', handleDelete);
  els.managePortfoliosBtn.addEventListener('click', openManageModal);
  els.closeManageModal.addEventListener('click', closeManageModal);
  els.createPortfolioBtn.addEventListener('click', handleCreatePortfolio);

  els.portfolioSelector.addEventListener('change', async (event) => {
    if (pageState !== 'ready') {
      return;
    }

    const selectedId = event.target.value;
    if (selectedId === 'manage') {
      openManageModal();
      els.portfolioSelector.value = activePortfolio?.id || '';
      return;
    }

    const saved = await persistPortfolioState(switchPortfolio(portfolioState, selectedId));
    if (saved) {
      renderManageList();
    }
  });

  window.addEventListener('click', (event) => {
    if (event.target === els.manageModal) {
      closeManageModal();
    }
  });
};

const loadMarketData = async () => {
  const response = await fetch('./src/data/dse-market.json');
  if (!response.ok) {
    throw new Error('Failed to load market data');
  }

  marketData = await response.json();
  els.symbolList.innerHTML = marketData.stocks
    .map((stock) => `<option value="${stock.symbol}">${stock.name}</option>`)
    .join('');
};

const loadPortfolioDocument = async () => {
  setPageState('loading');
  render();

  try {
    portfolioState = await loadPortfolioState();
    setPageState('ready');
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      setPageState('auth-required', error.message);
    } else if (error instanceof ConnectionUnavailableError) {
      setPageState('server-unavailable', error.message);
    } else {
      setPageState('error', error.message || 'Unable to load the portfolio.');
    }
  }

  render();
};

const init = async () => {
  bindEvents();

  try {
    await loadMarketData();
  } catch (error) {
    setPageState('error', error.message || 'Unable to load market data.');
    render();
    return;
  }

  await loadPortfolioDocument();
};

init();

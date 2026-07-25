import * as Logic from './lib/fundsLogic.js';
import { loadFundsDataDocument, saveFundsDataDocument } from './lib/fundsStore.js';
import { AuthRequiredError, ConnectionUnavailableError } from './lib/serverClient.js';

let fundsData = Logic.createEmptyFundsData();
let currentPortfolioId = null;
let currentFundId = null;
let navChart = null;
let selectedPortfolios = new Set();
let renameTarget = null;
let pageState = 'loading';
let pageMessage = '';
let busy = false;

const views = {
  list: document.getElementById('view-portfolio-list'),
  detail: document.getElementById('view-portfolio-detail'),
  fund: document.getElementById('view-fund-detail')
};

const modals = {
  portfolio: document.getElementById('modal-portfolio'),
  fund: document.getElementById('modal-fund'),
  tx: document.getElementById('modal-tx'),
  rename: document.getElementById('modal-rename')
};

const elements = {
  importBtn: document.getElementById('btn-import'),
  exportBtn: document.getElementById('btn-export'),
  addPortfolioBtn: document.getElementById('fab-add-portfolio'),
  addFundBtn: document.getElementById('fab-add-fund'),
  addTxBtn: document.getElementById('fab-add-tx'),
  savePortfolioBtn: document.getElementById('btn-save-pf'),
  saveFundBtn: document.getElementById('btn-save-fund'),
  saveTxBtn: document.getElementById('btn-save-tx'),
  updateNavBtn: document.getElementById('btn-update-nav'),
  deletePortfolioBtn: document.getElementById('btn-delete-portfolio'),
  deleteFundBtn: document.getElementById('btn-delete-fund'),
  saveRenameBtn: document.getElementById('btn-save-rename'),
  deleteTxBtn: document.getElementById('btn-delete-tx'),
  fileImport: document.getElementById('file-import'),
  selectAll: document.getElementById('chk-select-all'),
  portfolioList: document.getElementById('portfolio-list-container'),
  fundList: document.getElementById('fund-list-container'),
  txList: document.getElementById('tx-list')
};

const formatMoney = (amount) =>
  '৳' +
  Number.parseFloat(amount || 0).toLocaleString('en-BD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const formatTransactionType = (type) => {
  const labels = {
    BUY: 'Buy / SIP',
    SELL: 'Sell / Redeem',
    DIVIDEND_REINVEST: 'Dividend Reinvest/CIP'
  };

  return labels[type] || String(type || '').replaceAll('_', ' ');
};

const setBusy = (nextBusy) => {
  busy = nextBusy;

  [
    elements.importBtn,
    elements.exportBtn,
    elements.addPortfolioBtn,
    elements.addFundBtn,
    elements.addTxBtn,
    elements.savePortfolioBtn,
    elements.saveFundBtn,
    elements.saveTxBtn,
    elements.updateNavBtn,
    elements.deletePortfolioBtn,
    elements.deleteFundBtn,
    elements.saveRenameBtn,
    elements.deleteTxBtn,
    elements.selectAll
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
    closeModals();
    switchView('list');
  }
  setBusy(busy);
};

const syncSelectedPortfolios = () => {
  const validIds = new Set(fundsData.portfolios.map((portfolio) => portfolio.id));
  selectedPortfolios = new Set([...selectedPortfolios].filter((id) => validIds.has(id)));

  if (selectedPortfolios.size === 0) {
    fundsData.portfolios.forEach((portfolio) => selectedPortfolios.add(portfolio.id));
  }
};

const switchView = (viewName) => {
  Object.values(views).forEach((element) => element.classList.remove('active'));
  views[viewName].classList.add('active');
  window.scrollTo(0, 0);
};

function showPortfolioList() {
  currentPortfolioId = null;
  currentFundId = null;
  renderPortfolioList();
  switchView('list');
}

function openPortfolio(id) {
  if (pageState !== 'ready') {
    showPortfolioList();
    return;
  }

  currentPortfolioId = id;
  currentFundId = null;
  renderPortfolioDetail();
  switchView('detail');
}

function openFund(fundId) {
  if (pageState !== 'ready') {
    return;
  }

  currentFundId = fundId;
  renderFundDetail();
  switchView('fund');
}

const renderLockedState = () => {
  const title =
    pageState === 'auth-required'
      ? 'Server login required'
      : pageState === 'server-unavailable'
        ? 'Server unavailable'
        : pageState === 'loading'
          ? 'Loading mutual funds...'
          : 'Unable to load mutual funds';

  const body =
    pageMessage ||
    (pageState === 'auth-required'
      ? 'A server is configured for portfolios. Log in from Settings before using the mutual funds page.'
      : pageState === 'server-unavailable'
        ? 'The configured server could not be reached. Update the server URL or try again later.'
        : 'Please wait while the portfolio source is being prepared.');

  const showSettingsCta = pageState !== 'loading';

  elements.portfolioList.innerHTML = `
    <div style="text-align:center; padding:2rem; color:var(--muted);">
      <p style="font-weight:700; color:var(--text); margin-bottom:0.5rem;">${title}</p>
      <p style="margin-top:0;">${body}</p>
      ${
        showSettingsCta
          ? '<div style="margin-top:1.5rem;"><a href="./settings.html" class="btn btn--solid">Open Settings</a></div>'
          : ''
      }
    </div>
  `;

  document.getElementById('exec-invested').textContent = formatMoney(0);
  document.getElementById('exec-dividend').textContent = formatMoney(0);
  document.getElementById('exec-value').textContent = formatMoney(0);
  const gainEl = document.getElementById('exec-gain');
  gainEl.textContent = `${formatMoney(0)} (0.00%)`;
  gainEl.className = 'summary-value';
  document.getElementById('summary-selection-text').textContent = 'Unavailable';
};

function updateExecutiveSummary() {
  if (pageState !== 'ready') {
    renderLockedState();
    return;
  }

  const selected = fundsData.portfolios.filter((portfolio) => selectedPortfolios.has(portfolio.id));
  const stats = Logic.calculateAggregateStats(selected);

  document.getElementById('exec-invested').textContent = formatMoney(stats.totalInvested);
  document.getElementById('exec-dividend').textContent = formatMoney(stats.totalDividendReinvest);
  document.getElementById('exec-value').textContent = formatMoney(stats.currentValue);

  const gainEl = document.getElementById('exec-gain');
  const gainSign = stats.gainLoss >= 0 ? '+' : '';
  gainEl.textContent = `${gainSign}${formatMoney(stats.gainLoss)} (${gainSign}${stats.gainLossPercent.toFixed(2)}%)`;
  gainEl.className = `summary-value ${stats.gainLoss >= 0 ? 'up' : 'down'}`;

  const count = selected.length;
  const total = fundsData.portfolios.length;
  document.getElementById('summary-selection-text').textContent =
    count === total ? 'All Portfolios' : `${count} of ${total} Selected`;
}

function renderPortfolioList() {
  setBusy(busy);

  if (pageState !== 'ready') {
    renderLockedState();
    return;
  }

  syncSelectedPortfolios();
  const container = elements.portfolioList;
  container.innerHTML = '';
  updateExecutiveSummary();

  if (fundsData.portfolios.length === 0) {
    container.innerHTML =
      '<div style="text-align:center; padding:2rem; color:var(--muted);">No portfolios yet. Create one to get started.</div>';
    return;
  }

  fundsData.portfolios.forEach((portfolio) => {
    const stats = Logic.calculatePortfolioStats(portfolio);
    const card = document.createElement('div');
    card.className = 'fund-card';

    const isSelected = selectedPortfolios.has(portfolio.id);
    const gainClass = stats.gainLoss >= 0 ? 'up' : 'down';
    const gainSign = stats.gainLoss >= 0 ? '+' : '';

    card.innerHTML = `
      <div class="fund-header">
        <div style="display:flex; align-items:center;">
          <input type="checkbox" class="pf-select-checkbox" data-id="${portfolio.id}" ${isSelected ? 'checked' : ''}>
          <div class="fund-name">${portfolio.name}</div>
        </div>
        <div class="fund-amc">${stats.fundCount} Funds</div>
      </div>
      <div class="fund-stats" onclick="app.openPortfolio('${portfolio.id}')">
        <div class="stat-row">
          <span class="stat-label">Invested</span>
          <span class="stat-val">${formatMoney(stats.totalInvested)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Value</span>
          <span class="stat-val">${formatMoney(stats.currentValue)}</span>
        </div>
        <div class="stat-row" style="grid-column: span 2;">
          <span class="stat-label">Dividend Reinvest/CIP</span>
          <span class="stat-val">${formatMoney(stats.totalDividendReinvest)}</span>
        </div>
        <div class="stat-row" style="grid-column: span 2; margin-top:0.25rem;">
          <span class="stat-label">Return</span>
          <span class="stat-val gain-loss ${gainClass}">
            ${gainSign}${formatMoney(stats.gainLoss)} (${gainSign}${stats.gainLossPercent.toFixed(2)}%)
          </span>
        </div>
      </div>
    `;

    const checkbox = card.querySelector('.pf-select-checkbox');
    checkbox.onclick = (event) => {
      event.stopPropagation();
      if (event.target.checked) {
        selectedPortfolios.add(portfolio.id);
      } else {
        selectedPortfolios.delete(portfolio.id);
      }

      updateExecutiveSummary();
      elements.selectAll.checked = fundsData.portfolios.every((entry) => selectedPortfolios.has(entry.id));
    };

    container.appendChild(card);
  });

  elements.selectAll.checked = fundsData.portfolios.every((portfolio) => selectedPortfolios.has(portfolio.id));
}

function renderPortfolioDetail() {
  if (pageState !== 'ready') {
    showPortfolioList();
    return;
  }

  const portfolio = fundsData.portfolios.find((entry) => entry.id === currentPortfolioId);
  if (!portfolio) {
    showPortfolioList();
    return;
  }

  document.getElementById('detail-portfolio-name').textContent = portfolio.name;

  const stats = Logic.calculatePortfolioStats(portfolio);
  document.getElementById('pf-total-value').textContent = formatMoney(stats.currentValue);
  document.getElementById('pf-invested').textContent = formatMoney(stats.totalInvested);
  document.getElementById('pf-dividend').textContent = formatMoney(stats.totalDividendReinvest);

  const gainEl = document.getElementById('pf-gain');
  const gainSign = stats.gainLoss >= 0 ? '+' : '';
  gainEl.textContent = `${gainSign}${formatMoney(stats.gainLoss)} (${gainSign}${stats.gainLossPercent.toFixed(2)}%)`;
  gainEl.className = `summary-value ${stats.gainLoss >= 0 ? 'up' : 'down'}`;

  elements.fundList.innerHTML = '';
  if (portfolio.funds.length === 0) {
    elements.fundList.innerHTML =
      '<div style="text-align:center; padding:2rem; color:var(--muted);">No funds added yet.</div>';
    return;
  }

  portfolio.funds.forEach((fund) => {
    const fundStats = Logic.calculateFundStats(fund);
    const card = document.createElement('div');
    card.className = 'fund-card';
    card.onclick = () => openFund(fund.id);

    const gainClass = fundStats.gainLoss >= 0 ? 'up' : 'down';
    const gainSign = fundStats.gainLoss >= 0 ? '+' : '';

    card.innerHTML = `
      <div class="fund-header">
        <div class="fund-name">${fund.name}</div>
        <div class="fund-amc">${fund.amc || ''}</div>
      </div>
      <div class="fund-stats">
        <div class="stat-row">
          <span class="stat-label">Invested</span>
          <span class="stat-val">${formatMoney(fundStats.totalCost)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Value</span>
          <span class="stat-val">${formatMoney(fundStats.currentValue)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Units</span>
          <span class="stat-val">${fundStats.totalUnits.toFixed(2)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">NAV</span>
          <span class="stat-val">${fund.current_nav.toFixed(2)}</span>
        </div>
        <div class="stat-row" style="grid-column: span 2;">
          <span class="stat-label">Dividend Reinvest/CIP</span>
          <span class="stat-val">${formatMoney(fundStats.totalDividendReinvest)}</span>
        </div>
        <div class="stat-row" style="grid-column: span 2;">
          <span class="stat-label">Gain/Loss</span>
          <span class="stat-val gain-loss ${gainClass}">
            ${gainSign}${formatMoney(fundStats.gainLoss)} (${gainSign}${fundStats.gainLossPercent.toFixed(2)}%)
          </span>
        </div>
      </div>
    `;

    elements.fundList.appendChild(card);
  });
}

function renderFundDetail() {
  if (pageState !== 'ready') {
    showPortfolioList();
    return;
  }

  const portfolio = fundsData.portfolios.find((entry) => entry.id === currentPortfolioId);
  const fund = portfolio ? portfolio.funds.find((entry) => entry.id === currentFundId) : null;
  if (!fund) {
    openPortfolio(currentPortfolioId);
    return;
  }

  document.getElementById('detail-fund-name').textContent = fund.name;
  document.getElementById('detail-fund-amc').textContent = fund.amc || '';
  document.getElementById('input-current-nav').value = fund.current_nav || '';
  document.getElementById('input-nav-date').value = new Date().toISOString().split('T')[0];

  const lastUpdate = fund.last_updated ? new Date(fund.last_updated).toLocaleDateString() : 'Never';
  document.getElementById('nav-last-updated').textContent = `Last updated: ${lastUpdate}`;

  const stats = Logic.calculateFundStats(fund);
  document.getElementById('fd-invested').textContent = formatMoney(stats.totalCost);
  document.getElementById('fd-units').textContent = stats.totalUnits.toFixed(2);
  document.getElementById('fd-value').textContent = formatMoney(stats.currentValue);
  document.getElementById('fd-avg-cost').textContent = formatMoney(stats.avgCost);
  document.getElementById('fd-dividend').textContent = formatMoney(stats.totalDividendReinvest);

  const gainEl = document.getElementById('fd-gain');
  const gainSign = stats.gainLoss >= 0 ? '+' : '';
  gainEl.textContent = `${gainSign}${formatMoney(stats.gainLoss)} (${gainSign}${stats.gainLossPercent.toFixed(2)}%)`;
  gainEl.className = `summary-value ${stats.gainLoss >= 0 ? 'up' : 'down'}`;

  elements.txList.innerHTML = '';
  [...fund.transactions].reverse().forEach((transaction) => {
    const listItem = document.createElement('li');
    listItem.className = 'tx-item';
    listItem.style.cursor = 'pointer';
    listItem.onclick = () => openTransactionModal(transaction);
    listItem.innerHTML = `
      <div class="tx-info">
        <div>${formatTransactionType(transaction.type)}</div>
        <div>${new Date(transaction.date).toLocaleDateString()} @ ${transaction.price_per_unit}</div>
      </div>
      <div class="tx-amount">
        <div>${transaction.units} units</div>
        <div style="font-size:0.8rem; color:var(--muted);">${formatMoney(transaction.total_cost)}</div>
      </div>
    `;
    elements.txList.appendChild(listItem);
  });

  renderChart(fund);
}

function renderChart(fund) {
  const context = document.getElementById('navChart').getContext('2d');

  if (navChart) {
    navChart.destroy();
  }

  let labels = [];
  let dataPoints = [];

  if (fund.nav_history && fund.nav_history.length > 0) {
    labels = fund.nav_history.map((entry) => new Date(entry.date).toLocaleDateString());
    dataPoints = fund.nav_history.map((entry) => entry.nav);
  } else if (fund.current_nav) {
    labels = ['Today'];
    dataPoints = [fund.current_nav];
  }

  navChart = new Chart(context, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'NAV History',
          data: dataPoints,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.1,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: false
        }
      }
    }
  });
}

function openTransactionModal(transaction) {
  document.getElementById('tx-modal-title').textContent = 'Edit Transaction';
  document.getElementById('inp-tx-id').value = transaction.id;
  document.getElementById('inp-tx-type').value = transaction.type;
  document.getElementById('inp-tx-date').value = transaction.date;
  document.getElementById('inp-tx-units').value = transaction.units;
  document.getElementById('inp-tx-price').value = transaction.price_per_unit;
  document.getElementById('inp-tx-total').value = transaction.total_cost;
  elements.deleteTxBtn.style.display = 'block';
  openModal('tx');
}

const persistFundsData = async (nextData, afterSave) => {
  setBusy(true);

  try {
    fundsData = await saveFundsDataDocument(nextData);
    syncSelectedPortfolios();
    setPageState('ready');
    if (typeof afterSave === 'function') {
      afterSave();
    }
    return true;
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      setPageState('auth-required', error.message);
    } else if (error instanceof ConnectionUnavailableError) {
      setPageState('server-unavailable', error.message);
    } else {
      setPageState('error', error.message || 'Unable to save mutual fund data.');
    }

    renderPortfolioList();
    alert(pageMessage || 'Unable to save mutual fund data.');
    return false;
  } finally {
    setBusy(false);
  }
};

function openModal(name) {
  if (pageState !== 'ready') {
    return;
  }
  modals[name].setAttribute('open', '');
}

function closeModals() {
  Object.values(modals).forEach((modal) => modal.removeAttribute('open'));
}

function handleCreatePortfolio() {
  const name = document.getElementById('inp-pf-name').value.trim();
  if (!name) {
    alert('Name required');
    return;
  }

  persistFundsData(Logic.createPortfolio(fundsData, name), () => {
    document.getElementById('inp-pf-name').value = '';
    closeModals();
    renderPortfolioList();
  });
}

function handleDeletePortfolio() {
  if (!confirm('Are you sure you want to delete this portfolio?')) {
    return;
  }

  persistFundsData(Logic.deletePortfolio(fundsData, currentPortfolioId), () => {
    showPortfolioList();
  });
}

function handleAddFund() {
  const name = document.getElementById('inp-fund-name').value.trim();
  const symbol = document.getElementById('inp-fund-symbol').value.trim();
  const amc = document.getElementById('inp-fund-amc').value.trim();
  if (!name) {
    alert('Name required');
    return;
  }

  persistFundsData(Logic.addFund(fundsData, currentPortfolioId, name, amc, symbol), () => {
    document.getElementById('inp-fund-name').value = '';
    document.getElementById('inp-fund-symbol').value = '';
    document.getElementById('inp-fund-amc').value = '';
    closeModals();
    renderPortfolioDetail();
  });
}

function handleAddTransaction() {
  const id = document.getElementById('inp-tx-id').value;
  const type = document.getElementById('inp-tx-type').value;
  const date = document.getElementById('inp-tx-date').value;
  const units = document.getElementById('inp-tx-units').value;
  const price = document.getElementById('inp-tx-price').value;
  const total = document.getElementById('inp-tx-total').value;

  if (!date || !units || !price || !total) {
    alert('All fields required');
    return;
  }

  const transactionData = { type, date, units, price_per_unit: price, total_cost: total };
  const nextData = id
    ? Logic.editTransaction(fundsData, currentPortfolioId, currentFundId, id, transactionData)
    : Logic.addTransaction(fundsData, currentPortfolioId, currentFundId, transactionData);

  persistFundsData(nextData, () => {
    closeModals();
    renderFundDetail();
  });
}

function handleDeleteTransaction() {
  const id = document.getElementById('inp-tx-id').value;
  if (!id || !confirm('Are you sure you want to delete this transaction?')) {
    return;
  }

  persistFundsData(Logic.deleteTransaction(fundsData, currentPortfolioId, currentFundId, id), () => {
    closeModals();
    renderFundDetail();
  });
}

function handleUpdateNav() {
  const nav = document.getElementById('input-current-nav').value;
  const date = document.getElementById('input-nav-date').value;
  if (!nav) {
    alert('Please enter NAV');
    return;
  }

  persistFundsData(Logic.updateNav(fundsData, currentPortfolioId, currentFundId, nav, date), () => {
    renderFundDetail();
  });
}

function handleDeleteFund() {
  if (!confirm('Are you sure you want to delete this fund and all its transactions?')) {
    return;
  }

  persistFundsData(Logic.deleteFund(fundsData, currentPortfolioId, currentFundId), () => {
    openPortfolio(currentPortfolioId);
  });
}

function openRenameModal(type) {
  const portfolio = fundsData.portfolios.find((entry) => entry.id === currentPortfolioId);
  renameTarget = { type };

  if (type === 'portfolio') {
    renameTarget.id = currentPortfolioId;
    document.getElementById('rename-modal-title').textContent = 'Rename Portfolio';
    document.getElementById('inp-rename-name').value = portfolio?.name || '';
    document.getElementById('grp-rename-symbol').style.display = 'none';
  } else {
    const fund = portfolio?.funds.find((entry) => entry.id === currentFundId);
    renameTarget.id = currentFundId;
    document.getElementById('rename-modal-title').textContent = 'Rename Fund';
    document.getElementById('inp-rename-name').value = fund?.name || '';
    document.getElementById('inp-rename-symbol').value = fund?.symbol || '';
    document.getElementById('grp-rename-symbol').style.display = 'block';
  }

  openModal('rename');
}

function handleSaveRename() {
  const name = document.getElementById('inp-rename-name').value.trim();
  if (!name) {
    alert('Name required');
    return;
  }

  if (renameTarget.type === 'portfolio') {
    persistFundsData(Logic.renamePortfolio(fundsData, renameTarget.id, name), () => {
      closeModals();
      renderPortfolioDetail();
      renderPortfolioList();
    });
    return;
  }

  const symbol = document.getElementById('inp-rename-symbol').value.trim();
  persistFundsData(Logic.renameFund(fundsData, currentPortfolioId, renameTarget.id, name, symbol), () => {
    closeModals();
    renderFundDetail();
    renderPortfolioDetail();
  });
}

function handleExport() {
  if (pageState !== 'ready') {
    return;
  }

  const blob = new Blob([Logic.serializeFundsData(fundsData)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `dse-mutual-funds-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function handleImport(event) {
  const file = event.target.files[0];
  if (!file || pageState !== 'ready') {
    return;
  }

  const reader = new FileReader();
  reader.onload = async (loadEvent) => {
    try {
      const nextData = Logic.parseImportedFundsData(loadEvent.target.result);
      const saved = await persistFundsData(nextData, () => {
        renderPortfolioList();
      });
      if (saved) {
        alert('Import successful!');
      }
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    } finally {
      event.target.value = '';
    }
  };

  reader.readAsText(file);
}

function setupEventListeners() {
  elements.addPortfolioBtn.onclick = () => openModal('portfolio');
  elements.addFundBtn.onclick = () => openModal('fund');
  elements.addTxBtn.onclick = () => {
    document.getElementById('tx-modal-title').textContent = 'Add Transaction';
    document.getElementById('inp-tx-id').value = '';
    document.getElementById('inp-tx-type').value = 'BUY';
    document.getElementById('inp-tx-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('inp-tx-units').value = '';
    document.getElementById('inp-tx-price').value = '';
    document.getElementById('inp-tx-total').value = '';
    elements.deleteTxBtn.style.display = 'none';
    openModal('tx');
  };

  elements.savePortfolioBtn.onclick = handleCreatePortfolio;
  elements.saveFundBtn.onclick = handleAddFund;
  elements.saveTxBtn.onclick = handleAddTransaction;
  elements.updateNavBtn.onclick = handleUpdateNav;
  elements.deletePortfolioBtn.onclick = handleDeletePortfolio;
  elements.deleteFundBtn.onclick = handleDeleteFund;
  elements.saveRenameBtn.onclick = handleSaveRename;
  elements.deleteTxBtn.onclick = handleDeleteTransaction;

  document.getElementById('btn-rename-portfolio').onclick = () => openRenameModal('portfolio');
  document.getElementById('btn-rename-fund').onclick = () => openRenameModal('fund');

  elements.exportBtn.onclick = handleExport;
  elements.importBtn.onclick = () => elements.fileImport.click();
  elements.fileImport.onchange = handleImport;

  document.getElementById('btn-back-to-pf').onclick = () => openPortfolio(currentPortfolioId);

  elements.selectAll.onchange = (event) => {
    const checkboxes = document.querySelectorAll('.pf-select-checkbox');
    checkboxes.forEach((checkbox) => {
      checkbox.checked = event.target.checked;
      const id = checkbox.dataset.id;
      if (event.target.checked) {
        selectedPortfolios.add(id);
      } else {
        selectedPortfolios.delete(id);
      }
    });
    updateExecutiveSummary();
  };

  const unitsInput = document.getElementById('inp-tx-units');
  const priceInput = document.getElementById('inp-tx-price');
  const totalInput = document.getElementById('inp-tx-total');

  const autoCalc = () => {
    const units = Number.parseFloat(unitsInput.value) || 0;
    const price = Number.parseFloat(priceInput.value) || 0;
    if (units && price) {
      totalInput.value = (units * price).toFixed(2);
    }
  };

  unitsInput.oninput = autoCalc;
  priceInput.oninput = autoCalc;
}

const loadFundsDocument = async () => {
  setPageState('loading');
  renderPortfolioList();

  try {
    fundsData = await loadFundsDataDocument();
    if (!currentPortfolioId) {
      currentPortfolioId = fundsData.activePortfolioId;
    }
    syncSelectedPortfolios();
    setPageState('ready');
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      setPageState('auth-required', error.message);
    } else if (error instanceof ConnectionUnavailableError) {
      setPageState('server-unavailable', error.message);
    } else {
      setPageState('error', error.message || 'Unable to load mutual fund data.');
    }
  }

  renderPortfolioList();
};

function init() {
  setupEventListeners();
  window.app = {
    showPortfolioList,
    closeModals,
    openPortfolio,
    openFund
  };
  loadFundsDocument();
}

init();

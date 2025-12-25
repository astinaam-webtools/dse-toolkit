import * as Logic from './lib/fundsLogic.js';

// State
let currentPortfolioId = null;
let currentFundId = null;
let navChart = null;
let selectedPortfolios = new Set(); // Track selected IDs for summary
let renameTarget = null; // { type: 'portfolio'|'fund', id: '...' }

// DOM Elements
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

// --- Initialization ---

function init() {
  // Select all by default
  const data = Logic.getFundsData();
  data.portfolios.forEach(p => selectedPortfolios.add(p.id));
  
  renderPortfolioList();
  setupEventListeners();
  
  // Expose app to window for HTML onclick handlers
  window.app = {
    showPortfolioList,
    closeModals,
    openPortfolio,
    openFund
  };
}

function setupEventListeners() {
  // FABs
  document.getElementById('fab-add-portfolio').onclick = () => openModal('portfolio');
  document.getElementById('fab-add-fund').onclick = () => openModal('fund');
  document.getElementById('fab-add-tx').onclick = () => {
    // Reset modal for adding
    document.getElementById('tx-modal-title').textContent = 'Add Transaction';
    document.getElementById('inp-tx-id').value = '';
    document.getElementById('inp-tx-type').value = 'BUY';
    document.getElementById('inp-tx-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('inp-tx-units').value = '';
    document.getElementById('inp-tx-price').value = '';
    document.getElementById('inp-tx-total').value = '';
    document.getElementById('btn-delete-tx').style.display = 'none';
    openModal('tx');
  };

  // Save Buttons
  document.getElementById('btn-save-pf').onclick = handleCreatePortfolio;
  document.getElementById('btn-save-fund').onclick = handleAddFund;
  document.getElementById('btn-save-tx').onclick = handleAddTransaction;
  document.getElementById('btn-update-nav').onclick = handleUpdateNav;
  document.getElementById('btn-delete-portfolio').onclick = handleDeletePortfolio;
  document.getElementById('btn-delete-fund').onclick = handleDeleteFund;
  document.getElementById('btn-save-rename').onclick = handleSaveRename;
  document.getElementById('btn-delete-tx').onclick = handleDeleteTransaction;

  // Rename Buttons (Detail Views)
  document.getElementById('btn-rename-portfolio').onclick = () => openRenameModal('portfolio');
  document.getElementById('btn-rename-fund').onclick = () => openRenameModal('fund');

  // Import/Export
  document.getElementById('btn-export').onclick = Logic.exportFundsData;
  document.getElementById('btn-import').onclick = () => document.getElementById('file-import').click();
  document.getElementById('file-import').onchange = handleImport;

  // Back Buttons
  document.getElementById('btn-back-to-pf').onclick = () => openPortfolio(currentPortfolioId);

  // Select All Checkbox
  document.getElementById('chk-select-all').onchange = (e) => {
    const checkboxes = document.querySelectorAll('.pf-select-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = e.target.checked;
      const id = cb.dataset.id;
      if (e.target.checked) selectedPortfolios.add(id);
      else selectedPortfolios.delete(id);
    });
    updateExecutiveSummary();
  };

  // Auto-calc total cost in TX modal
  const inpUnits = document.getElementById('inp-tx-units');
  const inpPrice = document.getElementById('inp-tx-price');
  const inpTotal = document.getElementById('inp-tx-total');

  const autoCalc = () => {
    const u = parseFloat(inpUnits.value) || 0;
    const p = parseFloat(inpPrice.value) || 0;
    if (u && p) inpTotal.value = (u * p).toFixed(2);
  };
  inpUnits.oninput = autoCalc;
  inpPrice.oninput = autoCalc;
}

// --- Navigation & Rendering ---

function switchView(viewName) {
  Object.values(views).forEach(el => el.classList.remove('active'));
  views[viewName].classList.add('active');
  window.scrollTo(0, 0);
}

function showPortfolioList() {
  currentPortfolioId = null;
  currentFundId = null;
  renderPortfolioList();
  switchView('list');
}

function openPortfolio(id) {
  currentPortfolioId = id;
  currentFundId = null;
  renderPortfolioDetail();
  switchView('detail');
}

function openFund(fundId) {
  currentFundId = fundId;
  renderFundDetail();
  switchView('fund');
}

// --- Renderers ---

function renderPortfolioList() {
  const data = Logic.getFundsData();
  const container = document.getElementById('portfolio-list-container');
  container.innerHTML = '';

  // Update Executive Summary
  updateExecutiveSummary();

  if (data.portfolios.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--muted);">No portfolios yet. Create one to get started.</div>`;
    return;
  }

  data.portfolios.forEach(pf => {
    const stats = Logic.calculatePortfolioStats(pf);
    const card = document.createElement('div');
    card.className = 'fund-card';
    
    // Checkbox logic
    const isSelected = selectedPortfolios.has(pf.id);
    
    const gainClass = stats.gainLoss >= 0 ? 'up' : 'down';
    const gainSign = stats.gainLoss >= 0 ? '+' : '';

    card.innerHTML = `
      <div class="fund-header">
        <div style="display:flex; align-items:center;">
          <input type="checkbox" class="pf-select-checkbox" data-id="${pf.id}" ${isSelected ? 'checked' : ''}>
          <div class="fund-name">${pf.name}</div>
        </div>
        <div class="fund-amc">${stats.fundCount} Funds</div>
      </div>
      <div class="fund-stats" onclick="app.openPortfolio('${pf.id}')">
        <div class="stat-row">
          <span class="stat-label">Invested</span>
          <span class="stat-val">${formatMoney(stats.totalInvested)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Value</span>
          <span class="stat-val">${formatMoney(stats.currentValue)}</span>
        </div>
        <div class="stat-row" style="grid-column: span 2; margin-top:0.25rem;">
          <span class="stat-label">Return</span>
          <span class="stat-val gain-loss ${gainClass}">
            ${gainSign}${formatMoney(stats.gainLoss)} (${gainSign}${stats.gainLossPercent.toFixed(2)}%)
          </span>
        </div>
      </div>
    `;
    
    // Attach checkbox listener
    const checkbox = card.querySelector('.pf-select-checkbox');
    checkbox.onclick = (e) => {
      e.stopPropagation(); // Prevent card click
      if (e.target.checked) selectedPortfolios.add(pf.id);
      else selectedPortfolios.delete(pf.id);
      updateExecutiveSummary();
      
      // Update "Select All" state
      const allChecked = data.portfolios.every(p => selectedPortfolios.has(p.id));
      document.getElementById('chk-select-all').checked = allChecked;
    };

    container.appendChild(card);
  });
}

function updateExecutiveSummary() {
  const data = Logic.getFundsData();
  const selected = data.portfolios.filter(p => selectedPortfolios.has(p.id));
  const stats = Logic.calculateAggregateStats(selected);

  document.getElementById('exec-invested').textContent = formatMoney(stats.totalInvested);
  document.getElementById('exec-value').textContent = formatMoney(stats.currentValue);
  
  const gainEl = document.getElementById('exec-gain');
  const gainSign = stats.gainLoss >= 0 ? '+' : '';
  gainEl.textContent = `${gainSign}${formatMoney(stats.gainLoss)} (${gainSign}${stats.gainLossPercent.toFixed(2)}%)`;
  gainEl.className = `summary-value ${stats.gainLoss >= 0 ? 'up' : 'down'}`;

  const count = selected.length;
  const total = data.portfolios.length;
  document.getElementById('summary-selection-text').textContent = 
    count === total ? 'All Portfolios' : `${count} of ${total} Selected`;
}

function renderPortfolioDetail() {
  const data = Logic.getFundsData();
  const pf = data.portfolios.find(p => p.id === currentPortfolioId);
  if (!pf) return showPortfolioList();

  document.getElementById('detail-portfolio-name').textContent = pf.name;

  const stats = Logic.calculatePortfolioStats(pf);
  document.getElementById('pf-total-value').textContent = formatMoney(stats.currentValue);
  document.getElementById('pf-invested').textContent = formatMoney(stats.totalInvested);
  
  const gainEl = document.getElementById('pf-gain');
  const gainSign = stats.gainLoss >= 0 ? '+' : '';
  gainEl.textContent = `${gainSign}${formatMoney(stats.gainLoss)} (${gainSign}${stats.gainLossPercent.toFixed(2)}%)`;
  gainEl.className = `summary-value ${stats.gainLoss >= 0 ? 'up' : 'down'}`;

  const container = document.getElementById('fund-list-container');
  container.innerHTML = '';

  if (pf.funds.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--muted);">No funds added yet.</div>`;
    return;
  }

  pf.funds.forEach(fund => {
    const fStats = Logic.calculateFundStats(fund);
    const card = document.createElement('div');
    card.className = 'fund-card';
    card.onclick = () => openFund(fund.id);

    const fGainClass = fStats.gainLoss >= 0 ? 'up' : 'down';
    const fGainSign = fStats.gainLoss >= 0 ? '+' : '';

    card.innerHTML = `
      <div class="fund-header">
        <div class="fund-name">${fund.name}</div>
        <div class="fund-amc">${fund.amc || ''}</div>
      </div>
      <div class="fund-stats">
        <div class="stat-row">
          <span class="stat-label">Invested</span>
          <span class="stat-val">${formatMoney(fStats.totalCost)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Value</span>
          <span class="stat-val">${formatMoney(fStats.currentValue)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Units</span>
          <span class="stat-val">${fStats.totalUnits.toFixed(2)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">NAV</span>
          <span class="stat-val">${fund.current_nav.toFixed(2)}</span>
        </div>
        <div class="stat-row" style="grid-column: span 2;">
          <span class="stat-label">Gain/Loss</span>
          <span class="stat-val gain-loss ${fGainClass}">
            ${fGainSign}${formatMoney(fStats.gainLoss)} (${fGainSign}${fStats.gainLossPercent.toFixed(2)}%)
          </span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderFundDetail() {
  const data = Logic.getFundsData();
  const pf = data.portfolios.find(p => p.id === currentPortfolioId);
  const fund = pf ? pf.funds.find(f => f.id === currentFundId) : null;
  if (!fund) return openPortfolio(currentPortfolioId);

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
  
  const gainEl = document.getElementById('fd-gain');
  const gainSign = stats.gainLoss >= 0 ? '+' : '';
  gainEl.textContent = `${gainSign}${formatMoney(stats.gainLoss)} (${gainSign}${stats.gainLossPercent.toFixed(2)}%)`;
  gainEl.className = `summary-value ${stats.gainLoss >= 0 ? 'up' : 'down'}`;

  // Transactions
  const txList = document.getElementById('tx-list');
  txList.innerHTML = '';
  // Reverse copy for display
  [...fund.transactions].reverse().forEach(tx => {
    const li = document.createElement('li');
    li.className = 'tx-item';
    li.style.cursor = 'pointer';
    li.onclick = () => openTransactionModal(tx);
    li.innerHTML = `
      <div class="tx-info">
        <div>${tx.type.replace('_', ' ')}</div>
        <div>${new Date(tx.date).toLocaleDateString()} @ ${tx.price_per_unit}</div>
      </div>
      <div class="tx-amount">
        <div>${tx.units} units</div>
        <div style="font-size:0.8rem; color:var(--muted);">${formatMoney(tx.total_cost)}</div>
      </div>
    `;
    txList.appendChild(li);
  });

  renderChart(fund);
}

function openTransactionModal(tx) {
  document.getElementById('tx-modal-title').textContent = 'Edit Transaction';
  document.getElementById('inp-tx-id').value = tx.id;
  document.getElementById('inp-tx-type').value = tx.type;
  document.getElementById('inp-tx-date').value = tx.date;
  document.getElementById('inp-tx-units').value = tx.units;
  document.getElementById('inp-tx-price').value = tx.price_per_unit;
  document.getElementById('inp-tx-total').value = tx.total_cost;
  document.getElementById('btn-delete-tx').style.display = 'block';
  openModal('tx');
}

function renderChart(fund) {
  const ctx = document.getElementById('navChart').getContext('2d');
  
  if (navChart) {
    navChart.destroy();
  }

  // Prepare data
  // If no history, use current NAV as a point
  let labels = [];
  let dataPoints = [];

  if (fund.nav_history && fund.nav_history.length > 0) {
    labels = fund.nav_history.map(h => new Date(h.date).toLocaleDateString());
    dataPoints = fund.nav_history.map(h => h.nav);
  } else if (fund.current_nav) {
    labels = ['Today'];
    dataPoints = [fund.current_nav];
  }

  navChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'NAV History',
        data: dataPoints,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.1,
        fill: true
      }]
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

// --- Handlers ---

function handleCreatePortfolio() {
  const name = document.getElementById('inp-pf-name').value.trim();
  if (!name) return alert('Name required');
  Logic.createPortfolio(name);
  closeModals();
  renderPortfolioList();
}

function handleDeletePortfolio() {
  if (confirm('Are you sure you want to delete this portfolio?')) {
    Logic.deletePortfolio(currentPortfolioId);
    showPortfolioList();
  }
}

function handleAddFund() {
  const name = document.getElementById('inp-fund-name').value.trim();
  const symbol = document.getElementById('inp-fund-symbol').value.trim();
  const amc = document.getElementById('inp-fund-amc').value.trim();
  if (!name) return alert('Name required');
  
  Logic.addFund(currentPortfolioId, name, amc, symbol);
  closeModals();
  renderPortfolioDetail();
}

function handleAddTransaction() {
  const id = document.getElementById('inp-tx-id').value;
  const type = document.getElementById('inp-tx-type').value;
  const date = document.getElementById('inp-tx-date').value;
  const units = document.getElementById('inp-tx-units').value;
  const price = document.getElementById('inp-tx-price').value;
  const total = document.getElementById('inp-tx-total').value;

  if (!date || !units || !price || !total) return alert('All fields required');

  const txData = { type, date, units, price_per_unit: price, total_cost: total };

  if (id) {
    Logic.editTransaction(currentPortfolioId, currentFundId, id, txData);
  } else {
    Logic.addTransaction(currentPortfolioId, currentFundId, txData);
  }
  
  closeModals();
  renderFundDetail();
}

function handleDeleteTransaction() {
  const id = document.getElementById('inp-tx-id').value;
  if (!id) return;
  
  if (confirm('Are you sure you want to delete this transaction?')) {
    Logic.deleteTransaction(currentPortfolioId, currentFundId, id);
    closeModals();
    renderFundDetail();
  }
}

function handleUpdateNav() {
  const nav = document.getElementById('input-current-nav').value;
  const date = document.getElementById('input-nav-date').value;
  
  if (!nav) return alert('Please enter NAV');
  
  Logic.updateNav(currentPortfolioId, currentFundId, nav, date);
  renderFundDetail();
}

function handleDeleteFund() {
  if (confirm('Are you sure you want to delete this fund and all its transactions?')) {
    Logic.deleteFund(currentPortfolioId, currentFundId);
    openPortfolio(currentPortfolioId);
  }
}

function openRenameModal(type) {
  const data = Logic.getFundsData();
  renameTarget = { type };
  
  if (type === 'portfolio') {
    const pf = data.portfolios.find(p => p.id === currentPortfolioId);
    renameTarget.id = currentPortfolioId;
    document.getElementById('rename-modal-title').textContent = 'Rename Portfolio';
    document.getElementById('inp-rename-name').value = pf.name;
    document.getElementById('grp-rename-symbol').style.display = 'none';
  } else {
    const pf = data.portfolios.find(p => p.id === currentPortfolioId);
    const fund = pf.funds.find(f => f.id === currentFundId);
    renameTarget.id = currentFundId;
    document.getElementById('rename-modal-title').textContent = 'Rename Fund';
    document.getElementById('inp-rename-name').value = fund.name;
    document.getElementById('inp-rename-symbol').value = fund.symbol || '';
    document.getElementById('grp-rename-symbol').style.display = 'block';
  }
  
  openModal('rename');
}

function handleSaveRename() {
  const name = document.getElementById('inp-rename-name').value.trim();
  if (!name) return alert('Name required');
  
  if (renameTarget.type === 'portfolio') {
    Logic.renamePortfolio(renameTarget.id, name);
    renderPortfolioDetail();
  } else {
    const symbol = document.getElementById('inp-rename-symbol').value.trim();
    Logic.renameFund(currentPortfolioId, renameTarget.id, name, symbol);
    renderFundDetail();
  }
  closeModals();
}

async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    await Logic.importFundsData(file);
    alert('Import successful!');
    renderPortfolioList();
  } catch (err) {
    alert('Import failed: ' + err.message);
  }
  e.target.value = ''; // Reset
}

// --- Utilities ---

function openModal(name) {
  modals[name].classList.add('open');
}

function closeModals() {
  Object.values(modals).forEach(m => m.classList.remove('open'));
  // Clear inputs
  document.querySelectorAll('.modal input').forEach(i => i.value = '');
}

function formatMoney(amount) {
  return '৳' + parseFloat(amount).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Start
init();

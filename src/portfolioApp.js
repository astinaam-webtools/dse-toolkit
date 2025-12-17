import { 
  getActivePortfolio,
  listPortfolios,
  createPortfolio,
  switchPortfolio,
  renamePortfolio,
  deletePortfolio,
  getPortfolioState,
  savePortfolioState,
  addStock, 
  updateStock, 
  deleteStock, 
  calculateItemMetrics, 
  calculateSummary,
  exportToCSV,
  importFromCSV
} from './lib/portfolioLogic.js';

// State
let marketData = null;
let activePortfolio = null;

// DOM Elements
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
  symbolList: document.getElementById('symbol-list'),
  exportBtn: document.getElementById('export-btn'),
  importBtn: document.getElementById('import-btn'),
  importFile: document.getElementById('import-file'),
  deleteBtn: document.getElementById('delete-btn'),
  editIndex: document.getElementById('edit-index'),
  
  // Multi-portfolio elements
  portfolioSelector: document.getElementById('portfolio-selector'),
  managePortfoliosBtn: document.getElementById('manage-portfolios-btn'),
  manageModal: document.getElementById('manage-portfolios-modal'),
  closeManageModal: document.getElementById('close-manage-modal'),
  portfoliosListManage: document.getElementById('portfolios-list-manage'),
  createPortfolioBtn: document.getElementById('create-portfolio-btn')
};

// --- Initialization ---

const init = async () => {
  try {
    // Fetch market data for latest prices
    const res = await fetch('./src/data/dse-market.json');
    if (!res.ok) throw new Error('Failed to load market data');
    marketData = await res.json();

    // Populate symbol datalist
    els.symbolList.innerHTML = marketData.stocks
      .map(s => `<option value="${s.symbol}">${s.name}</option>`)
      .join('');

    // Multi-portfolio listeners
    if (els.portfolioSelector) {
      els.portfolioSelector.addEventListener('change', (e) => {
        const selectedId = e.target.value;
        if (selectedId === 'manage') {
          openManageModal();
          // Reset selector to active portfolio
          if (activePortfolio) els.portfolioSelector.value = activePortfolio.id;
        } else if (selectedId) {
          switchPortfolio(selectedId);
          render();
        }
      });
    }

    if (els.managePortfoliosBtn) {
      els.managePortfoliosBtn.addEventListener('click', openManageModal);
    }

    if (els.closeManageModal) {
      els.closeManageModal.addEventListener('click', closeManageModal);
    }

    if (els.createPortfolioBtn) {
      els.createPortfolioBtn.addEventListener('click', handleCreatePortfolio);
    }

    render();

    // Event Listeners
    els.addBtn.addEventListener('click', () => openModal());
    els.closeModal.addEventListener('click', closeModal);
    els.form.addEventListener('submit', handleFormSubmit);
    els.exportBtn.addEventListener('click', handleExport);
    els.importBtn.addEventListener('click', () => els.importFile.click());
    els.importFile.addEventListener('change', handleImport);
    els.deleteBtn.addEventListener('click', handleDelete);

    // Close modals on outside click
    window.addEventListener('click', (e) => {
      if (e.target === els.modal) closeModal();
      if (e.target === els.manageModal) closeManageModal();
    });

  } catch (err) {
    console.error(err);
    els.holdingsList.innerHTML = `<p class="error">Error loading data. Please try again later.</p>`;
  }
};

// --- Rendering ---

const render = () => {
  activePortfolio = getActivePortfolio();
  const portfolios = listPortfolios();
  
  // Update Selector options if they've changed
  const currentOptions = Array.from(els.portfolioSelector.options).map(o => o.value);
  const newOptions = [...portfolios.map(p => p.id), 'manage'];
  
  if (JSON.stringify(currentOptions) !== JSON.stringify(newOptions)) {
    els.portfolioSelector.innerHTML = portfolios
      .map(p => `<option value="${p.id}">${p.name}</option>`)
      .join('') + '<option value="manage">⚙️ Manage Portfolios...</option>';
  }
  
  // Ensure the correct portfolio is selected in the dropdown
  els.portfolioSelector.value = activePortfolio.id;

  const items = activePortfolio.items;
  
  if (items.length === 0) {
    els.holdingsList.innerHTML = `
      <div class="empty-state">
        <p>No stocks in <strong>${activePortfolio.name}</strong> yet.</p>
        <p>Tap the + button to add your first position.</p>
        <div style="margin-top: 2rem; display: flex; flex-direction: column; gap: 0.75rem; align-items: center;">
          <button id="empty-create-btn" class="btn btn--solid" style="width: 200px;">+ Create New Portfolio</button>
          ${portfolios.length > 1 ? `<p style="font-size: 0.8rem;">Or switch to another portfolio above.</p>` : ''}
        </div>
      </div>
    `;
    
    // Add listener for the new button
    const emptyCreateBtn = document.getElementById('empty-create-btn');
    if (emptyCreateBtn) {
      emptyCreateBtn.addEventListener('click', handleCreatePortfolio);
    }

    els.totalValue.textContent = '৳ 0.00';
    els.totalInvestment.textContent = '৳ 0.00';
    els.totalPL.textContent = '৳ 0.00 (0%)';
    els.totalPL.className = 'summary-value';
    return;
  }

  // Calculate Summary
  const summary = calculateSummary(items, marketData);
  els.totalValue.textContent = `৳ ${summary.totalCurrentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  els.totalInvestment.textContent = `৳ ${summary.totalInvestment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  const plText = `৳ ${summary.totalPL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${summary.totalPLPercentage.toFixed(2)}%)`;
  els.totalPL.textContent = plText;
  els.totalPL.className = `summary-value ${summary.totalPL >= 0 ? 'up' : 'down'}`;

  // Render Holdings
  els.holdingsList.innerHTML = items.map((item, index) => {
    const stock = marketData.stocks.find(s => s.symbol === item.symbol);
    const latestPrice = stock ? stock.metrics.ltp : item.average_cost;
    const metrics = calculateItemMetrics(item, latestPrice);

    return `
      <div class="holding-card" data-index="${index}">
        <div class="holding-info">
          <h3>${item.symbol}</h3>
          <p>${item.quantity} shares @ ৳${parseFloat(item.average_cost).toFixed(2)}</p>
          <p>LTP: ৳${latestPrice.toFixed(2)}</p>
        </div>
        <div class="holding-stats">
          <div class="holding-price">৳${metrics.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div class="holding-pl ${metrics.profitLoss >= 0 ? 'up' : 'down'}">
            ${metrics.profitLoss >= 0 ? '+' : ''}${metrics.profitLoss.toFixed(2)} (${metrics.profitLossPercentage.toFixed(2)}%)
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Add click listeners for editing
  document.querySelectorAll('.holding-card').forEach(card => {
    card.addEventListener('click', () => {
      const index = parseInt(card.dataset.index);
      openModal(index);
    });
  });
};

// --- Modal Handlers ---

const openModal = (index = -1) => {
  els.modal.classList.add('active');
  els.editIndex.value = index;
  
  if (index === -1) {
    els.modalTitle.textContent = 'Add Stock';
    els.form.reset();
    els.deleteBtn.style.display = 'none';
  } else {
    const item = activePortfolio.items[index];
    els.modalTitle.textContent = 'Edit Stock';
    document.getElementById('symbol').value = item.symbol;
    document.getElementById('quantity').value = item.quantity;
    document.getElementById('avg-cost').value = item.average_cost;
    document.getElementById('comm-rate').value = (item.commission_rate * 100).toFixed(3);
    document.getElementById('comm-included').checked = item.commission_included;
    els.deleteBtn.style.display = 'block';
  }
};

const closeModal = () => {
  els.modal.classList.remove('active');
};

const handleFormSubmit = (e) => {
  e.preventDefault();
  
  const index = parseInt(els.editIndex.value);
  const item = {
    symbol: document.getElementById('symbol').value.toUpperCase(),
    quantity: parseFloat(document.getElementById('quantity').value),
    average_cost: parseFloat(document.getElementById('avg-cost').value),
    commission_rate: parseFloat(document.getElementById('comm-rate').value) / 100,
    commission_included: document.getElementById('comm-included').checked
  };

  if (index === -1) {
    addStock(item);
  } else {
    updateStock(index, item);
  }

  closeModal();
  render();
};

const handleDelete = () => {
  const index = parseInt(els.editIndex.value);
  if (index !== -1 && confirm('Are you sure you want to delete this position?')) {
    deleteStock(index);
    closeModal();
    render();
  }
};

// --- Multi-Portfolio Handlers ---

const openManageModal = () => {
  els.manageModal.classList.add('active');
  renderManageList();
};

const closeManageModal = () => {
  els.manageModal.classList.remove('active');
};

const renderManageList = () => {
  const portfolios = listPortfolios();
  els.portfoliosListManage.innerHTML = portfolios.map(p => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border);">
      <div style="display: flex; flex-direction: column;">
        <span style="font-weight: 600;">${p.name}</span>
        <span style="font-size: 0.7rem; color: var(--muted);">${p.items.length} positions</span>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button onclick="window.renamePortfolioPrompt('${p.id}', '${p.name}')" class="btn-secondary" style="padding: 4px 8px; font-size: 0.75rem;">Rename</button>
        ${portfolios.length > 1 ? `<button onclick="window.deletePortfolioConfirm('${p.id}')" class="btn-secondary" style="padding: 4px 8px; font-size: 0.75rem; color: var(--danger);">Delete</button>` : ''}
      </div>
    </div>
  `).join('');
};

const handleCreatePortfolio = () => {
  const name = prompt('Enter portfolio name:');
  if (name && name.trim()) {
    createPortfolio(name.trim());
    render();
    renderManageList();
  }
};

window.renamePortfolioPrompt = (id, currentName) => {
  const newName = prompt('Enter new name:', currentName);
  if (newName && newName.trim() && newName !== currentName) {
    renamePortfolio(id, newName.trim());
    render();
    renderManageList();
  }
};

window.deletePortfolioConfirm = (id) => {
  if (confirm('Are you sure you want to delete this entire portfolio? This cannot be undone.')) {
    deletePortfolio(id);
    render();
    renderManageList();
  }
};

// --- Import/Export Handlers ---

const handleExport = () => {
  const csv = exportToCSV();
  if (!csv) return alert('Portfolio is empty');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${activePortfolio.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const handleImport = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const content = event.target.result;
    const state = getPortfolioState();
    const currentActive = state.portfolios.find(p => p.id === state.activePortfolioId);

    if (file.name.endsWith('.json')) {
      try {
        const data = JSON.parse(content);
        // If it's the new multi-portfolio format
        if (data.portfolios && data.activePortfolioId) {
          // Import items from the file's active portfolio into the current active portfolio
          const importedActive = data.portfolios.find(p => p.id === data.activePortfolioId) || data.portfolios[0];
          if (currentActive && importedActive) {
            currentActive.items = [...currentActive.items, ...importedActive.items];
            savePortfolioState(state);
            alert(`Imported ${importedActive.items.length} items into ${currentActive.name}`);
          }
        } else if (Array.isArray(data)) {
          // If it's the old single portfolio format, import into active
          if (currentActive) {
            currentActive.items = [...currentActive.items, ...data];
            savePortfolioState(state);
            alert(`Imported ${data.length} items into ${currentActive.name}`);
          }
        }
        render();
      } catch (err) {
        alert('Invalid JSON file');
      }
    } else {
      importFromCSV(content);
      const state = getPortfolioState();
      const currentActive = state.portfolios.find(p => p.id === state.activePortfolioId);
      if (currentActive) {
        alert(`Imported items into ${currentActive.name}`);
      }
      render();
    }
  };
  reader.readAsText(file);
};

init();


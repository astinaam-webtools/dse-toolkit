/**
 * Portfolio Logic for DSE Toolkit
 * Handles localStorage persistence, calculations, and data portability for multiple portfolios.
 */

const OLD_STORAGE_KEY = 'dse_toolkit_portfolio';
const STORAGE_KEY = 'dse_toolkit_portfolios';

/**
 * Migration logic from single portfolio to multi-portfolio
 */
const migrate = () => {
  const oldData = localStorage.getItem(OLD_STORAGE_KEY);
  if (oldData) {
    try {
      const items = JSON.parse(oldData);
      const id = 'p_' + Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
      const newData = {
        activePortfolioId: id,
        portfolios: [
          {
            id,
            name: 'Main Portfolio',
            items
          }
        ]
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
      localStorage.removeItem(OLD_STORAGE_KEY);
    } catch (e) {
      console.error('Migration failed', e);
    }
  }
};

migrate();

/**
 * Get the entire portfolio state
 * @returns {Object} { activePortfolioId, portfolios }
 */
export const getPortfolioState = () => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    const id = 'p_' + Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
    return {
      activePortfolioId: id,
      portfolios: [{ id, name: 'Main Portfolio', items: [] }]
    };
  }
  return JSON.parse(data);
};

/**
 * Save the entire portfolio state
 * @param {Object} state 
 */
export const savePortfolioState = (state) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

/**
 * Get the active portfolio
 * @returns {Object} The active portfolio object
 */
export const getActivePortfolio = () => {
  const state = getPortfolioState();
  return state.portfolios.find(p => p.id === state.activePortfolioId) || state.portfolios[0];
};

/**
 * Get all portfolios
 * @returns {Array}
 */
export const listPortfolios = () => {
  return getPortfolioState().portfolios;
};

/**
 * Create a new portfolio
 * @param {string} name 
 */
export const createPortfolio = (name) => {
  const state = getPortfolioState();
  const id = 'p_' + Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
  state.portfolios.push({ id, name, items: [] });
  state.activePortfolioId = id;
  savePortfolioState(state);
  return id;
};

/**
 * Switch active portfolio
 * @param {string} id 
 */
export const switchPortfolio = (id) => {
  const state = getPortfolioState();
  state.activePortfolioId = id;
  savePortfolioState(state);
};

/**
 * Rename a portfolio
 * @param {string} id 
 * @param {string} newName 
 */
export const renamePortfolio = (id, newName) => {
  const state = getPortfolioState();
  const p = state.portfolios.find(p => p.id === id);
  if (p) {
    p.name = newName;
    savePortfolioState(state);
  }
};

/**
 * Delete a portfolio
 * @param {string} id 
 */
export const deletePortfolio = (id) => {
  const state = getPortfolioState();
  if (state.portfolios.length <= 1) return; // Keep at least one
  
  state.portfolios = state.portfolios.filter(p => p.id !== id);
  if (state.activePortfolioId === id) {
    state.activePortfolioId = state.portfolios[0].id;
  }
  savePortfolioState(state);
};

/**
 * Add a stock to the active portfolio
 */
export const addStock = (item) => {
  const state = getPortfolioState();
  const p = state.portfolios.find(p => p.id === state.activePortfolioId);
  if (p) {
    p.items.push({ ...item, added_at: new Date().toISOString() });
    savePortfolioState(state);
  }
};

/**
 * Update a stock in the active portfolio
 */
export const updateStock = (index, updatedItem) => {
  const state = getPortfolioState();
  const p = state.portfolios.find(p => p.id === state.activePortfolioId);
  if (p && p.items[index]) {
    p.items[index] = { ...p.items[index], ...updatedItem };
    savePortfolioState(state);
  }
};

/**
 * Remove a stock from the active portfolio
 */
export const deleteStock = (index) => {
  const state = getPortfolioState();
  const p = state.portfolios.find(p => p.id === state.activePortfolioId);
  if (p) {
    p.items.splice(index, 1);
    savePortfolioState(state);
  }
};

/**
 * Calculate metrics for a portfolio item
 * @param {Object} item Portfolio item
 * @param {number} latestPrice Latest market price for the symbol
 * @returns {Object} Calculated metrics
 */
export const calculateItemMetrics = (item, latestPrice) => {
  const quantity = parseFloat(item.quantity);
  const avgCost = parseFloat(item.average_cost);
  const commRate = parseFloat(item.commission_rate || 0);
  
  let totalCost;
  if (item.commission_included) {
    totalCost = quantity * avgCost;
  } else {
    totalCost = (quantity * avgCost) * (1 + commRate);
  }

  const currentValue = quantity * latestPrice;
  const profitLoss = currentValue - totalCost;
  const profitLossPercentage = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;

  return {
    totalCost,
    currentValue,
    profitLoss,
    profitLossPercentage
  };
};

/**
 * Calculate overall portfolio summary
 * @param {Array} items Array of portfolio items
 * @param {Object} marketData Map of symbol -> latestPrice
 * @returns {Object} Summary metrics
 */
export const calculateSummary = (items, marketData) => {
  let totalInvestment = 0;
  let totalCurrentValue = 0;

  items.forEach(item => {
    const stock = marketData.stocks.find(s => s.symbol === item.symbol);
    const latestPrice = stock ? stock.metrics.ltp : item.average_cost;
    const metrics = calculateItemMetrics(item, latestPrice);
    
    totalInvestment += metrics.totalCost;
    totalCurrentValue += metrics.currentValue;
  });

  const totalPL = totalCurrentValue - totalInvestment;
  const totalPLPercentage = totalInvestment > 0 ? (totalPL / totalInvestment) * 100 : 0;

  return {
    totalInvestment,
    totalCurrentValue,
    totalPL,
    totalPLPercentage
  };
};

/**
 * Export active portfolio to CSV string
 * @returns {string} CSV content
 */
export const exportToCSV = () => {
  const active = getActivePortfolio();
  if (active.items.length === 0) return '';

  const headers = ['symbol', 'quantity', 'average_cost', 'commission_rate', 'commission_included'];
  const rows = active.items.map(item => [
    item.symbol,
    item.quantity,
    item.average_cost,
    item.commission_rate,
    item.commission_included
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
};

/**
 * Import portfolio from CSV string into active portfolio
 * @param {string} csvContent CSV content
 */
export const importFromCSV = (csvContent) => {
  const lines = csvContent.split('\n').filter(line => line.trim() !== '');
  if (lines.length < 2) return;

  const headers = lines[0].split(',').map(h => h.trim());
  const newItems = lines.slice(1).map(line => {
    const values = line.split(',');
    const item = {};
    headers.forEach((header, index) => {
      let val = values[index]?.trim();
      if (header === 'quantity' || header === 'average_cost' || header === 'commission_rate') {
        val = parseFloat(val);
      } else if (header === 'commission_included') {
        val = val.toLowerCase() === 'true';
      }
      item[header] = val;
    });
    return { ...item, added_at: new Date().toISOString() };
  });

  const state = getPortfolioState();
  const p = state.portfolios.find(p => p.id === state.activePortfolioId);
  if (p) {
    p.items = [...p.items, ...newItems];
    savePortfolioState(state);
  }
};


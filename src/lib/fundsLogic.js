/**
 * Mutual Funds Logic Library
 * Handles data management and calculations for the Mutual Funds feature.
 */

const STORAGE_KEY = 'dse-mutual-funds';

// --- Data Management ---

export function getFundsData() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    return {
      version: 1,
      activePortfolioId: null,
      portfolios: []
    };
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error("Failed to parse funds data", e);
    return { version: 1, activePortfolioId: null, portfolios: [] };
  }
}

export function saveFundsData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function exportFundsData() {
  const data = getFundsData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dse-mutual-funds-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importFundsData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        // Basic validation
        if (!data.portfolios || !Array.isArray(data.portfolios)) {
          throw new Error("Invalid data format");
        }
        saveFundsData(data);
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// --- Core Actions ---

export function createPortfolio(name) {
  const data = getFundsData();
  const newPortfolio = {
    id: Date.now().toString(),
    name: name,
    created_at: new Date().toISOString(),
    funds: []
  };
  data.portfolios.push(newPortfolio);
  if (!data.activePortfolioId) {
    data.activePortfolioId = newPortfolio.id;
  }
  saveFundsData(data);
  return newPortfolio;
}

export function renamePortfolio(id, newName) {
  const data = getFundsData();
  const portfolio = data.portfolios.find(p => p.id === id);
  if (portfolio) {
    portfolio.name = newName;
    saveFundsData(data);
  }
}

export function deletePortfolio(id) {
  const data = getFundsData();
  data.portfolios = data.portfolios.filter(p => p.id !== id);
  if (data.activePortfolioId === id) {
    data.activePortfolioId = data.portfolios.length > 0 ? data.portfolios[0].id : null;
  }
  saveFundsData(data);
}

export function addFund(portfolioId, name, amc, symbol) {
  const data = getFundsData();
  const portfolio = data.portfolios.find(p => p.id === portfolioId);
  if (!portfolio) return null;

  const newFund = {
    id: Date.now().toString(),
    name,
    amc,
    symbol: symbol || '',
    current_nav: 0,
    last_updated: null,
    transactions: [],
    nav_history: []
  };
  portfolio.funds.push(newFund);
  saveFundsData(data);
  return newFund;
}

export function renameFund(portfolioId, fundId, newName, newSymbol) {
  const data = getFundsData();
  const portfolio = data.portfolios.find(p => p.id === portfolioId);
  if (!portfolio) return;
  const fund = portfolio.funds.find(f => f.id === fundId);
  if (fund) {
    fund.name = newName;
    if (newSymbol !== undefined) fund.symbol = newSymbol;
    saveFundsData(data);
  }
}

export function deleteFund(portfolioId, fundId) {
  const data = getFundsData();
  const portfolio = data.portfolios.find(p => p.id === portfolioId);
  if (!portfolio) return;
  portfolio.funds = portfolio.funds.filter(f => f.id !== fundId);
  saveFundsData(data);
}

export function addTransaction(portfolioId, fundId, transaction) {
  const data = getFundsData();
  const portfolio = data.portfolios.find(p => p.id === portfolioId);
  if (!portfolio) return null;
  const fund = portfolio.funds.find(f => f.id === fundId);
  if (!fund) return null;

  const newTx = {
    id: Date.now().toString(),
    ...transaction // date, type, units, price_per_unit, total_cost, notes
  };
  
  // Ensure numeric types
  newTx.units = parseFloat(newTx.units);
  newTx.price_per_unit = parseFloat(newTx.price_per_unit);
  newTx.total_cost = parseFloat(newTx.total_cost);

  fund.transactions.push(newTx);
  
  // Sort transactions by date
  fund.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  saveFundsData(data);
  return newTx;
}

export function editTransaction(portfolioId, fundId, transactionId, updatedTransaction) {
  const data = getFundsData();
  const portfolio = data.portfolios.find(p => p.id === portfolioId);
  if (!portfolio) return null;
  const fund = portfolio.funds.find(f => f.id === fundId);
  if (!fund) return null;

  const txIndex = fund.transactions.findIndex(t => t.id === transactionId);
  if (txIndex === -1) return null;

  // Merge updates
  const tx = fund.transactions[txIndex];
  Object.assign(tx, updatedTransaction);

  // Ensure numeric types
  if (tx.units) tx.units = parseFloat(tx.units);
  if (tx.price_per_unit) tx.price_per_unit = parseFloat(tx.price_per_unit);
  if (tx.total_cost) tx.total_cost = parseFloat(tx.total_cost);

  // Sort transactions by date
  fund.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  saveFundsData(data);
  return tx;
}

export function deleteTransaction(portfolioId, fundId, transactionId) {
  const data = getFundsData();
  const portfolio = data.portfolios.find(p => p.id === portfolioId);
  if (!portfolio) return;
  const fund = portfolio.funds.find(f => f.id === fundId);
  if (!fund) return;

  fund.transactions = fund.transactions.filter(t => t.id !== transactionId);
  saveFundsData(data);
}

export function updateNav(portfolioId, fundId, nav, date) {
  const data = getFundsData();
  const portfolio = data.portfolios.find(p => p.id === portfolioId);
  if (!portfolio) return null;
  const fund = portfolio.funds.find(f => f.id === fundId);
  if (!fund) return null;

  const numNav = parseFloat(nav);
  const updateDate = date || new Date().toISOString().split('T')[0];

  // Add to history if entry for date doesn't exist, or update it
  const existingEntryIndex = fund.nav_history.findIndex(h => h.date === updateDate);
  if (existingEntryIndex >= 0) {
    fund.nav_history[existingEntryIndex].nav = numNav;
  } else {
    fund.nav_history.push({ date: updateDate, nav: numNav });
  }
  
  // Sort history
  fund.nav_history.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Update current_nav to the latest available in history
  if (fund.nav_history.length > 0) {
    const latest = fund.nav_history[fund.nav_history.length - 1];
    fund.current_nav = latest.nav;
    // We can also track the date of the latest NAV if needed, but last_updated is usually for the record modification time
  } else {
    fund.current_nav = numNav;
  }
  
  fund.last_updated = new Date().toISOString();

  saveFundsData(data);
  return fund;
}

// --- Calculations ---

export function calculateFundStats(fund) {
  let totalUnits = 0;
  let totalCost = 0;

  fund.transactions.forEach(tx => {
    if (tx.type === 'BUY' || tx.type === 'DIVIDEND_REINVEST') {
      totalUnits += tx.units;
      totalCost += tx.total_cost;
    } else if (tx.type === 'SELL') {
      // Simple average cost reduction
      const avgCost = totalUnits > 0 ? totalCost / totalUnits : 0;
      totalUnits -= tx.units;
      totalCost -= (tx.units * avgCost); // Reduce cost proportionally
    }
  });

  // Handle floating point errors
  totalUnits = Math.max(0, totalUnits);
  totalCost = Math.max(0, totalCost);

  const avgCost = totalUnits > 0 ? totalCost / totalUnits : 0;
  const currentValue = totalUnits * (fund.current_nav || 0);
  const gainLoss = currentValue - totalCost;
  const gainLossPercent = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;

  return {
    totalUnits,
    totalCost,
    avgCost,
    currentValue,
    gainLoss,
    gainLossPercent
  };
}

export function calculatePortfolioStats(portfolio) {
  let totalInvested = 0;
  let currentValue = 0;

  portfolio.funds.forEach(fund => {
    const stats = calculateFundStats(fund);
    totalInvested += stats.totalCost;
    currentValue += stats.currentValue;
  });

  const gainLoss = currentValue - totalInvested;
  const gainLossPercent = totalInvested > 0 ? (gainLoss / totalInvested) * 100 : 0;

  return {
    totalInvested,
    currentValue,
    gainLoss,
    gainLossPercent,
    fundCount: portfolio.funds.length
  };
}

export function calculateAggregateStats(portfolios) {
  let totalInvested = 0;
  let currentValue = 0;
  let fundCount = 0;

  portfolios.forEach(pf => {
    const stats = calculatePortfolioStats(pf);
    totalInvested += stats.totalInvested;
    currentValue += stats.currentValue;
    fundCount += stats.fundCount;
  });

  const gainLoss = currentValue - totalInvested;
  const gainLossPercent = totalInvested > 0 ? (gainLoss / totalInvested) * 100 : 0;

  return {
    totalInvested,
    currentValue,
    gainLoss,
    gainLossPercent,
    fundCount
  };
}

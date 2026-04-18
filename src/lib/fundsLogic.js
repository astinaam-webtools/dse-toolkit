const STORAGE_KEY = 'dse-mutual-funds';

const clone = (value) => JSON.parse(JSON.stringify(value));

const createId = () => Date.now().toString() + Math.random().toString(36).slice(2, 8);

const normalizeTransaction = (transaction) => ({
  id: String(transaction?.id || createId()),
  type: String(transaction?.type || 'BUY'),
  date: transaction?.date || new Date().toISOString().split('T')[0],
  units: Number.parseFloat(transaction?.units ?? 0) || 0,
  price_per_unit: Number.parseFloat(transaction?.price_per_unit ?? 0) || 0,
  total_cost: Number.parseFloat(transaction?.total_cost ?? 0) || 0,
  notes: transaction?.notes ? String(transaction.notes) : ''
});

const normalizeFund = (fund) => ({
  id: String(fund?.id || createId()),
  name: String(fund?.name || 'Untitled Fund'),
  amc: String(fund?.amc || ''),
  symbol: String(fund?.symbol || ''),
  current_nav: Number.parseFloat(fund?.current_nav ?? 0) || 0,
  last_updated: fund?.last_updated || null,
  transactions: Array.isArray(fund?.transactions)
    ? fund.transactions.map(normalizeTransaction).sort((a, b) => new Date(a.date) - new Date(b.date))
    : [],
  nav_history: Array.isArray(fund?.nav_history)
    ? fund.nav_history
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => ({
          date: entry.date || new Date().toISOString().split('T')[0],
          nav: Number.parseFloat(entry.nav ?? 0) || 0
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date))
    : []
});

const normalizePortfolio = (portfolio) => ({
  id: String(portfolio?.id || createId()),
  name: String(portfolio?.name || 'Untitled Portfolio'),
  created_at: portfolio?.created_at || new Date().toISOString(),
  funds: Array.isArray(portfolio?.funds) ? portfolio.funds.map(normalizeFund) : []
});

export function createEmptyFundsData() {
  return {
    version: 1,
    activePortfolioId: null,
    portfolios: []
  };
}

export function normalizeFundsData(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.portfolios)) {
    return createEmptyFundsData();
  }

  const portfolios = value.portfolios
    .filter((portfolio) => portfolio && typeof portfolio === 'object')
    .map(normalizePortfolio);

  const activePortfolioId =
    value.activePortfolioId && portfolios.some((portfolio) => portfolio.id === value.activePortfolioId)
      ? String(value.activePortfolioId)
      : portfolios[0]?.id || null;

  return {
    version: typeof value.version === 'number' ? value.version : 1,
    activePortfolioId,
    portfolios
  };
}

export function readLocalFundsData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createEmptyFundsData();
  }

  try {
    return normalizeFundsData(JSON.parse(raw));
  } catch (error) {
    console.error('Failed to parse funds data', error);
    return createEmptyFundsData();
  }
}

export function writeLocalFundsData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeFundsData(data)));
}

export function hasMeaningfulLocalFundsData() {
  return readLocalFundsData().portfolios.some((portfolio) => portfolio.funds.length > 0);
}

export function serializeFundsData(data) {
  return JSON.stringify(normalizeFundsData(data), null, 2);
}

export function parseImportedFundsData(text) {
  const parsed = JSON.parse(text);
  const normalized = normalizeFundsData(parsed);
  if (!Array.isArray(normalized.portfolios)) {
    throw new Error('Invalid data format');
  }
  return normalized;
}

export function createPortfolio(data, name) {
  const nextData = normalizeFundsData(clone(data));
  const newPortfolio = {
    id: createId(),
    name,
    created_at: new Date().toISOString(),
    funds: []
  };

  nextData.portfolios.push(newPortfolio);
  if (!nextData.activePortfolioId) {
    nextData.activePortfolioId = newPortfolio.id;
  }

  return nextData;
}

export function renamePortfolio(data, id, newName) {
  const nextData = normalizeFundsData(clone(data));
  const portfolio = nextData.portfolios.find((entry) => entry.id === id);
  if (portfolio) {
    portfolio.name = newName;
  }
  return nextData;
}

export function deletePortfolio(data, id) {
  const nextData = normalizeFundsData(clone(data));
  nextData.portfolios = nextData.portfolios.filter((portfolio) => portfolio.id !== id);
  if (nextData.activePortfolioId === id) {
    nextData.activePortfolioId = nextData.portfolios.length > 0 ? nextData.portfolios[0].id : null;
  }
  return nextData;
}

export function addFund(data, portfolioId, name, amc, symbol) {
  const nextData = normalizeFundsData(clone(data));
  const portfolio = nextData.portfolios.find((entry) => entry.id === portfolioId);
  if (!portfolio) {
    return nextData;
  }

  portfolio.funds.push(
    normalizeFund({
      id: createId(),
      name,
      amc,
      symbol,
      current_nav: 0,
      last_updated: null,
      transactions: [],
      nav_history: []
    })
  );

  return nextData;
}

export function renameFund(data, portfolioId, fundId, newName, newSymbol) {
  const nextData = normalizeFundsData(clone(data));
  const portfolio = nextData.portfolios.find((entry) => entry.id === portfolioId);
  const fund = portfolio?.funds.find((entry) => entry.id === fundId);
  if (fund) {
    fund.name = newName;
    if (newSymbol !== undefined) {
      fund.symbol = newSymbol;
    }
  }
  return nextData;
}

export function deleteFund(data, portfolioId, fundId) {
  const nextData = normalizeFundsData(clone(data));
  const portfolio = nextData.portfolios.find((entry) => entry.id === portfolioId);
  if (portfolio) {
    portfolio.funds = portfolio.funds.filter((fund) => fund.id !== fundId);
  }
  return nextData;
}

export function addTransaction(data, portfolioId, fundId, transaction) {
  const nextData = normalizeFundsData(clone(data));
  const portfolio = nextData.portfolios.find((entry) => entry.id === portfolioId);
  const fund = portfolio?.funds.find((entry) => entry.id === fundId);
  if (!fund) {
    return nextData;
  }

  fund.transactions.push(
    normalizeTransaction({
      id: createId(),
      ...transaction
    })
  );
  fund.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
  return nextData;
}

export function editTransaction(data, portfolioId, fundId, transactionId, updatedTransaction) {
  const nextData = normalizeFundsData(clone(data));
  const portfolio = nextData.portfolios.find((entry) => entry.id === portfolioId);
  const fund = portfolio?.funds.find((entry) => entry.id === fundId);
  if (!fund) {
    return nextData;
  }

  const transactionIndex = fund.transactions.findIndex((entry) => entry.id === transactionId);
  if (transactionIndex === -1) {
    return nextData;
  }

  fund.transactions[transactionIndex] = normalizeTransaction({
    ...fund.transactions[transactionIndex],
    ...updatedTransaction,
    id: transactionId
  });
  fund.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
  return nextData;
}

export function deleteTransaction(data, portfolioId, fundId, transactionId) {
  const nextData = normalizeFundsData(clone(data));
  const portfolio = nextData.portfolios.find((entry) => entry.id === portfolioId);
  const fund = portfolio?.funds.find((entry) => entry.id === fundId);
  if (fund) {
    fund.transactions = fund.transactions.filter((transaction) => transaction.id !== transactionId);
  }
  return nextData;
}

export function updateNav(data, portfolioId, fundId, nav, date) {
  const nextData = normalizeFundsData(clone(data));
  const portfolio = nextData.portfolios.find((entry) => entry.id === portfolioId);
  const fund = portfolio?.funds.find((entry) => entry.id === fundId);
  if (!fund) {
    return nextData;
  }

  const numericNav = Number.parseFloat(nav) || 0;
  const updateDate = date || new Date().toISOString().split('T')[0];
  const historyIndex = fund.nav_history.findIndex((entry) => entry.date === updateDate);

  if (historyIndex >= 0) {
    fund.nav_history[historyIndex].nav = numericNav;
  } else {
    fund.nav_history.push({ date: updateDate, nav: numericNav });
  }

  fund.nav_history.sort((a, b) => new Date(a.date) - new Date(b.date));

  const latest = fund.nav_history[fund.nav_history.length - 1];
  fund.current_nav = latest ? latest.nav : numericNav;
  fund.last_updated = new Date().toISOString();
  return nextData;
}

export function calculateFundStats(fund) {
  let totalUnits = 0;
  let totalCost = 0;
  let totalDividendReinvest = 0;

  fund.transactions.forEach((transaction) => {
    if (transaction.type === 'BUY' || transaction.type === 'DIVIDEND_REINVEST') {
      totalUnits += transaction.units;
      totalCost += transaction.total_cost;
      if (transaction.type === 'DIVIDEND_REINVEST') {
        totalDividendReinvest += transaction.total_cost;
      }
    } else if (transaction.type === 'SELL') {
      const avgCost = totalUnits > 0 ? totalCost / totalUnits : 0;
      totalUnits -= transaction.units;
      totalCost -= transaction.units * avgCost;
    }
  });

  totalUnits = Math.max(0, totalUnits);
  totalCost = Math.max(0, totalCost);

  const avgCost = totalUnits > 0 ? totalCost / totalUnits : 0;
  const currentValue = totalUnits * (fund.current_nav || 0);
  const gainLoss = currentValue - totalCost;
  const gainLossPercent = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;

  return {
    totalUnits,
    totalCost,
    totalDividendReinvest,
    avgCost,
    currentValue,
    gainLoss,
    gainLossPercent
  };
}

export function calculatePortfolioStats(portfolio) {
  let totalInvested = 0;
  let currentValue = 0;
  let totalDividendReinvest = 0;

  portfolio.funds.forEach((fund) => {
    const stats = calculateFundStats(fund);
    totalInvested += stats.totalCost;
    currentValue += stats.currentValue;
    totalDividendReinvest += stats.totalDividendReinvest;
  });

  const gainLoss = currentValue - totalInvested;
  const gainLossPercent = totalInvested > 0 ? (gainLoss / totalInvested) * 100 : 0;

  return {
    totalInvested,
    currentValue,
    totalDividendReinvest,
    gainLoss,
    gainLossPercent,
    fundCount: portfolio.funds.length
  };
}

export function calculateAggregateStats(portfolios) {
  let totalInvested = 0;
  let currentValue = 0;
  let totalDividendReinvest = 0;
  let fundCount = 0;

  portfolios.forEach((portfolio) => {
    const stats = calculatePortfolioStats(portfolio);
    totalInvested += stats.totalInvested;
    currentValue += stats.currentValue;
    totalDividendReinvest += stats.totalDividendReinvest;
    fundCount += stats.fundCount;
  });

  const gainLoss = currentValue - totalInvested;
  const gainLossPercent = totalInvested > 0 ? (gainLoss / totalInvested) * 100 : 0;

  return {
    totalInvested,
    currentValue,
    totalDividendReinvest,
    gainLoss,
    gainLossPercent,
    fundCount
  };
}

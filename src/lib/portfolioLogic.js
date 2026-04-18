const OLD_STORAGE_KEY = 'dse_toolkit_portfolio';
const STORAGE_KEY = 'dse_toolkit_portfolios';

const clone = (value) => JSON.parse(JSON.stringify(value));

export const createPortfolioId = () =>
  `p_${Date.now().toString()}_${Math.random().toString(36).slice(2, 11)}`;

export const createDefaultPortfolioState = () => {
  const id = createPortfolioId();
  return {
    activePortfolioId: id,
    portfolios: [
      {
        id,
        name: 'Main Portfolio',
        items: []
      }
    ]
  };
};

const normalizeItem = (item) => ({
  symbol: String(item?.symbol || '').toUpperCase(),
  quantity: Number.parseFloat(item?.quantity ?? 0) || 0,
  average_cost: Number.parseFloat(item?.average_cost ?? 0) || 0,
  commission_rate: Number.parseFloat(item?.commission_rate ?? 0) || 0,
  commission_included: Boolean(item?.commission_included),
  added_at: item?.added_at || new Date().toISOString()
});

export const normalizePortfolioState = (value) => {
  if (!value || typeof value !== 'object' || !Array.isArray(value.portfolios)) {
    return createDefaultPortfolioState();
  }

  const portfolios = value.portfolios
    .filter((portfolio) => portfolio && typeof portfolio === 'object')
    .map((portfolio) => ({
      id: String(portfolio.id || createPortfolioId()),
      name: String(portfolio.name || 'Untitled Portfolio'),
      items: Array.isArray(portfolio.items) ? portfolio.items.map(normalizeItem) : []
    }));

  if (portfolios.length === 0) {
    return createDefaultPortfolioState();
  }

  const activePortfolioId = portfolios.some((portfolio) => portfolio.id === value.activePortfolioId)
    ? String(value.activePortfolioId)
    : portfolios[0].id;

  return {
    activePortfolioId,
    portfolios
  };
};

const migrateLegacyPortfolioState = () => {
  const oldData = localStorage.getItem(OLD_STORAGE_KEY);
  if (!oldData) {
    return null;
  }

  try {
    const items = JSON.parse(oldData);
    if (!Array.isArray(items)) {
      return null;
    }

    const nextState = createDefaultPortfolioState();
    nextState.portfolios[0].items = items.map(normalizeItem);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    localStorage.removeItem(OLD_STORAGE_KEY);
    return nextState;
  } catch (error) {
    console.error('Portfolio migration failed', error);
    return null;
  }
};

export const readLocalPortfolioState = () => {
  const migratedState = migrateLegacyPortfolioState();
  if (migratedState) {
    return migratedState;
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createDefaultPortfolioState();
  }

  try {
    return normalizePortfolioState(JSON.parse(raw));
  } catch (error) {
    console.error('Failed to parse local stock portfolio state', error);
    return createDefaultPortfolioState();
  }
};

export const writeLocalPortfolioState = (state) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizePortfolioState(state)));
};

export const hasMeaningfulLocalPortfolioData = () =>
  readLocalPortfolioState().portfolios.some((portfolio) => portfolio.items.length > 0);

const getActivePortfolioEntry = (state) =>
  state.portfolios.find((portfolio) => portfolio.id === state.activePortfolioId) || state.portfolios[0];

export const getActivePortfolio = (state) => {
  const normalizedState = normalizePortfolioState(state);
  return getActivePortfolioEntry(normalizedState);
};

export const listPortfolios = (state) => normalizePortfolioState(state).portfolios;

export const createPortfolio = (state, name) => {
  const nextState = normalizePortfolioState(clone(state));
  const id = createPortfolioId();
  nextState.portfolios.push({
    id,
    name,
    items: []
  });
  nextState.activePortfolioId = id;
  return nextState;
};

export const switchPortfolio = (state, id) => {
  const nextState = normalizePortfolioState(clone(state));
  if (nextState.portfolios.some((portfolio) => portfolio.id === id)) {
    nextState.activePortfolioId = id;
  }
  return nextState;
};

export const renamePortfolio = (state, id, newName) => {
  const nextState = normalizePortfolioState(clone(state));
  const portfolio = nextState.portfolios.find((entry) => entry.id === id);
  if (portfolio) {
    portfolio.name = newName;
  }
  return nextState;
};

export const deletePortfolio = (state, id) => {
  const nextState = normalizePortfolioState(clone(state));
  if (nextState.portfolios.length <= 1) {
    return nextState;
  }

  nextState.portfolios = nextState.portfolios.filter((portfolio) => portfolio.id !== id);
  if (!nextState.portfolios.some((portfolio) => portfolio.id === nextState.activePortfolioId)) {
    nextState.activePortfolioId = nextState.portfolios[0].id;
  }

  return nextState;
};

export const addStock = (state, item) => {
  const nextState = normalizePortfolioState(clone(state));
  const activePortfolio = getActivePortfolioEntry(nextState);
  activePortfolio.items.push({
    ...normalizeItem(item),
    added_at: new Date().toISOString()
  });
  return nextState;
};

export const updateStock = (state, index, updatedItem) => {
  const nextState = normalizePortfolioState(clone(state));
  const activePortfolio = getActivePortfolioEntry(nextState);
  if (activePortfolio.items[index]) {
    activePortfolio.items[index] = {
      ...activePortfolio.items[index],
      ...normalizeItem(updatedItem),
      added_at: activePortfolio.items[index].added_at || new Date().toISOString()
    };
  }
  return nextState;
};

export const deleteStock = (state, index) => {
  const nextState = normalizePortfolioState(clone(state));
  const activePortfolio = getActivePortfolioEntry(nextState);
  activePortfolio.items.splice(index, 1);
  return nextState;
};

export const calculateItemMetrics = (item, latestPrice) => {
  const quantity = Number.parseFloat(item.quantity);
  const avgCost = Number.parseFloat(item.average_cost);
  const commRate = Number.parseFloat(item.commission_rate || 0);

  const totalCost = item.commission_included
    ? quantity * avgCost
    : quantity * avgCost * (1 + commRate);

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

export const calculateSummary = (items, marketData) => {
  let totalInvestment = 0;
  let totalCurrentValue = 0;

  items.forEach((item) => {
    const stock = marketData.stocks.find((entry) => entry.symbol === item.symbol);
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

export const exportToCSV = (state) => {
  const activePortfolio = getActivePortfolio(state);
  if (activePortfolio.items.length === 0) {
    return '';
  }

  const headers = ['symbol', 'quantity', 'average_cost', 'commission_rate', 'commission_included'];
  const rows = activePortfolio.items.map((item) =>
    [
      item.symbol,
      item.quantity,
      item.average_cost,
      item.commission_rate,
      item.commission_included
    ].join(',')
  );

  return [headers.join(','), ...rows].join('\n');
};

const parseCsvItems = (csvContent) => {
  const lines = String(csvContent)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(',').map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(',');
    const item = {};

    headers.forEach((header, index) => {
      let value = values[index]?.trim();
      if (header === 'quantity' || header === 'average_cost' || header === 'commission_rate') {
        value = Number.parseFloat(value);
      } else if (header === 'commission_included') {
        value = value === 'true';
      }
      item[header] = value;
    });

    return normalizeItem(item);
  });
};

const appendItemsToActivePortfolio = (state, items) => {
  const nextState = normalizePortfolioState(clone(state));
  const activePortfolio = getActivePortfolioEntry(nextState);
  activePortfolio.items = [...activePortfolio.items, ...items.map(normalizeItem)];
  return nextState;
};

export const importPortfolioData = (state, fileName, content) => {
  const normalizedState = normalizePortfolioState(state);
  const lowerName = String(fileName || '').toLowerCase();

  if (lowerName.endsWith('.json')) {
    const data = JSON.parse(content);

    if (data?.portfolios && data?.activePortfolioId) {
      const importedState = normalizePortfolioState(data);
      const importedPortfolio =
        importedState.portfolios.find((portfolio) => portfolio.id === importedState.activePortfolioId) ||
        importedState.portfolios[0];

      return {
        state: appendItemsToActivePortfolio(normalizedState, importedPortfolio.items),
        count: importedPortfolio.items.length,
        message: `Imported ${importedPortfolio.items.length} items into ${getActivePortfolio(normalizedState).name}`
      };
    }

    if (Array.isArray(data)) {
      return {
        state: appendItemsToActivePortfolio(normalizedState, data.map(normalizeItem)),
        count: data.length,
        message: `Imported ${data.length} items into ${getActivePortfolio(normalizedState).name}`
      };
    }

    throw new Error('Invalid JSON file');
  }

  const csvItems = parseCsvItems(content);
  return {
    state: appendItemsToActivePortfolio(normalizedState, csvItems),
    count: csvItems.length,
    message: `Imported ${csvItems.length} items into ${getActivePortfolio(normalizedState).name}`
  };
};

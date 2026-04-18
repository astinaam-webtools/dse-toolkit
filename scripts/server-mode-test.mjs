import assert from 'node:assert/strict';

const APP_SETTINGS_KEY = 'dse_toolkit_app_settings_v1';
const STOCKS_KEY = 'dse_toolkit_portfolios';
const FUNDS_KEY = 'dse-mutual-funds';

class FakeStorage {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

global.localStorage = new FakeStorage();
global.window = { location: { origin: 'http://localhost:8000' } };

const {
  setServerUrl,
  clearServerUrl,
  getAppSettings,
  setAuthSession,
  clearAuthSession,
  getImportDecision,
  setImportDecision
} = await import('../src/lib/appSettings.js');

const {
  readLocalPortfolioState,
  writeLocalPortfolioState,
  createDefaultPortfolioState
} = await import('../src/lib/portfolioLogic.js');

const {
  readLocalFundsData,
  writeLocalFundsData,
  createEmptyFundsData
} = await import('../src/lib/fundsLogic.js');

const { loadDocument, saveDocument, getSession } = await import('../src/lib/documentGateway.js');

const { getConnectionState, getStoredConnectionState, AuthRequiredError } = await import('../src/lib/serverClient.js');

const run = async () => {
  // 1) Client-only regression for stock/fund persistence
  clearServerUrl();

  const stockState = createDefaultPortfolioState();
  stockState.portfolios[0].items.push({
    symbol: 'GP',
    quantity: 10,
    average_cost: 240,
    commission_rate: 0.004,
    commission_included: false,
    added_at: new Date().toISOString()
  });

  await saveDocument('stocks', stockState, {
    writeLocal: writeLocalPortfolioState
  });

  const loadedStocks = await loadDocument('stocks', {
    readLocal: readLocalPortfolioState,
    createDefault: createDefaultPortfolioState
  });

  assert.equal(loadedStocks.portfolios[0].items.length, 1, 'Client-only stocks should persist to local storage');
  assert.ok(localStorage.getItem(STOCKS_KEY), 'Stocks local storage key should exist in client-only mode');

  const fundsDoc = createEmptyFundsData();
  fundsDoc.portfolios.push({
    id: 'pf-1',
    name: 'Main Funds',
    created_at: new Date().toISOString(),
    funds: []
  });
  fundsDoc.activePortfolioId = 'pf-1';

  await saveDocument('funds', fundsDoc, {
    writeLocal: writeLocalFundsData
  });

  const loadedFunds = await loadDocument('funds', {
    readLocal: readLocalFundsData,
    createDefault: createEmptyFundsData
  });

  assert.equal(loadedFunds.portfolios.length, 1, 'Client-only funds should persist to local storage');
  assert.ok(localStorage.getItem(FUNDS_KEY), 'Funds local storage key should exist in client-only mode');

  // 2) Connected but unauthenticated mode should lock reads/writes
  setServerUrl('http://localhost:39001');

  await assert.rejects(
    () =>
      loadDocument('stocks', {
        readLocal: readLocalPortfolioState,
        createDefault: createDefaultPortfolioState
      }),
    (error) => error instanceof AuthRequiredError,
    'Server-mode reads without auth should require login'
  );

  await assert.rejects(
    () =>
      saveDocument('stocks', stockState, {
        writeLocal: writeLocalPortfolioState
      }),
    (error) => error instanceof AuthRequiredError,
    'Server-mode writes without auth should require login'
  );

  assert.equal(readLocalPortfolioState().portfolios[0].items.length, 1, 'Auth gating must not corrupt local stocks data');

  const storedNoAuth = getStoredConnectionState();
  assert.equal(storedNoAuth.code, 'login-required', 'Stored state should be login-required when server is set without token');

  const noAuthHealthState = await getConnectionState();
  assert.equal(noAuthHealthState.code, 'unavailable', 'Unreachable configured server should report unavailable status');

  // 3) Session metadata contract via gateway
  setAuthSession('fake-token', { id: 'u1', email: 'demo@example.com' });
  const session = getSession();
  assert.equal(session.isAuthenticated, true, 'Gateway getSession should expose authenticated state');
  assert.equal(session.user?.email, 'demo@example.com', 'Gateway getSession should expose current user');

  const withTokenState = await getConnectionState();
  assert.equal(withTokenState.code, 'unavailable', 'Unreachable server with token should still report unavailable');

  // 4) Import-decision flags contract
  assert.equal(getImportDecision('stocks'), null, 'Stocks import decision should start null after new server URL');
  assert.equal(getImportDecision('funds'), null, 'Funds import decision should start null after new server URL');

  setImportDecision('stocks', 'imported');
  setImportDecision('funds', 'skipped');
  assert.equal(getImportDecision('stocks'), 'imported', 'Stocks import decision should persist');
  assert.equal(getImportDecision('funds'), 'skipped', 'Funds import decision should persist');

  // 5) Clearing server URL should return to client-only and keep local data
  clearAuthSession();
  clearServerUrl();
  const finalSettings = getAppSettings();
  assert.equal(finalSettings.serverUrl, '', 'Clearing URL should disable server mode');
  assert.equal(finalSettings.authToken, null, 'Clearing URL should clear auth token');
  assert.equal(readLocalPortfolioState().portfolios[0].items.length, 1, 'Clearing server mode should keep local stock data');
  assert.equal(readLocalFundsData().portfolios.length, 1, 'Clearing server mode should keep local funds data');

  console.log('Server mode tests passed:', {
    stocksLocalItems: readLocalPortfolioState().portfolios[0].items.length,
    fundsLocalPortfolios: readLocalFundsData().portfolios.length,
    settingsKeyPresent: Boolean(localStorage.getItem(APP_SETTINGS_KEY))
  });
};

try {
  await run();
} catch (error) {
  console.error('Server mode test failed:', error.message);
  process.exit(1);
}

/**
 * Offline-first sync tests.
 *
 * Covers:
 *   1. Server-unavailable load: falls back to local cache (no throw)
 *   2. Offline save: writes local first, sets pendingSync flag, returns local data
 *   3. Auth error (401) propagates even when server is "reachable"
 *   4. Successful save: clears pendingSync flag
 *   5. flushPendingSync: uploads queued types and clears flags
 *   6. flushPendingSync: skips types with no pending flag
 *   7. flushPendingSync: no-ops when no auth
 *   8. Clearing server URL resets pendingSync flags
 *   9. hasPendingSync helper reflects state correctly
 */

import assert from 'node:assert/strict';

// ── Fake browser globals ─────────────────────────────────────────────────────

class FakeStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, value) { this.store.set(key, String(value)); }
  removeItem(key) { this.store.delete(key); }
  clear() { this.store.clear(); }
}

global.localStorage = new FakeStorage();
global.window = { location: { origin: 'http://localhost:8000' } };

// ── Fetch mock helpers ────────────────────────────────────────────────────────

let fetchMock = null;
global.fetch = (...args) => {
  if (!fetchMock) throw new Error('No fetchMock configured');
  return fetchMock(...args);
};

const mockFetchOk = (body) => {
  fetchMock = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body)
  });
};

const mockFetchNetworkError = () => {
  fetchMock = async () => { throw new TypeError('Failed to fetch'); };
};

const mockFetchStatus = (status, body = {}) => {
  fetchMock = async () => ({
    ok: false,
    status,
    text: async () => JSON.stringify(body)
  });
};

const noFetch = () => { fetchMock = null; };

// ── Import modules (after globals set) ────────────────────────────────────────

const {
  setServerUrl,
  clearServerUrl,
  setAuthSession,
  clearAuthSession,
  getAppSettings,
  getPendingSync,
  hasPendingSync,
  setPendingSync
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

const {
  loadDocument,
  saveDocument,
  flushPendingSync,
  registerLocalReader
} = await import('../src/lib/documentGateway.js');

const { AuthRequiredError } = await import('../src/lib/serverClient.js');

// Register local readers (normally done by stores on import)
registerLocalReader('stocks', readLocalPortfolioState);
registerLocalReader('funds', readLocalFundsData);

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeStockState = () => {
  const state = createDefaultPortfolioState();
  state.portfolios[0].items.push({
    symbol: 'SQUARE',
    quantity: 5,
    average_cost: 180,
    commission_rate: 0.004,
    commission_included: false,
    added_at: new Date().toISOString()
  });
  return state;
};

const makeFundsData = () => {
  const data = createEmptyFundsData();
  data.portfolios.push({ id: 'f1', name: 'Fund A', created_at: new Date().toISOString(), funds: [] });
  data.activePortfolioId = 'f1';
  return data;
};

// ── Tests ─────────────────────────────────────────────────────────────────────

const run = async () => {

  // ── Test 1: Server-unavailable load falls back to local cache ──────────────
  localStorage.clear();
  clearServerUrl();

  const stockState = makeStockState();
  // First seed local storage in client-only mode
  writeLocalPortfolioState(stockState);

  // Now switch to server mode with auth
  setServerUrl('http://localhost:39001');
  setAuthSession('tok', { id: 'u1', email: 'a@b.com' });

  // Simulate network error on /api/portfolio/stocks
  mockFetchNetworkError();

  const loaded = await loadDocument('stocks', {
    readLocal: readLocalPortfolioState,
    createDefault: createDefaultPortfolioState
  });

  assert.equal(
    loaded.portfolios[0].items.length,
    1,
    'Test 1: load should fall back to local cache when server is unreachable'
  );

  noFetch();

  // ── Test 2: Offline save writes local and sets pendingSync ─────────────────
  mockFetchNetworkError();

  const saved = await saveDocument('stocks', stockState, {
    writeLocal: writeLocalPortfolioState
  });

  assert.equal(
    saved.portfolios[0].items.length,
    1,
    'Test 2: saveDocument should return local data on network failure'
  );
  assert.ok(
    readLocalPortfolioState().portfolios[0].items.length === 1,
    'Test 2: local storage must be written even when server fails'
  );
  assert.ok(
    getPendingSync().stocks === true,
    'Test 2: pendingSync.stocks should be true after network failure'
  );
  assert.ok(hasPendingSync(), 'Test 2: hasPendingSync() should return true');

  noFetch();

  // ── Test 3: Auth error (401) propagates — no local fallback ───────────────
  // Reset pendingSync for clean state
  setPendingSync('stocks', false);

  // Seed some local data before the auth-fail scenario
  writeLocalPortfolioState(stockState);

  mockFetchStatus(401, { error: 'Unauthorized' });

  await assert.rejects(
    () => loadDocument('stocks', {
      readLocal: readLocalPortfolioState,
      createDefault: createDefaultPortfolioState
    }),
    (err) => err instanceof AuthRequiredError,
    'Test 3: 401 from server must throw AuthRequiredError (not fall back to local)'
  );

  await assert.rejects(
    () => saveDocument('stocks', stockState, {
      writeLocal: writeLocalPortfolioState
    }),
    (err) => err instanceof AuthRequiredError,
    'Test 3: 401 on save must throw AuthRequiredError'
  );

  // pendingSync must NOT be set by an auth error path
  assert.ok(
    getPendingSync().stocks === false,
    'Test 3: pendingSync must not be set when save fails due to auth error'
  );

  noFetch();

  // ── Test 4: Successful save clears pendingSync ─────────────────────────────
  // The 401 responses above triggered clearAuthSession() internally — restore it
  setAuthSession('tok', { id: 'u1', email: 'a@b.com' });

  // Manually set pending flag
  setPendingSync('stocks', true);
  assert.ok(getPendingSync().stocks, 'Test 4: precondition — pendingSync.stocks is true');

  mockFetchOk({ document: stockState });

  const savedOk = await saveDocument('stocks', stockState, {
    writeLocal: writeLocalPortfolioState
  });

  assert.equal(
    savedOk.portfolios[0].items.length,
    1,
    'Test 4: saveDocument should return server document on success'
  );
  assert.ok(
    getPendingSync().stocks === false,
    'Test 4: pendingSync.stocks should be cleared after successful server save'
  );

  noFetch();

  // ── Test 5: flushPendingSync uploads queued types and clears flags ─────────
  // Seed local stocks and funds
  writeLocalPortfolioState(stockState);
  const fundsData = makeFundsData();
  writeLocalFundsData(fundsData);

  setPendingSync('stocks', true);
  setPendingSync('funds', true);

  let uploadedTypes = [];
  fetchMock = async (url) => {
    if (url.includes('/stocks')) uploadedTypes.push('stocks');
    if (url.includes('/funds')) uploadedTypes.push('funds');
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ document: {} })
    };
  };

  const { flushed, errors } = await flushPendingSync();

  assert.equal(errors.length, 0, 'Test 5: flushPendingSync should have no errors');
  assert.ok(flushed.includes('stocks'), 'Test 5: stocks should be in flushed list');
  assert.ok(flushed.includes('funds'), 'Test 5: funds should be in flushed list');
  assert.ok(uploadedTypes.includes('stocks'), 'Test 5: stocks upload request was made');
  assert.ok(uploadedTypes.includes('funds'), 'Test 5: funds upload request was made');
  assert.ok(getPendingSync().stocks === false, 'Test 5: pendingSync.stocks cleared after flush');
  assert.ok(getPendingSync().funds === false, 'Test 5: pendingSync.funds cleared after flush');
  assert.ok(!hasPendingSync(), 'Test 5: hasPendingSync() should be false after full flush');

  noFetch();

  // ── Test 6: flushPendingSync skips types that have no pending flag ─────────
  setPendingSync('stocks', false);
  setPendingSync('funds', false);

  let flushCallCount = 0;
  fetchMock = async () => {
    flushCallCount++;
    return { ok: true, status: 200, text: async () => JSON.stringify({ document: {} }) };
  };

  const { flushed: flushed6 } = await flushPendingSync();
  assert.equal(flushed6.length, 0, 'Test 6: nothing should be flushed when no pending flags');
  assert.equal(flushCallCount, 0, 'Test 6: no network requests made when no pending flags');

  noFetch();

  // ── Test 7: flushPendingSync no-ops when no auth token ────────────────────
  setPendingSync('stocks', true);
  clearAuthSession();

  let fetchCalledInTest7 = false;
  fetchMock = async () => { fetchCalledInTest7 = true; return { ok: true, status: 200, text: async () => '{}' }; };

  const { flushed: flushed7 } = await flushPendingSync();
  assert.equal(flushed7.length, 0, 'Test 7: flush should be a no-op without auth token');
  assert.ok(!fetchCalledInTest7, 'Test 7: no fetch call should be made without auth');

  // Restore auth
  setAuthSession('tok', { id: 'u1', email: 'a@b.com' });
  noFetch();

  // ── Test 8: clearServerUrl resets pendingSync flags ───────────────────────
  setPendingSync('stocks', true);
  setPendingSync('funds', true);

  clearServerUrl();

  const settingsAfterClear = getAppSettings();
  assert.ok(settingsAfterClear.pendingSync.stocks === false, 'Test 8: pendingSync.stocks reset on clearServerUrl');
  assert.ok(settingsAfterClear.pendingSync.funds === false, 'Test 8: pendingSync.funds reset on clearServerUrl');
  assert.ok(!hasPendingSync(), 'Test 8: hasPendingSync() should be false after clearServerUrl');

  // ── Test 9: setServerUrl resets pendingSync flags ─────────────────────────
  setServerUrl('http://old-server.example.com');
  setAuthSession('tok', { id: 'u1', email: 'a@b.com' });
  setPendingSync('stocks', true);

  // Setting a NEW server URL resets flags
  setServerUrl('http://new-server.example.com');
  assert.ok(getAppSettings().pendingSync.stocks === false, 'Test 9: pendingSync reset when server URL changes');

  noFetch();

  console.log('Offline-first sync tests passed ✓', {
    tests: 9
  });
};

try {
  await run();
} catch (error) {
  console.error('Offline-first test failed:', error.message);
  process.exit(1);
}

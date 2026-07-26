# Unified Portfolios Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse stocks and mutual funds into one Portfolios page (Dual Pulse overview + weight bars + holdings count) while keeping separate localStorage schemas and promoting Chart Playbook into the primary tab bar.

**Architecture:** Add a pure `portfoliosOverview.js` merge layer over existing `portfolioLogic` / `fundsLogic`. Replace the portfolio page UI with a unified shell-driven view controlled by `portfoliosApp.js`. Keep CRUD writes going through the existing stores. `funds.html` becomes a redirect; `shell.js` swaps Stocks+Funds tabs for Portfolios+Playbook.

**Tech Stack:** Vanilla JS ES modules (no bundler), `styles.css` OKLCH tokens, existing `.sheet` / `.btn` / `.metric` patterns, Node assert smoke tests via `npm test`.

**Spec:** `docs/superpowers/specs/2026-07-26-unified-portfolios-design.md`

## Global Constraints

- Mobile-first 360px; no horizontal scroll at 320–390px; desktop shell ≥1024px.
- One stylesheet: `styles.css`. Per-page `<style>` only for page-specific layout. No token/component forks.
- Touch targets ≥44×44px. Visible `:focus-visible`. Honor `prefers-reduced-motion`.
- Animate `transform`/`opacity` only; exits ~70% of entrance duration.
- No new dependencies. No schema migration. Separate keys: `dse_toolkit_portfolios`, `dse-mutual-funds`.
- Manrope + Sora only. Brand accent for UI; `--up`/`--down` for P/L only.
- `npm test` must stay green.
- Shell mounts required: `#tabbar-mount`, `#footer-mount`, `viewport-fit=cover`, `src/shell.js`.

## File map

| File | Role |
|------|------|
| `src/lib/portfoliosOverview.js` | Pure merge: parse category, build holdings rows, overview + weights |
| `scripts/portfolios-overview-test.mjs` | Unit tests for overview helpers |
| `package.json` | Wire new test into `npm test` |
| `src/shell.js` | PRIMARY_TABS + activeTabId for Portfolios / Playbook |
| `funds.html` | Redirect to `portfolio.html?category=funds` |
| `styles.css` | `.pf-*` layout classes for unified page |
| `portfolio.html` | Unified markup (overview, filter, holdings, sheets, FAB) |
| `src/portfoliosApp.js` | Page controller (load both stores, render, sheets, CRUD bridges) |
| `index.html` | Feature-card copy points at unified Portfolios |
| `sw.js` | Keep caching `funds.html` (redirect) + `portfolio.html` |
| `src/portfolioApp.js`, `src/fundsApp.js` | Remove from page entry after cutover (delete once unused) |

---

### Task 1: Pure overview merge module (TDD)

**Files:**
- Create: `src/lib/portfoliosOverview.js`
- Create: `scripts/portfolios-overview-test.mjs`
- Modify: `package.json` (`test` script)

**Interfaces:**
- Consumes: `calculateItemMetrics` from `portfolioLogic.js`; `calculateFundStats`, `calculateAggregateStats` from `fundsLogic.js`
- Produces:
  - `parseCategoryParam(value: string | null): 'all' | 'stocks' | 'funds'`
  - `buildStockHoldings(stockState, marketData): HoldingRow[]`
  - `buildFundHoldings(fundsData): HoldingRow[]`
  - `filterHoldings(rows, category): HoldingRow[]`
  - `buildOverview({ stockState, fundsData, marketData, category }): Overview`
  - `withWeights(rows, totalValue): HoldingRow[]` (adds `weightPct`)

`HoldingRow` shape:
```js
{
  id: string,                 // e.g. "stock:PORT_ID:GP" or "fund:PORT_ID:FUND_ID"
  category: 'stock' | 'fund',
  symbol: string,
  label: string,              // display name (fund may differ from symbol)
  portfolioId: string,
  portfolioName: string,
  quantity: number,
  quantityLabel: string,      // "120 sh" | "2400 u"
  currentValue: number,
  totalCost: number,
  pl: number,
  plPct: number,
  weightPct: number           // 0–100, set by withWeights
}
```

`Overview` shape:
```js
{
  category: 'all' | 'stocks' | 'funds',
  totalValue: number,
  totalInvested: number,
  totalPl: number,
  totalPlPct: number,
  holdingCount: number,
  stocks: { value: number, invested: number, pl: number, plPct: number, sharePct: number },
  funds: { value: number, invested: number, pl: number, plPct: number, sharePct: number, dividendReinvest: number },
  showSplit: boolean          // true only when category === 'all'
}
```

- [ ] **Step 1: Write the failing test file**

Create `scripts/portfolios-overview-test.mjs`:

```js
import {
  parseCategoryParam,
  buildStockHoldings,
  buildFundHoldings,
  filterHoldings,
  buildOverview,
  withWeights
} from '../src/lib/portfoliosOverview.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const marketData = {
  stocks: [{ symbol: 'GP', metrics: { ltp: 300 } }]
};

const stockState = {
  activePortfolioId: 's1',
  portfolios: [{
    id: 's1',
    name: 'Main Portfolio',
    items: [{
      symbol: 'GP',
      quantity: 100,
      average_cost: 250,
      commission_rate: 0,
      commission_included: true
    }]
  }]
};

const fundsData = {
  portfolios: [{
    id: 'f1',
    name: 'Retirement SIP — Haji Family Trust',
    funds: [{
      id: 'fund1',
      name: 'LR Global',
      symbol: 'LRGLOBMF1',
      amc: 'LR',
      current_nav: 20.4,
      transactions: [
        { id: 't1', type: 'BUY', units: 2400, nav: 19, total_cost: 45600, date: '2026-01-01' }
      ]
    }]
  }]
};

assert(parseCategoryParam(null) === 'all', 'default all');
assert(parseCategoryParam('FUNDS') === 'funds', 'normalize funds');
assert(parseCategoryParam('nope') === 'all', 'invalid → all');

const stockRows = buildStockHoldings(stockState, marketData);
assert(stockRows.length === 1, 'one stock row');
assert(stockRows[0].category === 'stock', 'stock category');
assert(stockRows[0].currentValue === 30000, '100 * 300');
assert(stockRows[0].portfolioName === 'Main Portfolio', 'portfolio name');

const fundRows = buildFundHoldings(fundsData);
assert(fundRows.length === 1, 'one fund row');
assert(fundRows[0].category === 'fund', 'fund category');
assert(Math.round(fundRows[0].currentValue) === 48960, '2400 * 20.4');

const all = [...stockRows, ...fundRows];
assert(filterHoldings(all, 'stocks').every((r) => r.category === 'stock'), 'stocks filter');
assert(filterHoldings(all, 'funds').every((r) => r.category === 'fund'), 'funds filter');
assert(filterHoldings(all, 'all').length === 2, 'all filter');

const overviewAll = buildOverview({ stockState, fundsData, marketData, category: 'all' });
assert(overviewAll.showSplit === true, 'split on all');
assert(overviewAll.holdingCount === 2, 'count 2');
assert(overviewAll.totalValue === stockRows[0].currentValue + fundRows[0].currentValue, 'sum values');
assert(overviewAll.stocks.sharePct + overviewAll.funds.sharePct === 100 || overviewAll.totalValue === 0, 'shares sum 100');

const overviewStocks = buildOverview({ stockState, fundsData, marketData, category: 'stocks' });
assert(overviewStocks.showSplit === false, 'no split on stocks');
assert(overviewStocks.holdingCount === 1, 'stocks count');

const weighted = withWeights(all, overviewAll.totalValue);
assert(Math.abs(weighted.reduce((s, r) => s + r.weightPct, 0) - 100) < 0.2, 'weights ~100');

const emptyOverview = buildOverview({
  stockState: { activePortfolioId: null, portfolios: [] },
  fundsData: { portfolios: [] },
  marketData: { stocks: [] },
  category: 'all'
});
assert(emptyOverview.totalValue === 0 && emptyOverview.holdingCount === 0, 'empty ok');
assert(emptyOverview.stocks.sharePct === 0 && emptyOverview.funds.sharePct === 0, 'empty shares 0');

console.log('portfolios-overview-test: ok');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/portfolios-overview-test.mjs`  
Expected: FAIL with module not found / export missing.

- [ ] **Step 3: Implement `src/lib/portfoliosOverview.js`**

```js
import { calculateItemMetrics, listPortfolios as listStockPortfolios } from './portfolioLogic.js';
import { calculateFundStats, calculateAggregateStats } from './fundsLogic.js';

export function parseCategoryParam(value) {
  const v = String(value || 'all').toLowerCase();
  if (v === 'stocks' || v === 'stock') return 'stocks';
  if (v === 'funds' || v === 'fund') return 'funds';
  return 'all';
}

export function buildStockHoldings(stockState, marketData) {
  const stocks = marketData?.stocks || [];
  const rows = [];
  for (const portfolio of listStockPortfolios(stockState)) {
    for (const item of portfolio.items || []) {
      const quote = stocks.find((s) => s.symbol === item.symbol);
      const ltp = quote?.metrics?.ltp ?? Number(item.average_cost) || 0;
      const metrics = calculateItemMetrics(item, ltp);
      rows.push({
        id: `stock:${portfolio.id}:${item.symbol}`,
        category: 'stock',
        symbol: item.symbol,
        label: item.symbol,
        portfolioId: portfolio.id,
        portfolioName: portfolio.name,
        quantity: Number(item.quantity) || 0,
        quantityLabel: `${Number(item.quantity) || 0} sh`,
        currentValue: metrics.currentValue,
        totalCost: metrics.totalCost,
        pl: metrics.profitLoss,
        plPct: metrics.profitLossPercentage,
        weightPct: 0,
        _stockIndex: (portfolio.items || []).indexOf(item)
      });
    }
  }
  return rows;
}

export function buildFundHoldings(fundsData) {
  const rows = [];
  for (const portfolio of fundsData?.portfolios || []) {
    for (const fund of portfolio.funds || []) {
      const stats = calculateFundStats(fund);
      rows.push({
        id: `fund:${portfolio.id}:${fund.id}`,
        category: 'fund',
        symbol: fund.symbol || fund.name,
        label: fund.name || fund.symbol,
        portfolioId: portfolio.id,
        portfolioName: portfolio.name,
        quantity: stats.totalUnits,
        quantityLabel: `${stats.totalUnits} u`,
        currentValue: stats.currentValue,
        totalCost: stats.totalCost,
        pl: stats.gainLoss,
        plPct: stats.gainLossPercent,
        weightPct: 0,
        fundId: fund.id
      });
    }
  }
  return rows;
}

export function filterHoldings(rows, category) {
  if (category === 'stocks') return rows.filter((r) => r.category === 'stock');
  if (category === 'funds') return rows.filter((r) => r.category === 'fund');
  return rows.slice();
}

function categoryBlock({ value, invested, pl, plPct, sharePct, dividendReinvest = 0 }) {
  return { value, invested, pl, plPct, sharePct, dividendReinvest };
}

export function buildOverview({ stockState, fundsData, marketData, category }) {
  const stockRows = buildStockHoldings(stockState, marketData);
  const fundRows = buildFundHoldings(fundsData);
  const stocksValue = stockRows.reduce((s, r) => s + r.currentValue, 0);
  const stocksInvested = stockRows.reduce((s, r) => s + r.totalCost, 0);
  const stocksPl = stocksValue - stocksInvested;
  const stocksPlPct = stocksInvested > 0 ? (stocksPl / stocksInvested) * 100 : 0;

  const fundAgg = calculateAggregateStats(fundsData?.portfolios || []);
  const fundsValue = fundAgg.currentValue;
  const fundsInvested = fundAgg.totalInvested;
  const fundsPl = fundAgg.gainLoss;
  const fundsPlPct = fundAgg.gainLossPercent;

  const combinedValue = stocksValue + fundsValue;
  const stockShare = combinedValue > 0 ? (stocksValue / combinedValue) * 100 : 0;
  const fundShare = combinedValue > 0 ? (fundsValue / combinedValue) * 100 : 0;

  const stocks = categoryBlock({
    value: stocksValue,
    invested: stocksInvested,
    pl: stocksPl,
    plPct: stocksPlPct,
    sharePct: stockShare
  });
  const funds = categoryBlock({
    value: fundsValue,
    invested: fundsInvested,
    pl: fundsPl,
    plPct: fundsPlPct,
    sharePct: fundShare,
    dividendReinvest: fundAgg.totalDividendReinvest
  });

  const visible = filterHoldings([...stockRows, ...fundRows], category);
  const totalValue = visible.reduce((s, r) => s + r.currentValue, 0);
  const totalInvested = visible.reduce((s, r) => s + r.totalCost, 0);
  const totalPl = totalValue - totalInvested;
  const totalPlPct = totalInvested > 0 ? (totalPl / totalInvested) * 100 : 0;

  return {
    category,
    totalValue,
    totalInvested,
    totalPl,
    totalPlPct,
    holdingCount: visible.length,
    stocks,
    funds,
    showSplit: category === 'all'
  };
}

export function withWeights(rows, totalValue) {
  if (!totalValue || totalValue <= 0) {
    return rows.map((r) => ({ ...r, weightPct: 0 }));
  }
  return rows.map((r) => ({
    ...r,
    weightPct: (r.currentValue / totalValue) * 100
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/portfolios-overview-test.mjs`  
Expected: `portfolios-overview-test: ok`

- [ ] **Step 5: Wire into `npm test`**

In `package.json`, append `&& node scripts/portfolios-overview-test.mjs` to the `test` script.

Run: `npm test`  
Expected: all green including new file.

- [ ] **Step 6: Commit**

```bash
git add src/lib/portfoliosOverview.js scripts/portfolios-overview-test.mjs package.json
git commit -m "feat: add portfolios overview merge helpers"
```

---

### Task 2: Shell tabs + funds redirect

**Files:**
- Modify: `src/shell.js`
- Modify: `funds.html` (replace body with redirect)
- Modify: `src/shell.js` `MORE_ITEMS` (remove Chart Playbook duplicate if present)

**Interfaces:**
- Consumes: none from Task 1
- Produces: tab id `portfolios` active on `portfolio.html`; `playbook` active on `guides.html`

- [ ] **Step 1: Update PRIMARY_TABS and icons in `src/shell.js`**

Replace stocks/funds entries with:

```js
const PRIMARY_TABS = [
  { id: 'glossary',   href: './index.html',     label: 'Glossary',   icon: 'book' },
  { id: 'market',     href: './market.html',    label: 'Market',     icon: 'chart' },
  { id: 'portfolios', href: './portfolio.html', label: 'Portfolios', icon: 'briefcase' },
  { id: 'playbook',   href: './guides.html',    label: 'Playbook',   icon: 'playbook' },
  { id: 'ai',         href: './chat.html',      label: 'AI',         icon: 'sparkle' }
];
```

Add a `playbook` SVG to `ICONS` (clipboard / book-open style, 24×24 stroke matching siblings).

Update `activeTabId()`:

```js
if (file === 'portfolio.html') return 'portfolios';
if (file === 'guides.html') return 'playbook';
// remove funds.html → funds mapping
```

Remove `{ href: './guides.html', label: 'Chart Playbook' }` from `MORE_ITEMS` and from `FOOTER_LINKS` only if it would duplicate the primary tab awkwardly — keep footer Chart Playbook link (footer can still link). Prefer: remove from `MORE_ITEMS` only.

- [ ] **Step 2: Replace `funds.html` with redirect**

Minimal document:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>DSE Toolkit | Mutual Funds</title>
  <meta http-equiv="refresh" content="0; url=./portfolio.html?category=funds" />
  <link rel="canonical" href="./portfolio.html?category=funds" />
  <script>
    location.replace('./portfolio.html?category=funds');
  </script>
</head>
<body>
  <p><a href="./portfolio.html?category=funds">Continue to Portfolios (Funds)</a></p>
</body>
</html>
```

- [ ] **Step 3: Manual check**

Open `funds.html` in browser → lands on `portfolio.html?category=funds`.  
Confirm tab bar shows Glossary / Market / Portfolios / Playbook / AI.

- [ ] **Step 4: Commit**

```bash
git add src/shell.js funds.html
git commit -m "feat: Portfolios tab + Playbook; redirect funds.html"
```

---

### Task 3: Portfolios page CSS (Dual Pulse + holdings)

**Files:**
- Modify: `styles.css` (append portfolios section; do not redefine `.btn`/`.card`/`.sheet` tokens)

**Interfaces:**
- Produces classes: `.pf-page`, `.pf-header`, `.pf-seg`, `.pf-overview`, `.pf-pulse`, `.pf-split`, `.pf-holdings-head`, `.pf-count`, `.pf-holding`, `.pf-holding__bar`, `.pf-badge`, `.pf-fab`, `.pf-empty`

- [ ] **Step 1: Add CSS using existing tokens**

Key rules (abbreviated — expand fully in file, all values from tokens):

```css
.pf-page { max-width: 1100px; margin: 0 auto; padding: var(--s-4); padding-bottom: calc(var(--s-16) + env(safe-area-inset-bottom)); }
.pf-header { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); margin-bottom: var(--s-4); }
.pf-header h1 { font-family: var(--font-display); font-size: var(--fs-xl); margin: 0; letter-spacing: -0.02em; }
.pf-seg { display: flex; gap: var(--s-1); padding: var(--s-1); background: var(--surface-sunk); border-radius: var(--r-pill); margin-bottom: var(--s-4); }
.pf-seg__btn { flex: 1; min-height: 44px; border: 0; border-radius: var(--r-pill); background: transparent; color: var(--text-muted); font-weight: 600; font-size: var(--fs-sm); cursor: pointer; }
.pf-seg__btn.is-active { background: var(--surface); color: var(--text); box-shadow: var(--shadow-1); }
.pf-seg__btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.pf-overview { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); padding: var(--s-5); box-shadow: var(--shadow-1); margin-bottom: var(--s-5); }
.pf-overview__label { font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 600; }
.pf-overview__value { font-family: var(--font-display); font-size: var(--fs-lg); font-weight: 700; font-variant-numeric: tabular-nums; margin: var(--s-1) 0; }
.pf-pulse { display: flex; height: 6px; border-radius: var(--r-pill); overflow: hidden; background: var(--surface-sunk); margin-top: var(--s-3); }
.pf-pulse__stocks { background: var(--accent); }
.pf-pulse__funds { background: oklch(55% 0.08 220); } /* secondary category hue; lightness ≠ accent */
.pf-split { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-3); margin-top: var(--s-4); padding-top: var(--s-4); border-top: 1px solid var(--border); }
.pf-holdings-head { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); margin-bottom: var(--s-3); }
.pf-holdings-head h2 { margin: 0; font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); display: flex; align-items: center; gap: var(--s-2); }
.pf-count { display: inline-grid; place-items: center; min-width: 1.4rem; min-height: 1.25rem; padding: 0 var(--s-2); border-radius: var(--r-pill); background: var(--accent-soft); color: var(--accent); font-size: var(--fs-xs); font-weight: 800; }
.pf-holding { display: block; width: 100%; text-align: left; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md); padding: var(--s-4); margin-bottom: var(--s-2); cursor: pointer; color: inherit; font: inherit; min-height: 44px; }
.pf-holding:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.pf-holding__top { display: flex; justify-content: space-between; gap: var(--s-3); }
.pf-holding__left { min-width: 0; flex: 1; }
.pf-holding__sym { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pf-holding__meta { font-size: var(--fs-xs); color: var(--text-muted); margin-top: var(--s-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pf-holding__bar { height: 4px; background: var(--surface-sunk); border-radius: var(--r-pill); margin-top: var(--s-3); overflow: hidden; }
.pf-holding__bar > span { display: block; height: 100%; border-radius: var(--r-pill); background: var(--accent); }
.pf-holding__bar > span.is-fund { background: oklch(55% 0.08 220); }
.pf-badge { display: inline-block; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 0.15rem 0.4rem; border-radius: var(--r-pill); }
.pf-badge--stock { background: var(--accent-soft); color: var(--accent); }
.pf-badge--fund { background: oklch(55% 0.08 220 / 0.12); color: oklch(45% 0.08 220); }
.pf-fab { position: fixed; right: max(var(--s-4), env(safe-area-inset-right)); bottom: calc(72px + env(safe-area-inset-bottom)); width: 56px; height: 56px; border-radius: var(--r-pill); border: 0; background: var(--accent); color: var(--accent-contrast); font-size: 1.5rem; box-shadow: var(--shadow-3); z-index: 40; }
.pf-fab:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.pf-empty { text-align: center; padding: var(--s-8) var(--s-4); color: var(--text-muted); }
@media (prefers-reduced-motion: reduce) {
  .pf-holding, .pf-overview, .pf-seg__btn { transition: none !important; }
}
```

Also gate any hover lifts with `@media (hover: hover) and (pointer: fine)`.

- [ ] **Step 2: Commit**

```bash
git add styles.css
git commit -m "style: add unified Portfolios Dual Pulse layout classes"
```

---

### Task 4: `portfolio.html` markup scaffold

**Files:**
- Modify: `portfolio.html` (replace page body + page `<style>`; keep shell mounts and shared head links)
- Stop loading `src/portfolioApp.js`; load `src/portfoliosApp.js` (file created in Task 5 — for this task add a stub module that exports nothing harmful)

**Interfaces:**
- DOM ids the app will bind:
  - `pf-seg-all`, `pf-seg-stocks`, `pf-seg-funds`
  - `pf-overview`, `pf-holdings-count`, `pf-holdings-list`, `pf-manage-btn`
  - `pf-fab`
  - `pf-holding-sheet` (dialog/sheet overlay)
  - `pf-type-sheet` (All → pick stock/fund)
  - Existing-or-new stock form modal ids (reuse patterns from current portfolio page)
  - Fund form / manage sheets (ids documented in `portfoliosApp.js`)

- [ ] **Step 1: Rewrite main content structure**

Structure:

```html
<main class="pf-page" id="pf-app">
  <header class="pf-header">
    <h1>Portfolios</h1>
    <div class="pf-header__actions">
      <!-- overflow or buttons: export/import stocks & funds per spec -->
    </div>
  </header>

  <div class="pf-seg" role="tablist" aria-label="Category">
    <button type="button" class="pf-seg__btn is-active" id="pf-seg-all" data-category="all" role="tab" aria-selected="true">All</button>
    <button type="button" class="pf-seg__btn" id="pf-seg-stocks" data-category="stocks" role="tab">Stocks</button>
    <button type="button" class="pf-seg__btn" id="pf-seg-funds" data-category="funds" role="tab">Funds</button>
  </div>

  <section class="pf-overview" id="pf-overview" aria-live="polite"><!-- filled by JS --></section>

  <div class="pf-holdings-head">
    <h2>Holdings <span class="pf-count" id="pf-holdings-count">0</span></h2>
    <button type="button" class="btn btn--ghost" id="pf-manage-btn">Manage</button>
  </div>
  <div id="pf-holdings-list" class="pf-holdings-list"></div>
  <div id="pf-empty" class="pf-empty" hidden>No holdings yet. Tap + to add your first position.</div>

  <button type="button" class="pf-fab" id="pf-fab" aria-label="Add holding">+</button>
</main>

<!-- Holding detail sheet: use .sheet-overlay + .sheet -->
<!-- Type picker sheet (Stock vs Fund) -->
<!-- Manage portfolios sheet -->
<!-- Stock add/edit modal (port existing fields) -->
<!-- Fund add/edit + transaction UI (port essential flows from funds.html) -->
```

Keep `#tabbar-mount`, `#footer-mount`, `src/shell.js`, `viewport-fit=cover`.

- [ ] **Step 2: Commit**

```bash
git add portfolio.html
git commit -m "feat: scaffold unified Portfolios page markup"
```

---

### Task 5: `portfoliosApp.js` — load, filter, overview, holdings list

**Files:**
- Create: `src/portfoliosApp.js`
- Modify: `portfolio.html` script tag to `./src/portfoliosApp.js`

**Interfaces:**
- Consumes: `parseCategoryParam`, `buildStockHoldings`, `buildFundHoldings`, `filterHoldings`, `buildOverview`, `withWeights` from Task 1; `loadPortfolioState` / `savePortfolioStateDocument`; `loadFundsDataDocument` / `saveFundsDataDocument`; market JSON used by current portfolio app
- Produces: working filter + render (CRUD sheets can be stubs that `console.warn` until Tasks 6–7)

- [ ] **Step 1: Implement category URL sync**

```js
function getCategory() {
  return parseCategoryParam(new URL(location.href).searchParams.get('category'));
}

function setCategory(category) {
  const url = new URL(location.href);
  if (category === 'all') url.searchParams.delete('category');
  else url.searchParams.set('category', category);
  history.replaceState({}, '', url);
  render();
}
```

Wire segment buttons to `setCategory`.

- [ ] **Step 2: Implement `renderOverview(overview)` and `renderHoldings(rows)`**

- Overview: combined value, P/L with `.up`/`.down`, pulse widths from `stocks.sharePct` / `funds.sharePct`, split blocks when `showSplit`; on Funds filter show dividend reinvest metric; on Stocks/Funds hide split.
- Holdings: buttons `.pf-holding` with badge, truncated meta (`portfolioName · quantityLabel`), value, P/L%, bar width `weightPct`.
- Set `#pf-holdings-count` text to `overview.holdingCount`.
- Toggle empty state when `rows.length === 0`.

Format money with the same BDT helper the current portfolio app uses (extract or import existing formatter if present; otherwise copy the existing `formatCurrency` function into this module — do not invent a third currency style).

- [ ] **Step 3: Load both documents + market data, then `render()`**

Mirror existing portfolio market-data loading path. On failure, still render funds + zeroed stock prices.

- [ ] **Step 4: Smoke check in browser**

With sample localStorage (or empty): switching All/Stocks/Funds updates URL, count, overview split visibility, and list.

- [ ] **Step 5: Commit**

```bash
git add src/portfoliosApp.js portfolio.html
git commit -m "feat: render unified Portfolios overview and holdings feed"
```

---

### Task 6: Holding sheet + View stock + stock CRUD bridge

**Files:**
- Modify: `src/portfoliosApp.js`
- Modify: `portfolio.html` (sheet + stock modal markup if not complete)

**Interfaces:**
- Consumes: `addStock`, `updateStock`, `deleteStock`, `getActivePortfolio`, portfolio create/rename helpers from `portfolioLogic.js`
- Produces: row tap → sheet; Edit/Delete; View stock → `./stock.html?symbol=SYMBOL`

- [ ] **Step 1: Open sheet on holding click**

Sheet content:
- Full `portfolioName` (no truncate)
- Symbol/label, category badge
- Value, cost, P/L
- Actions: Edit, Delete, and if `category === 'stock'` a link/button **View stock** → `stock.html?symbol=${encodeURIComponent(symbol)}`
- Funds: Edit opens fund editor / transaction entry (Task 7 can complete fund edit; for stocks complete here)

- [ ] **Step 2: Port stock add/edit/delete from `portfolioApp.js`**

Reuse validation and `savePortfolioStateDocument`. After save, re-render overview/list. Prefer switching active stock portfolio when editing a row from a non-active portfolio (`switchPortfolio` then edit), or edit by portfolio id without requiring UI active switch — implement edit by locating portfolio id on the row (preferred).

- [ ] **Step 3: FAB when category is `stocks` opens add-stock modal**

- [ ] **Step 4: Commit**

```bash
git add src/portfoliosApp.js portfolio.html
git commit -m "feat: holding sheet with View stock and stock CRUD"
```

---

### Task 7: Fund CRUD + manage portfolios + FAB type picker

**Files:**
- Modify: `src/portfoliosApp.js`
- Modify: `portfolio.html`

**Interfaces:**
- Consumes: fundsLogic CRUD + `saveFundsDataDocument`
- Produces: fund add/edit/delete/NAV/transactions enough to match prior funds page critical path; Manage sheet for both categories when All

- [ ] **Step 1: FAB behavior**

```js
fab.onclick = () => {
  const category = getCategory();
  if (category === 'stocks') openAddStock();
  else if (category === 'funds') openAddFund();
  else openTypePicker(); // sheet: Stock | Fund
};
```

- [ ] **Step 2: Port essential fund flows from `fundsApp.js`**

Minimum viable on unified page:
- Add fund to a selected fund portfolio
- Edit fund / update NAV
- Delete fund
- View recent transactions + add transaction (BUY/SELL/DIVIDEND_REINVEST) if the old page had it in the primary path

Use shared `.sheet` / `.modal` patterns; delete funds-page-specific button radius forks.

- [ ] **Step 3: Manage sheet**

- Category All: two groups headed “Stock portfolios” / “Fund portfolios”
- Stocks/Funds filter: only that group
- Actions: create, rename, delete (confirm), set active for stocks (funds if applicable)

- [ ] **Step 4: Import / Export**

- Filter stocks: existing CSV/JSON stock export-import only
- Filter funds: existing funds JSON export-import only
- Filter all: two explicit controls — “Export/Import stocks” and “Export/Import funds” (no combined format)

- [ ] **Step 5: Commit**

```bash
git add src/portfoliosApp.js portfolio.html
git commit -m "feat: fund CRUD, manage sheet, and scoped import/export"
```

---

### Task 8: Empty states, polish, dead-code removal, docs link updates

**Files:**
- Modify: `src/portfoliosApp.js`, `portfolio.html`, `styles.css` as needed
- Modify: `index.html` feature card (already “Portfolio & Funds” → point solely to `portfolio.html`; update blurb to “Track stocks and mutual funds in one place”)
- Grep and update stray `funds.html` primary CTAs in in-app copy (keep redirect for bookmarks)
- Delete unused: `src/portfolioApp.js`, `src/fundsApp.js` only after confirming nothing imports them
- Update `docs/superpowers/specs/2026-07-26-unified-portfolios-design.md` status to `Approved / Implemented` only after verification (or leave Approved until done)

- [ ] **Step 1: Empty / partial copy**

Match spec §7 strings. CTA buttons call FAB handlers.

- [ ] **Step 2: Motion**

Optional short fade on holdings list when category changes; disabled under `prefers-reduced-motion`.

- [ ] **Step 3: Grep cleanup**

```bash
rg -n "portfolioApp\.js|fundsApp\.js|href=\"./funds.html\"" --glob '!docs/**' --glob '!.worktrees/**'
```

Fix remaining app entry points. Leave `sw.js` / `build.mjs` listing `funds.html` (redirect page still published).

- [ ] **Step 4: Delete dead apps if unused**

```bash
git rm src/portfolioApp.js src/fundsApp.js
```

- [ ] **Step 5: Run full test suite**

Run: `npm test`  
Expected: all scripts pass including `portfolios-overview-test`.

- [ ] **Step 6: Manual QA checklist**

- [ ] 360px: no horizontal scroll; FAB clear of tab bar; segments ≥44px
- [ ] All / Stocks / Funds filter + URL
- [ ] Holdings count on header only
- [ ] Weight bars; long portfolio name ellipsis; full name in sheet
- [ ] Stock sheet → View stock
- [ ] Fund sheet has no View stock
- [ ] Import/export scoped correctly
- [ ] `funds.html` redirect
- [ ] Tab bar: Portfolios + Playbook
- [ ] Dark + light contrast smoke
- [ ] Reduced motion OS setting

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: finish unified Portfolios cutover and remove dead apps"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Unified page All/Stocks/Funds | 4–5 |
| Dual Pulse + weight bars + count on holdings header | 3, 5 |
| Bottom sheet + View stock | 6 |
| FAB type picker on All | 7 |
| Manage portfolios | 7 |
| Import/export scoped | 7 |
| Empty/partial states | 8 |
| Keep separate storage keys | 1, 5–7 (no migration) |
| Tab bar Portfolios + Playbook | 2 |
| `funds.html` redirect | 2 |
| Tokens / a11y / motion | 3, 8 |
| `npm test` | 1, 8 |

No intentional placeholders left. `portfoliosApp.js` is large by nature; Tasks 5–7 stage it so each commit is reviewable.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-26-unified-portfolios.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
**2. Inline Execution** — execute tasks in this session with executing-plans and checkpoints  

Which approach?

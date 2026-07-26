# Stock Detail Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the stock detail page so price + chart lead, a readonly sparkline range bar provides scale, and every present `stock.metrics` field appears in grouped rows (nulls omitted).

**Architecture:** Extract pure layout helpers into `src/lib/stockMetricsLayout.js` (range math, strip, groups, formatting). Wire them from `src/stockDetailApp.js` into new semantic containers in `stock.html`, styled with shared tokens in `styles.css`. No market-data schema changes.

**Tech Stack:** Vanilla JS ES modules (no bundler), `styles.css` OKLCH tokens, Node assert tests via `npm test`.

**Spec:** `docs/superpowers/specs/2026-07-26-stock-detail-redesign-design.md`

## Global Constraints

- Mobile-first 360px; no horizontal scroll at 320–390px; desktop shell ≥1024px.
- One stylesheet: `styles.css`. Per-page `<style>` only for page-specific layout. No token/component forks.
- Touch targets ≥44×44px. Visible `:focus-visible`. Honor `prefers-reduced-motion`.
- Animate `transform`/`opacity` only.
- No new dependencies. No build-pipeline / JSON schema changes.
- Manrope + Sora only. Brand accent for UI; `--up`/`--down` for price change only.
- Missing metrics: omit entirely (no `—` placeholders for absent keys).
- `npm test` must stay green.
- Shell mounts required: `#tabbar-mount`, `#footer-mount`, `viewport-fit=cover`, `src/shell.js`.

## File map

| File | Role |
|------|------|
| `src/lib/stockMetricsLayout.js` | Pure helpers: sparkline range, present-check, format, strip, groups |
| `scripts/stock-metrics-layout-test.mjs` | Unit tests for layout helpers |
| `package.json` | Wire new test into `npm test` |
| `styles.css` | Chart wrap, range bar, trading strip, metric groups |
| `stock.html` | Semantic mounts: chart wrap, range, strip, groups |
| `src/stockDetailApp.js` | Render with helpers; keep fetch/AI/glossary behavior |
| `docs/superpowers/specs/2026-07-26-stock-detail-redesign-design.md` | Mark status Approved after ship (optional final step) |

---

### Task 1: Pure layout helpers (TDD)

**Files:**
- Create: `src/lib/stockMetricsLayout.js`
- Create: `scripts/stock-metrics-layout-test.mjs`
- Modify: `package.json` (`test` script)

**Interfaces:**
- Produces:
  - `isPresentMetric(value: unknown): boolean`
  - `sparklineRange(sparkline: unknown): null | { low: number, high: number, sessions: number, span: number }`
  - `formatMetricValue(key: string, value: unknown): string | null`
  - `metricLabel(key: string): string`
  - `buildTradingStrip(metrics: Record<string, unknown> | null | undefined): Array<{ key: string, label: string, display: string }>`
  - `buildMetricGroups(metrics: Record<string, unknown> | null | undefined): Array<{ id: string, title: string, rows: Array<{ key: string, label: string, display: string, elevated: boolean }> }>`

Strip candidate order (present only): `value`, `mktCap`, `close`, `volume`.

Known groups (stable key order within each):

| id | title | keys |
|----|-------|------|
| `trading` | Trading | `ltp`, `close`, `value`, `volume`, `mktCap` |
| `valuation` | Valuation | `pe`, `auditedPe`, `forwardPe`, `pb`, `nav`, `eps`, `dividendYield` |
| `profitability` | Profitability | `ebitdaMargin`, `operatingMargin`, `netMargin`, `grossMargin`, `roa`, `roe`, `roea`, `roi` |
| `balance` | Balance sheet | `currentRatio`, `quickRatio`, `debtToEquity` |
| `capital` | Capital | `paidUpCapital`, `totalShares` |

Unknown present keys → final group `{ id: 'other', title: 'Other' }` sorted alphabetically by key.

`elevated` is `true` when `key` is in the strip candidate list.

- [ ] **Step 1: Write the failing test file**

Create `scripts/stock-metrics-layout-test.mjs`:

```js
import {
  isPresentMetric,
  sparklineRange,
  formatMetricValue,
  buildTradingStrip,
  buildMetricGroups
} from '../src/lib/stockMetricsLayout.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const rich = {
  ltp: 258.2,
  close: 258.2,
  pe: 11.83,
  value: 26.13,
  mktCap: 348647.47,
  nav: 41.51,
  eps: 10.52,
  dividendYield: 4.07,
  pb: 6.22,
  currentRatio: 0.16,
  quickRatio: 0.13,
  debtToEquity: 0.16,
  ebitdaMargin: 0.31,
  operatingMargin: 0.36,
  netMargin: 0.19,
  grossMargin: 1,
  roa: 0.16,
  roe: 0.53,
  auditedPe: 11.83,
  forwardPe: 12.31,
  paidUpCapital: 13503000220,
  totalShares: 1350300022
};

const sparse = {
  ltp: 950,
  close: 950,
  volume: 1200,
  value: 1.14,
  mktCap: 950,
  nav: 0,
  eps: 0,
  dividendYield: 8.5,
  paidUpCapital: 100000000,
  totalShares: 100000
};

const run = () => {
  assert(isPresentMetric(0) === true, '0 is present');
  assert(isPresentMetric(null) === false, 'null absent');
  assert(isPresentMetric(undefined) === false, 'undefined absent');
  assert(isPresentMetric('') === false, 'empty string absent');
  assert(isPresentMetric(Number.NaN) === false, 'NaN absent');

  assert(sparklineRange(null) === null, 'null sparkline');
  assert(sparklineRange([1]) === null, 'single point');
  const range = sparklineRange([237.7, 240, 258.2]);
  assert(range && range.low === 237.7, 'low');
  assert(range.high === 258.2, 'high');
  assert(range.sessions === 3, 'sessions');
  assert(range.span === 20.5, 'span');

  assert(formatMetricValue('pe', null) === null, 'format null');
  assert(typeof formatMetricValue('mktCap', 348647.47) === 'string', 'format mktCap');

  const strip = buildTradingStrip(rich);
  assert(strip.map((c) => c.key).join(',') === 'value,mktCap,close', 'rich strip order, no volume');
  const stripSparse = buildTradingStrip(sparse);
  assert(stripSparse.map((c) => c.key).join(',') === 'value,mktCap,close,volume', 'sparse strip includes volume');
  assert(buildTradingStrip({}).length === 0, 'empty strip');
  assert(buildTradingStrip(null).length === 0, 'null metrics strip');

  const groups = buildMetricGroups(rich);
  assert(groups.every((g) => g.rows.length > 0), 'no empty groups');
  const ids = groups.map((g) => g.id);
  assert(ids.includes('trading') && ids.includes('valuation') && ids.includes('profitability'), 'core groups');
  assert(ids.includes('balance') && ids.includes('capital'), 'balance+capital');
  assert(!ids.includes('other'), 'no other for known keys');

  const trading = groups.find((g) => g.id === 'trading');
  assert(trading.rows.some((r) => r.key === 'ltp'), 'ltp in trading');
  assert(trading.rows.filter((r) => r.key === 'value')[0].elevated === true, 'value elevated');

  const allKeys = groups.flatMap((g) => g.rows.map((r) => r.key)).sort();
  assert(allKeys.join(',') === Object.keys(rich).sort().join(','), 'all rich keys present exactly once');

  const sparseGroups = buildMetricGroups(sparse);
  assert(!sparseGroups.some((g) => g.id === 'profitability'), 'no empty profitability');
  assert(!sparseGroups.some((g) => g.id === 'balance'), 'no empty balance');

  const withUnknown = buildMetricGroups({ ltp: 1, weirdBeta: 0.9 });
  const other = withUnknown.find((g) => g.id === 'other');
  assert(other && other.rows[0].key === 'weirdBeta', 'unknown → Other');

  const multiUnknown = buildMetricGroups({ ltp: 1, zeta: 1, alpha: 2 });
  const otherKeys = multiUnknown.find((g) => g.id === 'other').rows.map((r) => r.key);
  assert(otherKeys.join(',') === 'alpha,zeta', 'other alphabetical');

  console.log('stock-metrics-layout-test: ok');
};

run();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/stock-metrics-layout-test.mjs`

Expected: FAIL with module not found (`stockMetricsLayout.js`)

- [ ] **Step 3: Implement `src/lib/stockMetricsLayout.js`**

```js
const STRIP_KEYS = ['value', 'mktCap', 'close', 'volume'];

const GROUPS = [
  { id: 'trading', title: 'Trading', keys: ['ltp', 'close', 'value', 'volume', 'mktCap'] },
  { id: 'valuation', title: 'Valuation', keys: ['pe', 'auditedPe', 'forwardPe', 'pb', 'nav', 'eps', 'dividendYield'] },
  { id: 'profitability', title: 'Profitability', keys: ['ebitdaMargin', 'operatingMargin', 'netMargin', 'grossMargin', 'roa', 'roe', 'roea', 'roi'] },
  { id: 'balance', title: 'Balance sheet', keys: ['currentRatio', 'quickRatio', 'debtToEquity'] },
  { id: 'capital', title: 'Capital', keys: ['paidUpCapital', 'totalShares'] }
];

const LABELS = {
  ltp: 'LTP',
  close: 'Close',
  value: 'Value',
  volume: 'Volume',
  mktCap: 'Mkt Cap',
  pe: 'PE',
  auditedPe: 'Audited PE',
  forwardPe: 'Forward PE',
  pb: 'PB',
  nav: 'NAV',
  eps: 'EPS',
  dividendYield: 'Div Yield',
  ebitdaMargin: 'EBITDA Margin',
  operatingMargin: 'Operating Margin',
  netMargin: 'Net Margin',
  grossMargin: 'Gross Margin',
  roa: 'ROA',
  roe: 'ROE',
  roea: 'ROEA',
  roi: 'ROI',
  currentRatio: 'Current Ratio',
  quickRatio: 'Quick Ratio',
  debtToEquity: 'Debt / Equity',
  paidUpCapital: 'Paid-up Capital',
  totalShares: 'Total Shares'
};

const KNOWN = new Set(GROUPS.flatMap((g) => g.keys));

export const isPresentMetric = (value) => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'number' && !Number.isFinite(value)) return false;
  return true;
};

export const sparklineRange = (sparkline) => {
  if (!Array.isArray(sparkline) || sparkline.length < 2) return null;
  const nums = sparkline.filter((n) => typeof n === 'number' && Number.isFinite(n));
  if (nums.length < 2) return null;
  const low = Math.min(...nums);
  const high = Math.max(...nums);
  return {
    low,
    high,
    sessions: sparkline.length,
    span: high - low
  };
};

export const metricLabel = (key) => {
  if (LABELS[key]) return LABELS[key];
  return String(key)
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
};

export const formatMetricValue = (key, value) => {
  if (!isPresentMetric(value)) return null;
  if (typeof value === 'number') {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
};

export const buildTradingStrip = (metrics) => {
  const m = metrics && typeof metrics === 'object' ? metrics : {};
  return STRIP_KEYS
    .map((key) => {
      const display = formatMetricValue(key, m[key]);
      if (display == null) return null;
      return { key, label: metricLabel(key), display };
    })
    .filter(Boolean);
};

export const buildMetricGroups = (metrics) => {
  const m = metrics && typeof metrics === 'object' ? metrics : {};
  const groups = [];

  for (const g of GROUPS) {
    const rows = [];
    for (const key of g.keys) {
      const display = formatMetricValue(key, m[key]);
      if (display == null) continue;
      rows.push({
        key,
        label: metricLabel(key),
        display,
        elevated: STRIP_KEYS.includes(key)
      });
    }
    if (rows.length) groups.push({ id: g.id, title: g.title, rows });
  }

  const unknownKeys = Object.keys(m)
    .filter((key) => !KNOWN.has(key) && isPresentMetric(m[key]))
    .sort((a, b) => a.localeCompare(b));

  if (unknownKeys.length) {
    groups.push({
      id: 'other',
      title: 'Other',
      rows: unknownKeys.map((key) => ({
        key,
        label: metricLabel(key),
        display: formatMetricValue(key, m[key]),
        elevated: STRIP_KEYS.includes(key)
      }))
    });
  }

  return groups;
};
```

- [ ] **Step 4: Run unit test — expect PASS**

Run: `node scripts/stock-metrics-layout-test.mjs`

Expected: `stock-metrics-layout-test: ok`

- [ ] **Step 5: Wire into `npm test`**

In `package.json`, append `&& node scripts/stock-metrics-layout-test.mjs` to the `test` script.

- [ ] **Step 6: Run full test suite**

Run: `npm test`

Expected: all scripts pass, including the new one.

- [ ] **Step 7: Commit**

```bash
git add src/lib/stockMetricsLayout.js scripts/stock-metrics-layout-test.mjs package.json
git commit -m "$(cat <<'EOF'
feat: add stock metrics layout helpers

Pure grouping, strip, and sparkline range helpers with unit coverage
for the stock detail redesign.
EOF
)"
```

---

### Task 2: Styles for chart range, strip, and groups

**Files:**
- Modify: `styles.css` (near existing `#chart-container` / `.detail-grid` / `.metric-card` blocks ~1020–1376)

**Interfaces:**
- Consumes: existing tokens (`--surface`, `--surface-2`, `--border`, `--text-muted`, `--text-faint`, `--s-*`, `--r-*`, `--fs-*`)
- Produces: CSS classes `.stock-chart`, `.stock-chart__canvas`, `.stock-range`, `.stock-strip`, `.stock-strip__item`, `.stock-groups`, `.stock-group`, `.stock-group__head`, `.stock-group__row`, `.stock-group__row--elevated`

- [ ] **Step 1: Replace / extend stock detail layout CSS**

Keep `.detail-header*` and price classes. Add (and stop relying on flat `.detail-grid` for this page):

```css
/* Stock detail — chart + range + strip + groups */
.stock-chart {
  margin: 0 var(--s-6);
  margin-bottom: var(--s-4);
}

.stock-chart__canvas {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-bottom: 0;
  border-radius: var(--r-md) var(--r-md) 0 0;
  color: var(--text-muted);
  padding: var(--s-4);
  box-sizing: border-box;
}

.stock-chart__canvas:only-child,
.stock-chart__canvas.is-empty {
  border-bottom: 1px solid var(--border);
  border-radius: var(--r-md);
}

.stock-range {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--s-2);
  padding: var(--s-3) var(--s-4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 0 0 var(--r-md) var(--r-md);
}

.stock-range__end {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.stock-range__end--right {
  text-align: right;
  align-items: flex-end;
}

.stock-range__label {
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-faint);
}

.stock-range__value {
  font-size: var(--fs-md);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}

.stock-range__mid {
  text-align: center;
  padding: var(--s-1) var(--s-3);
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.stock-range__span {
  display: block;
  margin-top: 0.1rem;
  font-size: var(--fs-sm);
  letter-spacing: 0;
  text-transform: none;
  color: var(--text);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.stock-strip {
  display: grid;
  gap: var(--s-2);
  padding: 0 var(--s-6) var(--s-4);
}

.stock-strip__item {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  padding: var(--s-3) var(--s-2);
  text-align: center;
}

.stock-strip__label {
  display: block;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 0.15rem;
}

.stock-strip__value {
  font-size: var(--fs-sm);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.stock-groups {
  padding: 0 var(--s-6) var(--s-4);
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
}

.stock-group {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  overflow: hidden;
}

.stock-group__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--s-3) var(--s-4);
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--text-muted);
  background: var(--surface-2);
  border-bottom: 1px solid var(--border);
}

.stock-group__count {
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--text-faint);
}

.stock-group__row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-4);
  min-height: 44px;
  box-sizing: border-box;
}

.stock-group__row + .stock-group__row {
  border-top: 1px solid var(--border);
}

.stock-group__row--elevated {
  background: var(--accent-soft);
}

.stock-group__key {
  color: var(--text-muted);
  font-size: var(--fs-sm);
}

.stock-group__key a {
  color: inherit;
  text-decoration: none;
  border-bottom: 1px dotted var(--text-faint);
}

.stock-group__key a:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.stock-group__val {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  font-size: var(--fs-sm);
  color: var(--text);
}

@media (min-width: 640px) {
  .stock-strip {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
```

Also update `#chart-container` rules: either remove the old fixed block or leave it unused; prefer deleting obsolete `#chart-container` / page-only metric-card reliance once markup moves. If `.detail-grid` / `.metric-card` are unused elsewhere, leave them for now (market modal may differ) — do **not** delete unless unused.

Use `var(--r-md)` (defined in `:root` as `12px`).

- [ ] **Step 2: Visual sanity (no automated CSS test)**

Skim that no hardcoded hex/rgb sneaks in for these new rules.

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "$(cat <<'EOF'
style: add stock detail chart range, strip, and groups

Shared-token layout for the approved hero-chart stock page structure.
EOF
)"
```

---

### Task 3: Markup mounts in `stock.html`

**Files:**
- Modify: `stock.html`

**Interfaces:**
- Produces DOM ids:
  - `#chart-wrap` (`.stock-chart`)
  - `#chart-container` (`.stock-chart__canvas`) — keep id for app compatibility
  - `#chart-range` (`.stock-range`, hidden by default)
  - `#trading-strip` (`.stock-strip`)
  - `#metrics-groups` (`.stock-groups`)
- Removes: `#metrics-grid` / `.detail-grid` mount

- [ ] **Step 1: Replace main metrics region**

Inside `#content` `<main>`, replace the chart + grid block with:

```html
<main>
  <div class="stock-chart" id="chart-wrap">
    <div id="chart-container" class="stock-chart__canvas"></div>
    <div id="chart-range" class="stock-range" hidden>
      <div class="stock-range__end">
        <span class="stock-range__label">Low</span>
        <span id="chart-low" class="stock-range__value"></span>
      </div>
      <div class="stock-range__mid">
        <span id="chart-sessions"></span>
        <span id="chart-span" class="stock-range__span"></span>
      </div>
      <div class="stock-range__end stock-range__end--right">
        <span class="stock-range__label">High</span>
        <span id="chart-high" class="stock-range__value"></span>
      </div>
    </div>
  </div>

  <div id="trading-strip" class="stock-strip" hidden></div>
  <div id="metrics-groups" class="stock-groups"></div>

  <div class="detail-section">
    <h3>AI Analysis</h3>
    <button class="btn btn--ai" id="btn-analyze-page">
      Start AI Chat Analysis
    </button>
  </div>
</main>
```

Keep the existing button label text from `stock.html` (including any emoji) so this task is markup-structure only.

- [ ] **Step 2: Commit**

```bash
git add stock.html
git commit -m "$(cat <<'EOF'
markup: add stock detail mounts for range, strip, groups

Replace flat metrics grid hooks with semantic containers for the redesign.
EOF
)"
```

---

### Task 4: Wire `stockDetailApp.js` render path

**Files:**
- Modify: `src/stockDetailApp.js`

**Interfaces:**
- Consumes: `sparklineRange`, `buildTradingStrip`, `buildMetricGroups` from `./lib/stockMetricsLayout.js`
- Keeps: fetch, `keyToTerm` glossary links, `renderChart` SVG, AI chat handoff, change % from `deltas.price_1d`

- [ ] **Step 1: Update element map**

```js
import {
  sparklineRange,
  buildTradingStrip,
  buildMetricGroups
} from './lib/stockMetricsLayout.js';

const els = {
  loading: document.getElementById('loading'),
  content: document.getElementById('content'),
  symbol: document.getElementById('stock-symbol'),
  name: document.getElementById('stock-name'),
  sector: document.getElementById('stock-sector'),
  price: document.getElementById('stock-price'),
  change: document.getElementById('stock-change'),
  chartContainer: document.getElementById('chart-container'),
  chartRange: document.getElementById('chart-range'),
  chartLow: document.getElementById('chart-low'),
  chartHigh: document.getElementById('chart-high'),
  chartSessions: document.getElementById('chart-sessions'),
  chartSpan: document.getElementById('chart-span'),
  strip: document.getElementById('trading-strip'),
  groups: document.getElementById('metrics-groups'),
  btnAnalyze: document.getElementById('btn-analyze-page'),
  aiOutput: document.getElementById('ai-output-page')
};
```

Remove `grid: document.getElementById('metrics-grid')`.

- [ ] **Step 2: Render range after chart**

In `renderStock`, after scheduling `renderChart`:

```js
const range = sparklineRange(stock.sparkline);
if (range) {
  els.chartRange.hidden = false;
  els.chartContainer.classList.remove('is-empty');
  els.chartLow.textContent = range.low.toLocaleString(undefined, { maximumFractionDigits: 2 });
  els.chartHigh.textContent = range.high.toLocaleString(undefined, { maximumFractionDigits: 2 });
  els.chartSessions.textContent = `${range.sessions} sessions`;
  els.chartSpan.textContent = range.span.toLocaleString(undefined, { maximumFractionDigits: 2 });
} else {
  els.chartRange.hidden = true;
  els.chartContainer.classList.add('is-empty');
}
```

Update `renderChart` empty branch to also hide range (call site already handles via `sparklineRange`).

When chart has no data, set `els.chartContainer.classList.add('is-empty')` inside `renderChart`’s early return.

- [ ] **Step 3: Render strip + groups**

Replace the old `Object.entries(stock.metrics)` card grid with:

```js
const strip = buildTradingStrip(stock.metrics);
if (strip.length) {
  els.strip.hidden = false;
  els.strip.style.gridTemplateColumns = `repeat(${strip.length}, minmax(0, 1fr))`;
  els.strip.innerHTML = strip.map((cell) => `
    <div class="stock-strip__item">
      <span class="stock-strip__label">${cell.label}</span>
      <span class="stock-strip__value">${cell.display}</span>
    </div>
  `).join('');
} else {
  els.strip.hidden = true;
  els.strip.innerHTML = '';
  els.strip.style.gridTemplateColumns = '';
}

const formatKeyFallback = (key) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());

els.groups.innerHTML = buildMetricGroups(stock.metrics).map((group) => `
  <section class="stock-group" aria-labelledby="stock-group-${group.id}">
    <div class="stock-group__head" id="stock-group-${group.id}">
      <span>${group.title}</span>
      <span class="stock-group__count">${group.rows.length}</span>
    </div>
    ${group.rows.map((row) => {
      const termQuery = keyToTerm[row.key] || formatKeyFallback(row.key);
      const link = `index.html?q=${encodeURIComponent(termQuery)}&ref=stock&symbol=${encodeURIComponent(stock.symbol)}`;
      const elevated = row.elevated ? ' stock-group__row--elevated' : '';
      return `
        <div class="stock-group__row${elevated}">
          <span class="stock-group__key">
            <a href="${link}">${row.label}</a>
          </span>
          <span class="stock-group__val">${row.display}</span>
        </div>
      `;
    }).join('')}
  </section>
`).join('');
```

Delete the old `.metric-card` HTML builder and unused `formatKey` if fully replaced.

Keep change % logic exactly:

```js
const change = stock.deltas?.price_1d;
const hasChange = Number.isFinite(change);
els.change.textContent = hasChange
  ? `${change > 0 ? '+' : ''}${change.toFixed(2)}%`
  : '—';
els.change.style.color = !hasChange ? '' : change >= 0 ? 'var(--up)' : 'var(--down)';
```

Prefer CSS variables over hardcoded `#10b981` / `#ef4444` when touching that line; SVG stroke may still need hex (existing comment).

- [ ] **Step 4: Manual check with local data**

Serve or open `stock.html?symbol=GP` and a sparse symbol (e.g. `AIBLPBOND` if present). Verify:

- Range bar Low/High/sessions/span visible for GP
- All GP metrics appear across groups
- Sparse ticker: missing groups gone; strip shortens
- No empty dashed metric rows

- [ ] **Step 5: Run tests**

Run: `npm test`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/stockDetailApp.js stock.html styles.css
git commit -m "$(cat <<'EOF'
feat: redesign stock detail with chart range and grouped metrics

Lead with price pulse, attach readonly sparkline range, and render every
present metric in null-safe groups instead of a flat card grid.
EOF
)"
```

---

### Task 5: Spec status + final verification

**Files:**
- Modify: `docs/superpowers/specs/2026-07-26-stock-detail-redesign-design.md` (status line only)

- [ ] **Step 1: Mark spec approved/implemented**

Change status to:

```markdown
**Status:** Approved — implemented per `docs/superpowers/plans/2026-07-26-stock-detail-redesign.md`
```

- [ ] **Step 2: Final `npm test`**

Run: `npm test`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-07-26-stock-detail-redesign-design.md
git commit -m "$(cat <<'EOF'
docs: mark stock detail redesign spec as implemented
EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Price pulse first (header + chart) | 3, 4 |
| Readonly Low / High / sessions / span | 1 (`sparklineRange`), 3, 4 |
| Omit range when sparkline missing | 1, 4 |
| Every present metric shown | 1 (`buildMetricGroups`), 4 |
| Null/empty omitted; empty groups hidden | 1, 4 |
| Trading strip elevates value/mktCap/close/volume | 1, 4 |
| Strip keys also in Trading group | 1 (`elevated`) |
| Unknown keys → Other | 1 |
| Glossary links retained | 4 |
| `price_1d` change only | 4 |
| styles via tokens | 2 |
| `npm test` | 1, 4, 5 |

## Out of scope (do not implement)

- Chart timeframe selector
- Collapsible group persistence
- Desktop two-column chart \| fundamentals split
- Market data build / schema changes
